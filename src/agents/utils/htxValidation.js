// htxValidation.js - Comprehensive input validation for HTX agent

/**
 * Standardized error response format
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} - Standardized error response
 */
function createErrorResponse(code, message, details = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  };
}
export const ValidationSchemas = {
  verifyKeys: {
    encrypted_key: {
      type: 'string',
      required: true,
      minLength: 10,
      pattern: /^[A-Za-z0-9+/]+=*$/,
      description: 'Base64 encoded Fernet encrypted API key'
    }
  },
  
  fetchMarkets: {
    limit: {
      type: 'number',
      required: false,
      min: 1,
      max: 1000,
      default: 100,
      description: 'Maximum number of markets to return'
    },
    filter: {
      type: 'string',
      required: false,
      minLength: 2,
      maxLength: 10,
      pattern: /^[a-zA-Z0-9]+$/,
      description: 'Currency filter (e.g., usdt, btc)'
    }
  },
  
  fetchCandles: {
    symbol: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 12,
      pattern: /^[a-zA-Z0-9]+$/,
      description: 'Trading pair symbol'
    },
    interval: {
      type: 'string',
      required: false,
      enum: ['1min', '5min', '15min', '30min', '1hour', '4hour', '1day', '1week', '1mon'],
      default: '1hour',
      description: 'Candle interval'
    },
    limit: {
      type: 'number',
      required: false,
      min: 1,
      max: 2000,
      default: 100,
      description: 'Number of candles to return'
    }
  },
  
  parseExcel: {
    filePath: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 500,
      description: 'Path to Excel/CSV file'
    },
    reportType: {
      type: 'string',
      required: false,
      enum: ['trades', 'deposits', 'withdrawals', 'orders', 'balances'],
      default: 'trades',
      description: 'Type of report to parse'
    }
  }
};

/**
 * Security validation rules
 */
export const SecurityRules = {
  // File path security
  allowedFileExtensions: ['.xlsx', '.xls', '.csv'],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  forbiddenPathPatterns: [
    /\.\./,          // Directory traversal
    /\/etc\//,       // System directories
    /\/proc\//,      // Process directories
    /\/sys\//,       // System directories
    /\/var\//,       // Variable data directories
    /\/boot\//,      // Boot directories
    /C:\\Windows/i,  // Windows system directories
    /C:\\Program/i   // Windows program directories
  ],
  
  // Rate limiting per endpoint
  rateLimits: {
    verifyKeys: { requests: 5, window: 60000 },    // 5 per minute
    fetchMarkets: { requests: 30, window: 60000 }, // 30 per minute
    fetchCandles: { requests: 20, window: 60000 }, // 20 per minute
    parseExcel: { requests: 10, window: 60000 }    // 10 per minute
  },
  
  // Input sanitization patterns
  sanitization: {
    removePatterns: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi,                                       // JavaScript protocol
      /vbscript:/gi,                                        // VBScript protocol
      /onload=/gi,                                          // Event handlers
      /onerror=/gi
    ],
    
    encodeHtml: true,
    maxStringLength: 1000
  }
};

/**
 * Validate input parameters against schema
 * @param {Object} params - Input parameters
 * @param {Object} schema - Validation schema
 * @param {string} endpoint - Endpoint name for error reporting
 * @returns {Object} - Validation result
 */
export function validateInput(params, schema, endpoint) {
  const errors = [];
  const sanitized = {};
  
  // Check for unexpected parameters
  const allowedParams = Object.keys(schema);
  const providedParams = Object.keys(params || {});
  const unexpectedParams = providedParams.filter(param => !allowedParams.includes(param));
  
  if (unexpectedParams.length > 0) {
    errors.push({
      field: 'unknown',
      type: 'unexpected_parameters',
      message: `Unexpected parameters: ${unexpectedParams.join(', ')}`,
      value: unexpectedParams
    });
  }
  
  // Validate each schema field
  for (const [fieldName, rules] of Object.entries(schema)) {
    const value = params?.[fieldName];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: fieldName,
        type: 'required',
        message: `Required field '${fieldName}' is missing`,
        expected: rules.description || rules.type
      });
      continue;
    }
    
    // Skip validation for optional missing fields
    if (!rules.required && (value === undefined || value === null)) {
      if (rules.default !== undefined) {
        sanitized[fieldName] = rules.default;
      }
      continue;
    }
    
    // Type validation
    if (value !== undefined && value !== null) {
      const typeError = validateType(value, rules, fieldName);
      if (typeError) {
        errors.push(typeError);
        continue;
      }
      
      // Additional validations
      const validationError = validateConstraints(value, rules, fieldName);
      if (validationError) {
        errors.push(validationError);
        continue;
      }
      
      // Security validation
      const securityError = validateSecurity(value, rules, fieldName);
      if (securityError) {
        errors.push(securityError);
        continue;
      }
      
      // Sanitize and store
      sanitized[fieldName] = sanitizeValue(value, rules);
    }
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      errorResponse: createErrorResponse(
        `VAL_${endpoint.toUpperCase()}`,
        'Input validation failed',
        { validationErrors: errors, endpoint }
      )
    };
  }
  
  return {
    valid: true,
    sanitized,
    errors: []
  };
}

/**
 * Validate data type
 * @param {any} value - Value to validate
 * @param {Object} rules - Validation rules
 * @param {string} fieldName - Field name
 * @returns {Object|null} - Error object or null
 */
function validateType(value, rules, fieldName) {
  const expectedType = rules.type;
  const actualType = typeof value;
  
  if (expectedType === 'number' && actualType !== 'number') {
    // Try to convert string to number
    if (actualType === 'string' && !isNaN(Number(value))) {
      return null; // Valid conversion possible
    }
    
    return {
      field: fieldName,
      type: 'datatype',
      message: `Field '${fieldName}' must be a number`,
      value,
      expected: 'number',
      actual: actualType
    };
  }
  
  if (expectedType === 'string' && actualType !== 'string') {
    return {
      field: fieldName,
      type: 'datatype',
      message: `Field '${fieldName}' must be a string`,
      value,
      expected: 'string',
      actual: actualType
    };
  }
  
  return null;
}

/**
 * Validate field constraints
 * @param {any} value - Value to validate
 * @param {Object} rules - Validation rules
 * @param {string} fieldName - Field name
 * @returns {Object|null} - Error object or null
 */
function validateConstraints(value, rules, fieldName) {
  // Convert string numbers to actual numbers for numeric validation
  let testValue = value;
  if (rules.type === 'number' && typeof value === 'string') {
    testValue = Number(value);
    if (isNaN(testValue)) {
      return {
        field: fieldName,
        type: 'format',
        message: `Field '${fieldName}' is not a valid number`,
        value
      };
    }
  }
  
  // Min/Max for numbers
  if (rules.type === 'number') {
    if (rules.min !== undefined && testValue < rules.min) {
      return {
        field: fieldName,
        type: 'range',
        message: `Field '${fieldName}' must be at least ${rules.min}`,
        value: testValue,
        min: rules.min
      };
    }
    
    if (rules.max !== undefined && testValue > rules.max) {
      return {
        field: fieldName,
        type: 'range',
        message: `Field '${fieldName}' must be at most ${rules.max}`,
        value: testValue,
        max: rules.max
      };
    }
  }
  
  // String length validation
  if (rules.type === 'string') {
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      return {
        field: fieldName,
        type: 'length',
        message: `Field '${fieldName}' must be at least ${rules.minLength} characters`,
        value,
        minLength: rules.minLength
      };
    }
    
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return {
        field: fieldName,
        type: 'length',
        message: `Field '${fieldName}' must be at most ${rules.maxLength} characters`,
        value,
        maxLength: rules.maxLength
      };
    }
  }
  
  // Enum validation
  if (rules.enum && !rules.enum.includes(value)) {
    return {
      field: fieldName,
      type: 'enum',
      message: `Field '${fieldName}' must be one of: ${rules.enum.join(', ')}`,
      value,
      allowedValues: rules.enum
    };
  }
  
  // Pattern validation
  if (rules.pattern && !rules.pattern.test(value)) {
    return {
      field: fieldName,
      type: 'pattern',
      message: `Field '${fieldName}' does not match required pattern`,
      value,
      pattern: rules.pattern.toString()
    };
  }
  
  return null;
}

/**
 * Validate security constraints
 * @param {any} value - Value to validate
 * @param {Object} rules - Validation rules
 * @param {string} fieldName - Field name
 * @returns {Object|null} - Error object or null
 */
function validateSecurity(value, rules, fieldName) {
  if (typeof value !== 'string') {
    return null; // Only validate strings for security
  }
  
  // Check for path traversal in file paths
  if (fieldName === 'filePath') {
    for (const pattern of SecurityRules.forbiddenPathPatterns) {
      if (pattern.test(value)) {
        return {
          field: fieldName,
          type: 'security',
          message: 'File path contains forbidden patterns',
          value: value.substring(0, 50) + '...',
          securityViolation: 'path_traversal'
        };
      }
    }
  }
  
  // Check string length limits
  if (value.length > SecurityRules.sanitization.maxStringLength) {
    return {
      field: fieldName,
      type: 'security',
      message: `Field '${fieldName}' exceeds maximum length`,
      maxLength: SecurityRules.sanitization.maxStringLength,
      actualLength: value.length
    };
  }
  
  // Check for script injection patterns
  for (const pattern of SecurityRules.sanitization.removePatterns) {
    if (pattern.test(value)) {
      return {
        field: fieldName,
        type: 'security',
        message: 'Field contains potentially malicious content',
        securityViolation: 'script_injection'
      };
    }
  }
  
  return null;
}

/**
 * Sanitize input value
 * @param {any} value - Value to sanitize
 * @param {Object} rules - Validation rules
 * @returns {any} - Sanitized value
 */
function sanitizeValue(value, rules) {
  if (typeof value !== 'string') {
    return value;
  }
  
  let sanitized = value;
  
  // Remove dangerous patterns
  for (const pattern of SecurityRules.sanitization.removePatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // HTML encode if required
  if (SecurityRules.sanitization.encodeHtml) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Convert to number if needed
  if (rules.type === 'number' && typeof sanitized === 'string') {
    return Number(sanitized);
  }
  
  return sanitized;
}

/**
 * Validate file path security
 * @param {string} filePath - File path to validate
 * @returns {Object} - Validation result
 */
export function validateFilePath(filePath) {
  const errors = [];
  
  // Check path traversal
  for (const pattern of SecurityRules.forbiddenPathPatterns) {
    if (pattern.test(filePath)) {
      errors.push({
        type: 'security',
        message: 'File path contains forbidden patterns',
        violation: 'path_traversal',
        pattern: pattern.toString()
      });
    }
  }
  
  // Check file extension
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext && !SecurityRules.allowedFileExtensions.includes(ext)) {
    errors.push({
      type: 'security',
      message: 'File extension not allowed',
      extension: ext,
      allowed: SecurityRules.allowedFileExtensions
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  ValidationSchemas,
  SecurityRules,
  validateInput,
  validateFilePath
};