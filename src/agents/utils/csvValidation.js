// csvValidation.js - Comprehensive input validation for CSV agent
import fs from 'fs';
import path from 'path';

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

/**
 * Standardized success response format
 * @param {Object} data - Response data
 * @param {Object} metadata - Response metadata
 * @returns {Object} - Standardized success response
 */
function createSuccessResponse(data, metadata = {}) {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * Validation schemas for CSV agent endpoints
 */
export const ValidationSchemas = {
  parseCSV: {
    filePath: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 500,
      description: 'Path to CSV file'
    },
    delimiter: {
      type: 'string',
      required: false,
      enum: [',', ';', '\t', '|', ' '],
      default: ',',
      description: 'Field delimiter character'
    },
    hasHeader: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Whether file has header row'
    },
    encoding: {
      type: 'string',
      required: false,
      enum: ['utf8', 'utf16le', 'latin1', 'ascii'],
      default: 'utf8',
      description: 'File encoding'
    },
    streaming: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Use streaming for large files'
    },
    chunkSize: {
      type: 'number',
      required: false,
      min: 100,
      max: 10000,
      default: 1000,
      description: 'Rows per chunk for streaming'
    }
  },
  
  transformData: {
    data: {
      type: 'array',
      required: true,
      description: 'Array of data objects to transform'
    },
    operations: {
      type: 'array',
      required: true,
      description: 'Array of transformation operations'
    }
  },
  
  validateData: {
    data: {
      type: 'array',
      required: true,
      description: 'Array of data objects to validate'
    },
    schema: {
      type: 'object',
      required: false,
      default: {},
      description: 'Validation schema definition'
    }
  },
  
  exportCSV: {
    data: {
      type: 'array',
      required: true,
      description: 'Array of data objects to export'
    },
    filePath: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 500,
      description: 'Output file path'
    },
    delimiter: {
      type: 'string',
      required: false,
      enum: [',', ';', '\t', '|'],
      default: ',',
      description: 'Field delimiter character'
    },
    includeHeaders: {
      type: 'boolean',
      required: false,
      default: true,
      description: 'Include header row in output'
    }
  }
};

/**
 * Security validation rules for CSV agent
 */
export const SecurityRules = {
  // File path security
  allowedFileExtensions: ['.csv', '.tsv', '.txt', '.dat'],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  streamingThreshold: 10 * 1024 * 1024, // 10MB - auto-enable streaming
  forbiddenPathPatterns: [
    /\.\./,          // Directory traversal
    /\/etc\//,       // System directories
    /\/proc\//,      // Process directories
    /\/sys\//,       // System directories
    /\/var\//,       // Variable data directories
    /\/boot\//,      // Boot directories
    /C:\\Windows/i,  // Windows system directories
    /C:\\Program/i,  // Windows program directories
    /^\/dev\//,      // Device files
    /^\/tmp\//       // Temporary files (unless explicitly allowed)
  ],
  
  // Content security
  maxRowCount: 1000000,      // 1M rows max
  maxColumnCount: 1000,      // 1K columns max
  maxCellLength: 10000,      // 10K characters per cell
  
  // Memory limits
  maxMemoryUsage: 500 * 1024 * 1024, // 500MB
  
  // Rate limiting
  rateLimits: {
    parseCSV: { requests: 10, window: 60000 },     // 10 per minute
    transformData: { requests: 50, window: 60000 }, // 50 per minute
    validateData: { requests: 20, window: 60000 },  // 20 per minute
    exportCSV: { requests: 5, window: 60000 }       // 5 per minute
  },
  
  // Input sanitization
  sanitization: {
    removePatterns: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi,                                       // JavaScript protocol
      /vbscript:/gi,                                        // VBScript protocol
      /=\s*cmd/gi,                                          // Command injection
      /=\s*@/gi                                             // Formula injection
    ],
    
    encodeHtml: true,
    normalizeLineEndings: true
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
      sanitized[fieldName] = sanitizeValue(value, rules, fieldName);
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
  
  if (expectedType === 'boolean' && actualType !== 'boolean') {
    // Try to convert string to boolean
    if (actualType === 'string' && ['true', 'false', '1', '0'].includes(value.toLowerCase())) {
      return null; // Valid conversion possible
    }
    
    return {
      field: fieldName,
      type: 'datatype',
      message: `Field '${fieldName}' must be a boolean`,
      value,
      expected: 'boolean',
      actual: actualType
    };
  }
  
  if (expectedType === 'array' && !Array.isArray(value)) {
    return {
      field: fieldName,
      type: 'datatype',
      message: `Field '${fieldName}' must be an array`,
      value: typeof value,
      expected: 'array',
      actual: actualType
    };
  }
  
  if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
    return {
      field: fieldName,
      type: 'datatype',
      message: `Field '${fieldName}' must be an object`,
      value: Array.isArray(value) ? 'array' : actualType,
      expected: 'object',
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
  // Convert string numbers/booleans for validation
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
  
  if (rules.type === 'boolean' && typeof value === 'string') {
    const boolStr = value.toLowerCase();
    if (['true', '1'].includes(boolStr)) {
      testValue = true;
    } else if (['false', '0'].includes(boolStr)) {
      testValue = false;
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
  
  // Array length validation
  if (rules.type === 'array') {
    if (rules.minItems !== undefined && value.length < rules.minItems) {
      return {
        field: fieldName,
        type: 'array_length',
        message: `Field '${fieldName}' must have at least ${rules.minItems} items`,
        value: value.length,
        minItems: rules.minItems
      };
    }
    
    if (rules.maxItems !== undefined && value.length > rules.maxItems) {
      return {
        field: fieldName,
        type: 'array_length',
        message: `Field '${fieldName}' must have at most ${rules.maxItems} items`,
        value: value.length,
        maxItems: rules.maxItems
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
  if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
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
  
  // Check for dangerous content patterns
  for (const pattern of SecurityRules.sanitization.removePatterns) {
    if (pattern.test(value)) {
      return {
        field: fieldName,
        type: 'security',
        message: 'Field contains potentially malicious content',
        securityViolation: 'content_injection'
      };
    }
  }
  
  return null;
}

/**
 * Sanitize input value
 * @param {any} value - Value to sanitize
 * @param {Object} rules - Validation rules
 * @param {string} fieldName - Field name for context
 * @returns {any} - Sanitized value
 */
function sanitizeValue(value, rules, fieldName = '') {
  if (typeof value === 'string') {
    let sanitized = value;
    
    // Remove dangerous patterns
    for (const pattern of SecurityRules.sanitization.removePatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
    
    // Normalize line endings
    if (SecurityRules.sanitization.normalizeLineEndings) {
      sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    
    // HTML encode if required
    if (SecurityRules.sanitization.encodeHtml && fieldName !== 'filePath') {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Convert to appropriate type if needed
    if (rules.type === 'number' && typeof sanitized === 'string') {
      return Number(sanitized);
    }
    
    if (rules.type === 'boolean' && typeof sanitized === 'string') {
      const boolStr = sanitized.toLowerCase();
      if (['true', '1'].includes(boolStr)) return true;
      if (['false', '0'].includes(boolStr)) return false;
    }
    
    return sanitized;
  }
  
  return value;
}

/**
 * Validate file path and security constraints
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
  
  // Check if file exists and get stats for additional validation
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      
      // Check file size
      if (stats.size > SecurityRules.maxFileSize) {
        errors.push({
          type: 'size',
          message: 'File size exceeds maximum limit',
          fileSize: stats.size,
          maxSize: SecurityRules.maxFileSize
        });
      }
      
      // Check if file is actually a file (not directory)
      if (!stats.isFile()) {
        errors.push({
          type: 'type',
          message: 'Path does not point to a regular file',
          fileType: stats.isDirectory() ? 'directory' : 'other'
        });
      }
    } catch (error) {
      errors.push({
        type: 'access',
        message: 'Cannot access file',
        error: error.message
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    shouldUseStreaming: fs.existsSync(filePath) && 
                      fs.statSync(filePath).size > SecurityRules.streamingThreshold
  };
}

export { createErrorResponse, createSuccessResponse };

export default {
  ValidationSchemas,
  SecurityRules,
  validateInput,
  validateFilePath,
  createErrorResponse,
  createSuccessResponse
};