// security.js — Security middleware and input validation
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { decryptApiKey, verifyEncryptedCredentials } from './fernet.js';

/**
 * Input validation schemas and functions
 */
export const ValidationSchemas = {
  htxApiKey: {
    type: 'string',
    minLength: 10,
    maxLength: 200,
    pattern: /^[A-Za-z0-9+/=]+$/ // Base64 pattern for encrypted key
  },
  
  symbol: {
    type: 'string',
    minLength: 3,
    maxLength: 20,
    pattern: /^[A-Z0-9\-]+$/
  },
  
  interval: {
    type: 'string',
    enum: ['1min', '5min', '15min', '30min', '1hour', '4hour', '1day', '1week']
  },
  
  limit: {
    type: 'number',
    min: 1,
    max: 2000
  },
  
  filePath: {
    type: 'string',
    minLength: 1,
    maxLength: 500,
    pattern: /^[^<>:"|?*\x00-\x1f]+$/ // Prevent path traversal
  },
  
  agentName: {
    type: 'string',
    enum: ['htx', 'fingpt', 'csv', 'infra', 'ci', 'orchestrator']
  },
  
  taskName: {
    type: 'string',
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/
  }
};

/**
 * Validate input against schema
 * @param {any} value - Value to validate
 * @param {Object} schema - Validation schema
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} - { valid: boolean, error?: string, sanitized?: any }
 */
export function validateInput(value, schema, fieldName = 'field') {
  try {
    // Check type
    if (schema.type && typeof value !== schema.type) {
      return { 
        valid: false, 
        error: `${fieldName} must be of type ${schema.type}` 
      };
    }
    
    // Check string constraints
    if (schema.type === 'string') {
      if (schema.minLength && value.length < schema.minLength) {
        return { 
          valid: false, 
          error: `${fieldName} must be at least ${schema.minLength} characters` 
        };
      }
      
      if (schema.maxLength && value.length > schema.maxLength) {
        return { 
          valid: false, 
          error: `${fieldName} must be at most ${schema.maxLength} characters` 
        };
      }
      
      if (schema.pattern && !schema.pattern.test(value)) {
        return { 
          valid: false, 
          error: `${fieldName} format is invalid` 
        };
      }
      
      if (schema.enum && !schema.enum.includes(value)) {
        return { 
          valid: false, 
          error: `${fieldName} must be one of: ${schema.enum.join(', ')}` 
        };
      }
    }
    
    // Check number constraints
    if (schema.type === 'number') {
      if (schema.min !== undefined && value < schema.min) {
        return { 
          valid: false, 
          error: `${fieldName} must be at least ${schema.min}` 
        };
      }
      
      if (schema.max !== undefined && value > schema.max) {
        return { 
          valid: false, 
          error: `${fieldName} must be at most ${schema.max}` 
        };
      }
    }
    
    return { valid: true, sanitized: value };
  } catch (error) {
    return { 
      valid: false, 
      error: `Validation error for ${fieldName}: ${error.message}` 
    };
  }
}

/**
 * Sanitize and validate request parameters
 * @param {Object} params - Request parameters
 * @param {Object} schema - Validation schema mapping
 * @returns {Object} - { valid: boolean, errors?: string[], sanitized?: Object }
 */
export function validateRequestParams(params, schema) {
  const errors = [];
  const sanitized = {};
  
  for (const [key, paramSchema] of Object.entries(schema)) {
    if (params[key] !== undefined) {
      const validation = validateInput(params[key], paramSchema, key);
      
      if (!validation.valid) {
        errors.push(validation.error);
      } else {
        sanitized[key] = validation.sanitized;
      }
    } else if (paramSchema.required) {
      errors.push(`${key} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    sanitized
  };
}

/**
 * Rate limiting middleware factory
 * @param {Object} options - Rate limit options
 * @returns {Function} - Express middleware
 */
export function createRateLimit(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      retryAfter: options.windowMs || 15 * 60 * 1000
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options
  });
}

/**
 * Security headers middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function securityHeaders(req, res, next) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server identification
  res.removeHeader('X-Powered-By');
  
  next();
}

/**
 * Request sanitization middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function sanitizeRequest(req, res, next) {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    res.status(400).json({ 
      error: 'Invalid request data', 
      message: 'Request contains invalid characters' 
    });
  }
}

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'object' ? sanitizeObject(item) : sanitizeString(item)
    );
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      
      if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = sanitizeObject(value);
      } else {
        sanitized[sanitizedKey] = sanitizeString(value);
      }
    }
    
    return sanitized;
  }
  
  return sanitizeString(obj);
}

/**
 * Sanitize string input
 * @param {any} value - Value to sanitize
 * @returns {any} - Sanitized value
 */
function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remove control characters and potential XSS
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Script tags
    .replace(/<[^>]*>/g, '') // HTML tags
    .replace(/javascript:/gi, '') // JavaScript URLs
    .replace(/on\w+\s*=/gi, '') // Event handlers
    .trim();
}

/**
 * API key validation middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function validateApiKey(req, res, next) {
  try {
    const { encrypted_key } = req.body;
    
    if (!encrypted_key) {
      return res.status(400).json({ 
        error: 'Missing encrypted API key',
        code: 'MISSING_API_KEY'
      });
    }
    
    // Validate encrypted key format
    const validation = validateInput(
      encrypted_key, 
      ValidationSchemas.htxApiKey, 
      'encrypted_key'
    );
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error,
        code: 'INVALID_API_KEY_FORMAT'
      });
    }
    
    // Verify the key can be decrypted
    if (!verifyEncryptedCredentials(encrypted_key)) {
      return res.status(401).json({ 
        error: 'Invalid or corrupted API key',
        code: 'INVALID_API_KEY'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ 
      error: 'API key validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * Generate secure session token
 * @returns {string} - Secure random token
 */
export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash sensitive data
 * @param {string} data - Data to hash
 * @param {string} salt - Salt for hashing (optional)
 * @returns {string} - Hashed data
 */
export function hashSensitiveData(data, salt = null) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(data + actualSalt);
  return hash.digest('hex');
}

/**
 * Verify hashed data
 * @param {string} data - Original data
 * @param {string} hash - Hash to verify against
 * @param {string} salt - Salt used for hashing
 * @returns {boolean} - True if hash matches
 */
export function verifyHashedData(data, hash, salt) {
  const computedHash = hashSensitiveData(data, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(computedHash, 'hex')
  );
}

/**
 * Audit logging for security events
 * @param {string} event - Event type
 * @param {Object} details - Event details
 * @param {Object} req - Express request (optional)
 */
export function auditLog(event, details, req = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details,
    ip: req ? (req.ip || req.connection.remoteAddress) : 'unknown',
    userAgent: req ? req.get('User-Agent') : 'unknown',
    sessionId: req ? req.sessionId : 'unknown'
  };
  
  // In production, send to proper logging service
  console.log('AUDIT:', JSON.stringify(logEntry));
  
  // TODO: Implement proper audit logging (e.g., to file, database, or logging service)
}

/**
 * Security configuration
 */
export const SecurityConfig = {
  // Rate limiting
  rateLimits: {
    general: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
    auth: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 auth attempts per 15 minutes
    api: { windowMs: 60 * 1000, max: 60 }, // 60 API calls per minute
    upload: { windowMs: 60 * 1000, max: 10 } // 10 uploads per minute
  },
  
  // Validation settings
  validation: {
    maxPayloadSize: '50mb',
    maxFileSize: '10mb',
    allowedFileTypes: ['.csv', '.xlsx', '.json'],
    maxFiles: 5
  },
  
  // Encryption settings
  encryption: {
    keyRotationDays: 90,
    tokenTTL: 3600, // 1 hour
    keyPath: './secret.key',
    backupKeyPath: './secret.key.backup'
  }
};

export default {
  ValidationSchemas,
  validateInput,
  validateRequestParams,
  createRateLimit,
  securityHeaders,
  sanitizeRequest,
  validateApiKey,
  generateSecureToken,
  hashSensitiveData,
  verifyHashedData,
  auditLog,
  SecurityConfig
};