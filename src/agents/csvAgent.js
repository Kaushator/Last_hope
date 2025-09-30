// csvAgent.js — CSV and Excel data parsing, transformation, and validation
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { 
  validateInput, 
  ValidationSchemas, 
  validateFilePath,
  createErrorResponse,
  createSuccessResponse,
  SecurityRules
} from './utils/csvValidation.js';
import {
  parseCSVStreaming,
  transformDataStreaming,
  StreamingProgressTracker
} from './utils/csvStreaming.js';

/**
 * Parse CSV file with advanced options and streaming support
 * @param {Object} params - { filePath, delimiter, hasHeader, encoding, streaming, chunkSize }
 * @returns {Object} - Standardized parsing response
 */
export async function parseCSV(params = {}) {
  try {
    // Comprehensive input validation
    const validation = validateInput(params, ValidationSchemas.parseCSV, 'parseCSV');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { filePath, delimiter, hasHeader, encoding, streaming, chunkSize } = validation.sanitized;
    
    // File security validation
    const fileValidation = validateFilePath(filePath);
    if (!fileValidation.valid) {
      return createErrorResponse(
        'SEC_001',
        'File security validation failed',
        { securityErrors: fileValidation.errors }
      );
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return createErrorResponse(
        'NF_001',
        'File not found',
        { filePath }
      );
    }
    
    const fileStats = fs.statSync(filePath);
    
    // Determine if streaming should be used
    const shouldUseStreaming = streaming || fileValidation.shouldUseStreaming;
    
    if (shouldUseStreaming) {
      // Use streaming parser for large files
      return await parseCSVStreaming(filePath, {
        delimiter,
        hasHeader,
        encoding,
        chunkSize
      });
    }
    
    // Standard in-memory parsing for smaller files
    const content = fs.readFileSync(filePath, encoding);
    const lines = content.trim().split('\n');
    
    if (lines.length === 0) {
      return createErrorResponse(
        'VAL_001',
        'File is empty',
        { filePath }
      );
    }
    
    let headers = [];
    let dataRows = [];
    
    if (hasHeader) {
      headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
      dataRows = lines.slice(1);
    } else {
      headers = lines[0].split(delimiter).map((_, i) => `column_${i + 1}`);
      dataRows = lines;
    }
    
    // Validate column count
    if (headers.length > SecurityRules.maxColumnCount) {
      return createErrorResponse(
        'SEC_002',
        'Too many columns',
        { columns: headers.length, maxAllowed: SecurityRules.maxColumnCount }
      );
    }
    
    const data = [];
    const errors = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const line = dataRows[i];
        const values = parseCSVLine(line, delimiter);
        
        // Validate cell content
        const validationResult = validateRowContent(values, i + 1);
        if (!validationResult.valid) {
          errors.push(...validationResult.errors);
          continue;
        }
        
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || null;
        });
        
        row._rowIndex = i + (hasHeader ? 2 : 1);
        
        // Filter out completely empty rows
        const hasData = Object.values(row).some(val => 
          val !== null && val !== '' && val !== '_rowIndex'
        );
        
        if (hasData) {
          data.push(row);
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error.message,
          type: 'parsing_error'
        });
      }
    }
    
    return createSuccessResponse(
      {
        filePath,
        headers,
        data
      },
      {
        totalRows: data.length,
        columns: headers.length,
        delimiter,
        hasHeader,
        encoding,
        fileSize: fileStats.size,
        processingMethod: 'in-memory',
        errors: errors.length > 0 ? errors : undefined,
        endpoint: 'parseCSV'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_001',
      'CSV parsing failed',
      { filePath: params.filePath, originalError: error.message }
    );
  }
}

/**
 * Parse CSV line with proper quote handling
 * @param {string} line - CSV line to parse
 * @param {string} delimiter - Field delimiter
 * @returns {Array} - Array of field values
 */
function parseCSVLine(line, delimiter = ',') {
  const values = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    
    i++;
  }
  
  // Add the last value
  values.push(current.trim());
  
  return values;
}

/**
 * Validate row content for security and size constraints
 * @param {Array} values - Row values
 * @param {number} rowNumber - Row number for error reporting
 * @returns {Object} - Validation result
 */
function validateRowContent(values, rowNumber) {
  const errors = [];
  
  // Check cell length limits
  values.forEach((value, index) => {
    if (value && value.length > SecurityRules.maxCellLength) {
      errors.push({
        row: rowNumber,
        column: index + 1,
        type: 'cell_too_long',
        message: 'Cell content exceeds maximum length',
        maxLength: SecurityRules.maxCellLength,
        actualLength: value.length
      });
    }
    
    // Check for dangerous content
    if (typeof value === 'string') {
      for (const pattern of SecurityRules.sanitization.removePatterns) {
        if (pattern.test(value)) {
          errors.push({
            row: rowNumber,
            column: index + 1,
            type: 'dangerous_content',
            message: 'Cell contains potentially dangerous content',
            pattern: pattern.toString()
          });
        }
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
/**
 * Transform CSV data with specified operations and streaming support
 * @param {Object} params - { data, operations, streaming, chunkSize }
 * @returns {Object} - Standardized transformation response
 */
export async function transformData(params = {}) {
  try {
    // Comprehensive input validation
    const validation = validateInput(params, ValidationSchemas.transformData, 'transformData');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { data, operations } = validation.sanitized;
    const streaming = params.streaming || false;
    const chunkSize = params.chunkSize || 1000;
    
    // Validate operations
    const operationValidation = validateOperations(operations);
    if (!operationValidation.valid) {
      return createErrorResponse(
        'VAL_002',
        'Invalid operations',
        { operationErrors: operationValidation.errors }
      );
    }
    
    // Check data size and decide on processing method
    const shouldUseStreaming = streaming || data.length > 10000;
    
    if (shouldUseStreaming) {
      // Use streaming transformation for large datasets
      return await transformDataStreaming(data, operations, { chunkSize });
    }
    
    // Standard in-memory transformation
    let transformedData = [...data];
    const appliedOperations = [];
    
    for (const operation of operations) {
      const { type, column, value, condition, order } = operation;
      
      switch (type) {
      case 'filter':
        if (condition) {
          const originalCount = transformedData.length;
          transformedData = transformedData.filter(row => {
            try {
              const evalCondition = condition.replace(/{{(.*?)}}/g, (match, col) => {
                return JSON.stringify(row[col] || '');
              });
              return eval(evalCondition);
            } catch (e) {
              return true; // Keep row if condition fails
            }
          });
          appliedOperations.push({
            type: 'filter',
            description: `Filtered rows by: ${condition}`,
            recordsRemoved: originalCount - transformedData.length
          });
        }
        break;
          
      case 'map':
        if (column && value) {
          transformedData = transformedData.map(row => ({
            ...row,
            [column]: value.replace(/{{(.*?)}}/g, (match, col) => row[col] || '')
          }));
          appliedOperations.push({
            type: 'map',
            description: `Mapped column ${column}: ${value}`,
            column
          });
        }
        break;
          
      case 'aggregate':
        if (column) {
          const numericValues = transformedData
            .map(row => parseFloat(row[column]))
            .filter(val => !isNaN(val));
            
          const aggregation = {
            column,
            count: numericValues.length,
            sum: numericValues.reduce((a, b) => a + b, 0),
            avg: numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0,
            min: numericValues.length > 0 ? Math.min(...numericValues) : null,
            max: numericValues.length > 0 ? Math.max(...numericValues) : null,
            _aggregation: true
          };
            
          transformedData = [aggregation];
          appliedOperations.push({
            type: 'aggregate',
            description: `Aggregated column ${column}`,
            column,
            statistics: aggregation
          });
        }
        break;
          
      case 'sort':
        if (column) {
          transformedData.sort((a, b) => {
            const aVal = a[column];
            const bVal = b[column];
              
            // Try numeric comparison first
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
              
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return order === 'desc' ? bNum - aNum : aNum - bNum;
            }
              
            // Fallback to string comparison
            const aStr = String(aVal || '').toLowerCase();
            const bStr = String(bVal || '').toLowerCase();
              
            if (order === 'desc') {
              return bStr.localeCompare(aStr);
            }
            return aStr.localeCompare(bStr);
          });
          appliedOperations.push({
            type: 'sort',
            description: `Sorted by ${column} (${order || 'asc'})`,
            column,
            order: order || 'asc'
          });
        }
        break;
          
      default:
        appliedOperations.push({
          type: 'unknown',
          description: `Unknown operation: ${type}`,
          skipped: true
        });
      }
    }
    
    return createSuccessResponse(
      {
        transformedData,
        appliedOperations
      },
      {
        originalCount: data.length,
        transformedCount: transformedData.length,
        operationsApplied: appliedOperations.length,
        processingMethod: 'in-memory',
        endpoint: 'transformData'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_002',
      'Data transformation failed',
      { originalError: error.message }
    );
  }
}

/**
 * Validate transformation operations
 * @param {Array} operations - Array of operations to validate
 * @returns {Object} - Validation result
 */
function validateOperations(operations) {
  const errors = [];
  const validTypes = ['filter', 'map', 'aggregate', 'sort'];
  
  if (!Array.isArray(operations)) {
    return {
      valid: false,
      errors: [{ message: 'Operations must be an array' }]
    };
  }
  
  operations.forEach((operation, index) => {
    if (!operation || typeof operation !== 'object') {
      errors.push({
        index,
        message: 'Operation must be an object',
        operation
      });
      return;
    }
    
    if (!operation.type || !validTypes.includes(operation.type)) {
      errors.push({
        index,
        message: `Invalid operation type: ${operation.type}`,
        validTypes,
        operation
      });
    }
    
    // Type-specific validation
    switch (operation.type) {
    case 'filter':
      if (!operation.condition) {
        errors.push({
          index,
          message: 'Filter operation requires condition',
          operation
        });
      }
      break;
        
    case 'map':
      if (!operation.column || !operation.value) {
        errors.push({
          index,
          message: 'Map operation requires column and value',
          operation
        });
      }
      break;
        
    case 'aggregate':
    case 'sort':
      if (!operation.column) {
        errors.push({
          index,
          message: `${operation.type} operation requires column`,
          operation
        });
      }
      break;
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}
/**
 * Enhanced data validation with comprehensive schema support
 * @param {Object} params - { data, schema }
 * @returns {Object} - Standardized validation response
 */
export async function validateData(params = {}) {
  try {
    // Input validation
    const validation = validateInput(params, ValidationSchemas.validateData, 'validateData');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { data, schema } = validation.sanitized;
    
    const errors = [];
    const warnings = [];
    let validRows = 0;
    
    data.forEach((row, index) => {
      let rowValid = true;
      
      // Check required fields
      if (schema.required) {
        schema.required.forEach(field => {
          if (!row[field] || row[field] === '') {
            errors.push({
              row: index + 1,
              field,
              type: 'required',
              message: `Required field '${field}' is missing or empty`
            });
            rowValid = false;
          }
        });
      }
      
      // Check data types
      if (schema.types) {
        Object.entries(schema.types).forEach(([field, expectedType]) => {
          if (row[field] && row[field] !== '') {
            const value = row[field];
            let typeValid = true;
            
            switch (expectedType) {
            case 'number':
              if (isNaN(parseFloat(value))) {
                typeValid = false;
              }
              break;
            case 'email': {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                typeValid = false;
              }
              break;
            }
            case 'date':
              if (isNaN(Date.parse(value))) {
                typeValid = false;
              }
              break;
            case 'boolean':
              if (!['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase())) {
                typeValid = false;
              }
              break;
            }
            
            if (!typeValid) {
              errors.push({
                row: index + 1,
                field,
                type: 'datatype',
                message: `Field '${field}' should be of type '${expectedType}' but got '${value}'`
              });
              rowValid = false;
            }
          }
        });
      }
      
      if (rowValid) validRows++;
    });
    
    return createSuccessResponse(
      {
        valid: errors.length === 0,
        totalRows: data.length,
        validRows,
        invalidRows: data.length - validRows,
        errors,
        warnings,
        successRate: data.length > 0 ? (validRows / data.length * 100).toFixed(2) : 0
      },
      {
        endpoint: 'validateData',
        schema: schema || 'none'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_003',
      'Data validation failed',
      { originalError: error.message }
    );
  }
}

/**
 * Export data to CSV format
 * @param {Object} params - { data, filePath, delimiter }
 * @returns {Object} - Export result
 */
/**
 * Enhanced CSV export with validation and options
 * @param {Object} params - { data, filePath, delimiter, includeHeaders }
 * @returns {Object} - Standardized export response
 */
export async function exportCSV(params = {}) {
  try {
    // Input validation
    const validation = validateInput(params, ValidationSchemas.exportCSV, 'exportCSV');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { data, filePath, delimiter, includeHeaders } = validation.sanitized;
    
    // File security validation
    const pathValidation = validateFilePath(filePath);
    if (!pathValidation.valid) {
      return createErrorResponse(
        'SEC_003',
        'Export file path security validation failed',
        { securityErrors: pathValidation.errors }
      );
    }
    
    if (data.length === 0) {
      return createErrorResponse(
        'VAL_003',
        'No data to export',
        { dataLength: 0 }
      );
    }
    
    // Get headers from first object
    const headers = Object.keys(data[0]).filter(key => !key.startsWith('_'));
    
    // Create CSV content
    const csvLines = [];
    
    if (includeHeaders) {
      csvLines.push(headers.join(delimiter));
    }
    
    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        // Escape values containing delimiter or quotes
        if (String(value).includes(delimiter) || String(value).includes('"')) {
          value = `"${String(value).replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvLines.push(values.join(delimiter));
    });
    
    const csvContent = csvLines.join('\n');
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    return createSuccessResponse(
      {
        filePath,
        rowsExported: data.length,
        headers,
        includeHeaders
      },
      {
        fileSize: fs.statSync(filePath).size,
        columns: headers.length,
        delimiter,
        endpoint: 'exportCSV'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_004',
      'CSV export failed',
      { filePath: params.filePath, originalError: error.message }
    );
  }
}

/**
 * Get CSV agent summary and capabilities
 * @returns {Object} - Agent status and features
 */
/**
 * Enhanced CSV agent summary with comprehensive capabilities
 * @returns {Object} - Standardized agent status response
 */
export function summary() {
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    
    return createSuccessResponse(
      {
        agent: 'csvAgent',
        version: '2.0.0',
        status: 'operational',
        capabilities: {
          csvParsing: {
            status: 'implemented',
            features: ['streaming', 'validation', 'security_checks', 'encoding_support']
          },
          dataTransformation: {
            status: 'implemented', 
            features: ['filter', 'map', 'aggregate', 'sort', 'streaming']
          },
          dataValidation: {
            status: 'implemented',
            features: ['schema_validation', 'type_checking', 'required_fields']
          },
          csvExport: {
            status: 'implemented',
            features: ['custom_delimiters', 'header_control', 'security_validation']
          },
          streaming: {
            status: 'implemented',
            features: ['large_file_support', 'memory_efficient', 'progress_tracking']
          },
          security: {
            status: 'implemented',
            features: ['path_validation', 'content_sanitization', 'size_limits']
          }
        },
        supportedFormats: {
          input: ['.csv', '.tsv', '.txt', '.dat'],
          output: ['.csv'],
          encodings: ['utf8', 'utf16le', 'latin1', 'ascii']
        },
        limits: {
          maxFileSize: '100MB',
          maxRows: '1M',
          maxColumns: '1K',
          streamingThreshold: '10MB'
        },
        endpoints: [
          {
            name: 'parseCSV',
            method: 'POST',
            parameters: ['filePath', 'delimiter?', 'hasHeader?', 'encoding?', 'streaming?'],
            features: ['streaming', 'validation', 'security']
          },
          {
            name: 'transformData',
            method: 'POST', 
            parameters: ['data', 'operations', 'streaming?'],
            features: ['filter', 'map', 'aggregate', 'sort']
          },
          {
            name: 'validateData',
            method: 'POST',
            parameters: ['data', 'schema?'],
            features: ['schema_validation', 'type_checking']
          },
          {
            name: 'exportCSV',
            method: 'POST',
            parameters: ['data', 'filePath', 'delimiter?', 'includeHeaders?'],
            features: ['security_validation', 'custom_formatting']
          },
          {
            name: 'summary',
            method: 'GET',
            parameters: [],
            features: ['status_reporting']
          }
        ]
      },
      {
        nodeVersion,
        endpoint: 'summary'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_005',
      'Failed to generate agent summary',
      { originalError: error.message }
    );
  }
}
