// csvStreaming.js - Streaming CSV parser for large files
import fs from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { createSuccessResponse, createErrorResponse } from './csvValidation.js';

/**
 * Custom CSV parser transform stream
 */
class CSVParserTransform extends Transform {
  constructor(options = {}) {
    super({ objectMode: true });
    
    this.delimiter = options.delimiter || ',';
    this.hasHeader = options.hasHeader !== false;
    this.encoding = options.encoding || 'utf8';
    
    this.headers = [];
    this.rowIndex = 0;
    this.buffer = '';
    this.headerParsed = false;
    this.totalRows = 0;
    this.validRows = 0;
    this.errors = [];
    
    // Progress tracking
    this.bytesProcessed = 0;
    this.fileSize = options.fileSize || 0;
    this.onProgress = options.onProgress || (() => {});
  }
  
  _transform(chunk, encoding, callback) {
    try {
      this.bytesProcessed += chunk.length;
      this.buffer += chunk.toString(this.encoding);
      
      // Split by lines, keeping incomplete line in buffer
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        this._processLine(line.trim());
      }
      
      // Report progress
      if (this.fileSize > 0) {
        const progress = (this.bytesProcessed / this.fileSize) * 100;
        this.onProgress(Math.min(progress, 100), this.totalRows, this.validRows);
      }
      
      callback();
    } catch (error) {
      callback(error);
    }
  }
  
  _flush(callback) {
    try {
      // Process any remaining data in buffer
      if (this.buffer.trim()) {
        this._processLine(this.buffer.trim());
      }
      
      // Final progress report
      this.onProgress(100, this.totalRows, this.validRows);
      
      callback();
    } catch (error) {
      callback(error);
    }
  }
  
  _processLine(line) {
    if (!line) return;
    
    this.rowIndex++;
    
    // Parse header row
    if (this.hasHeader && !this.headerParsed) {
      this.headers = this._parseLine(line);
      this.headerParsed = true;
      return;
    }
    
    // If no header, generate column names
    if (!this.hasHeader && this.headers.length === 0) {
      const values = this._parseLine(line);
      this.headers = values.map((_, i) => `column_${i + 1}`);
    }
    
    try {
      const values = this._parseLine(line);
      const row = this._createRowObject(values);
      
      // Validate row
      if (this._validateRow(row)) {
        this.validRows++;
        this.push(row);
      }
      
      this.totalRows++;
    } catch (error) {
      this.errors.push({
        row: this.rowIndex,
        error: error.message,
        line: line.substring(0, 100) + '...'
      });
    }
  }
  
  _parseLine(line) {
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
      } else if (char === this.delimiter && !inQuotes) {
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
  
  _createRowObject(values) {
    const row = {};
    
    this.headers.forEach((header, index) => {
      const value = values[index] || null;
      row[header] = value === '' ? null : value;
    });
    
    row._rowIndex = this.rowIndex;
    return row;
  }
  
  _validateRow(row) {
    // Check for completely empty rows
    const hasData = Object.values(row).some(val => 
      val !== null && val !== '' && val !== '_rowIndex'
    );
    
    return hasData;
  }
  
  getStats() {
    return {
      totalRows: this.totalRows,
      validRows: this.validRows,
      headers: this.headers,
      errors: this.errors,
      bytesProcessed: this.bytesProcessed
    };
  }
}

/**
 * Stream-based CSV parsing for large files
 * @param {string} filePath - Path to CSV file
 * @param {Object} options - Parsing options
 * @returns {Promise<Object>} - Parsed data and statistics
 */
export async function parseCSVStreaming(filePath, options = {}) {
  try {
    // Get file size for progress tracking
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Prepare options
    const parserOptions = {
      delimiter: options.delimiter || ',',
      hasHeader: options.hasHeader !== false,
      encoding: options.encoding || 'utf8',
      fileSize,
      onProgress: options.onProgress || (() => {})
    };
    
    // Create parser transform stream
    const parser = new CSVParserTransform(parserOptions);
    
    // Storage for parsed data
    const data = [];
    const chunkSize = options.chunkSize || 1000;
    let currentChunk = [];
    
    // Data collection transform
    const collector = new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        currentChunk.push(row);
        
        // Process in chunks to manage memory
        if (currentChunk.length >= chunkSize) {
          data.push(...currentChunk);
          currentChunk = [];
          
          // Allow garbage collection
          if (global.gc) {
            global.gc();
          }
        }
        
        callback();
      },
      
      flush(callback) {
        // Add remaining rows
        if (currentChunk.length > 0) {
          data.push(...currentChunk);
        }
        callback();
      }
    });
    
    // Create read stream and process
    const readStream = createReadStream(filePath, { encoding: parserOptions.encoding });
    
    await pipeline(
      readStream,
      parser,
      collector
    );
    
    // Get final statistics
    const finalStats = parser.getStats();
    
    return createSuccessResponse(
      {
        filePath,
        headers: finalStats.headers,
        data,
        streaming: true
      },
      {
        totalRows: finalStats.totalRows,
        validRows: finalStats.validRows,
        columns: finalStats.headers.length,
        delimiter: parserOptions.delimiter,
        hasHeader: parserOptions.hasHeader,
        encoding: parserOptions.encoding,
        fileSize,
        bytesProcessed: finalStats.bytesProcessed,
        errors: finalStats.errors,
        processingMethod: 'streaming'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'STREAM_001',
      'Streaming CSV parsing failed',
      { 
        filePath, 
        originalError: error.message,
        processingMethod: 'streaming'
      }
    );
  }
}

/**
 * Progress tracking wrapper for streaming operations
 */
export class StreamingProgressTracker {
  constructor(totalSize = 0) {
    this.totalSize = totalSize;
    this.processedSize = 0;
    this.startTime = Date.now();
    this.lastUpdate = 0;
    this.listeners = [];
  }
  
  onProgress(callback) {
    this.listeners.push(callback);
  }
  
  update(processedSize, rowCount = 0, validCount = 0) {
    this.processedSize = processedSize;
    const now = Date.now();
    
    // Throttle updates to every 100ms
    if (now - this.lastUpdate < 100) {
      return;
    }
    
    this.lastUpdate = now;
    
    const progress = this.totalSize > 0 ? 
      Math.min((processedSize / this.totalSize) * 100, 100) : 0;
    
    const elapsed = now - this.startTime;
    const rate = processedSize / elapsed * 1000; // bytes per second
    const eta = this.totalSize > 0 && rate > 0 ? 
      (this.totalSize - processedSize) / rate : 0;
    
    const progressInfo = {
      percentage: parseFloat(progress.toFixed(2)),
      processedBytes: processedSize,
      totalBytes: this.totalSize,
      rowsProcessed: rowCount,
      validRows: validCount,
      elapsedMs: elapsed,
      processingRate: parseFloat((rate / 1024).toFixed(2)), // KB/s
      estimatedTimeRemainingMs: eta > 0 ? Math.ceil(eta) : null
    };
    
    this.listeners.forEach(listener => {
      try {
        listener(progressInfo);
      } catch (error) {
        console.warn('Progress listener error:', error.message);
      }
    });
  }
  
  complete() {
    this.update(this.totalSize);
  }
}

/**
 * Memory-efficient data transformation for large datasets
 * @param {Array} data - Input data array
 * @param {Array} operations - Transformation operations
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Transformation result
 */
export async function transformDataStreaming(data, operations, options = {}) {
  try {
    const chunkSize = options.chunkSize || 1000;
    const progressTracker = new StreamingProgressTracker(data.length);
    
    if (options.onProgress) {
      progressTracker.onProgress(options.onProgress);
    }
    
    let transformedData = [];
    const appliedOperations = [];
    
    // Process operations in chunks to manage memory
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      let transformedChunk = [...chunk];
      
      // Apply operations to chunk
      for (const operation of operations) {
        transformedChunk = await applyOperationToChunk(transformedChunk, operation);
      }
      
      transformedData.push(...transformedChunk);
      
      // Update progress
      progressTracker.update(i + chunk.length, i + chunk.length, transformedChunk.length);
      
      // Allow garbage collection
      if (global.gc && i % (chunkSize * 10) === 0) {
        global.gc();
      }
    }
    
    // Record applied operations
    operations.forEach(op => {
      appliedOperations.push(getOperationDescription(op));
    });
    
    progressTracker.complete();
    
    return createSuccessResponse(
      {
        transformedData,
        appliedOperations,
        streaming: true
      },
      {
        originalCount: data.length,
        transformedCount: transformedData.length,
        processingMethod: 'streaming',
        chunkSize
      }
    );
  } catch (error) {
    return createErrorResponse(
      'STREAM_002',
      'Streaming data transformation failed',
      { originalError: error.message }
    );
  }
}

/**
 * Apply single operation to data chunk
 * @param {Array} chunk - Data chunk
 * @param {Object} operation - Operation to apply
 * @returns {Promise<Array>} - Transformed chunk
 */
async function applyOperationToChunk(chunk, operation) {
  const { type, column, value, condition, order } = operation;
  
  switch (type) {
  case 'filter':
    if (condition) {
      return chunk.filter(row => {
        try {
          const evalCondition = condition.replace(/{{(.*?)}}/g, (match, col) => {
            return JSON.stringify(row[col] || '');
          });
          return eval(evalCondition);
        } catch (e) {
          return true; // Keep row if condition fails
        }
      });
    }
    break;
      
  case 'map':
    if (column && value) {
      return chunk.map(row => ({
        ...row,
        [column]: value.replace(/{{(.*?)}}/g, (match, col) => row[col] || '')
      }));
    }
    break;
      
  case 'sort':
    if (column) {
      return [...chunk].sort((a, b) => {
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
    }
    break;
      
  case 'aggregate':
    // Aggregation returns summary, not transformed data
    if (column) {
      const numericValues = chunk
        .map(row => parseFloat(row[column]))
        .filter(val => !isNaN(val));
        
      return [{
        column,
        count: numericValues.length,
        sum: numericValues.reduce((a, b) => a + b, 0),
        avg: numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0,
        min: numericValues.length > 0 ? Math.min(...numericValues) : null,
        max: numericValues.length > 0 ? Math.max(...numericValues) : null
      }];
    }
    break;
      
  default:
    return chunk;
  }
  
  return chunk;
}

/**
 * Get human-readable description of operation
 * @param {Object} operation - Operation object
 * @returns {string} - Operation description
 */
function getOperationDescription(operation) {
  const { type, column, value, condition, order } = operation;
  
  switch (type) {
  case 'filter':
    return `Filtered rows by: ${condition}`;
  case 'map':
    return `Mapped column ${column}: ${value}`;
  case 'sort':
    return `Sorted by ${column} (${order || 'asc'})`;
  case 'aggregate':
    return `Aggregated column ${column}`;
  default:
    return `Applied ${type} operation`;
  }
}

export default {
  parseCSVStreaming,
  transformDataStreaming,
  StreamingProgressTracker,
  CSVParserTransform
};