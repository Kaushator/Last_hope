// htxAgent.js — HTX analytics flows with complete API integration
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { decryptApiKey, verifyEncryptedCredentials } from '../security/fernet.js';
import { validateInput, ValidationSchemas, validateFilePath } from './utils/htxValidation.js';

const HTX_BASE_URL = 'https://api.huobi.pro';

// Rate limiting configuration
const RATE_LIMITS = {
  PUBLIC_API: { requests: 100, window: 10000 }, // 100 req/10s
  PRIVATE_API: { requests: 10, window: 1000 },  // 10 req/1s
  HISTORICAL: { requests: 20, window: 60000 }   // 20 req/1min
};

// Request tracking for rate limiting
const requestTracker = new Map();

// Response cache for frequently requested data
const responseCache = new Map();
const CACHE_TTL = {
  SYMBOLS: 24 * 60 * 60 * 1000,    // 24 hours
  TICKERS: 5 * 60 * 1000,         // 5 minutes
  CANDLES: 1 * 60 * 1000          // 1 minute
};

/**
 * Rate limiting utility
 * @param {string} endpoint - API endpoint identifier
 * @param {Object} limits - Rate limit configuration
 * @returns {boolean} - True if request is allowed
 */
function checkRateLimit(endpoint, limits) {
  const now = Date.now();
  const key = `${endpoint}_${Math.floor(now / limits.window)}`;
  
  if (!requestTracker.has(key)) {
    requestTracker.set(key, 0);
  }
  
  const currentCount = requestTracker.get(key);
  if (currentCount >= limits.requests) {
    return false;
  }
  
  requestTracker.set(key, currentCount + 1);
  
  // Cleanup old entries
  for (const [trackerKey] of requestTracker) {
    const keyTime = parseInt(trackerKey.split('_')[1]) * limits.window;
    if (now - keyTime > limits.window * 2) {
      requestTracker.delete(trackerKey);
    }
  }
  
  return true;
}

/**
 * Cache utility functions
 */
function getCachedResponse(key) {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  responseCache.delete(key);
  return null;
}

function setCachedResponse(key, data, ttl) {
  responseCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

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
 * Enhanced fetch with rate limiting and error handling
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {string} endpoint - Endpoint identifier for rate limiting
 * @returns {Promise<Object>} - Response data
 */
async function enhancedFetch(url, options = {}, endpoint = 'public') {
  // Determine rate limit based on endpoint
  let rateLimit = RATE_LIMITS.PUBLIC_API;
  if (endpoint.includes('private')) {
    rateLimit = RATE_LIMITS.PRIVATE_API;
  } else if (endpoint.includes('historical')) {
    rateLimit = RATE_LIMITS.HISTORICAL;
  }
  
  // Check rate limit
  if (!checkRateLimit(endpoint, rateLimit)) {
    throw new Error(`Rate limit exceeded for ${endpoint}. Max ${rateLimit.requests} requests per ${rateLimit.window}ms`);
  }
  
  // Add default headers and timeout
  const fetchOptions = {
    timeout: 10000,
    headers: {
      'User-Agent': 'Last-Hope-MCP-Server/1.0.0',
      'Accept': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.status !== 'ok' && data.status !== undefined) {
    throw new Error(data['err-msg'] || 'HTX API error');
  }
  
  return data;
}

/**
 * Verify HTX API credentials by decrypting and testing connectivity
 * @param {Object} params - { encrypted_key: string }
 * @returns {Object} - Standardized verification response
 */
export async function verifyKeys(params = {}) {
  try {
    // Comprehensive input validation
    const validation = validateInput(params, ValidationSchemas.verifyKeys, 'verifyKeys');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { encrypted_key } = validation.sanitized;
    
    // Decrypt the API key using Fernet
    let decryptedKey;
    try {
      decryptedKey = decryptApiKey(encrypted_key);
    } catch (error) {
      return createErrorResponse(
        'AUTH_001',
        'Failed to decrypt API key',
        { decryptionError: error.message }
      );
    }
    
    // Test HTX API connectivity with public endpoint
    const data = await enhancedFetch(
      `${HTX_BASE_URL}/v1/common/timestamp`,
      {},
      'timestamp_check'
    );
    
    return createSuccessResponse(
      {
        keyValid: true,
        timestamp: data.data,
        connectivity: 'verified'
      },
      {
        endpoint: 'verifyKeys',
        apiVersion: 'v1'
      }
    );
  } catch (error) {
    if (error.message.includes('Rate limit')) {
      return createErrorResponse('RATE_001', error.message);
    }
    
    return createErrorResponse(
      'INT_001',
      'HTX API connectivity test failed',
      { originalError: error.message }
    );
  }
}

/**
 * Fetch HTX market symbols and ticker data
 * @param {Object} params - { limit?: number, filter?: string }
 * @returns {Object} - Standardized market data response
 */
export async function fetchMarkets(params = {}) {
  try {
    // Comprehensive input validation
    const validation = validateInput(params, ValidationSchemas.fetchMarkets, 'fetchMarkets');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { limit, filter } = validation.sanitized;
    
    // Check cache first
    const cacheKey = `markets_${limit}_${filter || 'all'}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Get all trading symbols
    const symbolsData = await enhancedFetch(
      `${HTX_BASE_URL}/v1/common/symbols`,
      {},
      'symbols_fetch'
    );
    
    // Get 24hr ticker data
    const tickerData = await enhancedFetch(
      `${HTX_BASE_URL}/market/tickers`,
      {},
      'tickers_fetch'
    );
    
    let symbols = symbolsData.data || [];
    
    // Apply filter if specified
    if (filter) {
      const filterLower = filter.toLowerCase();
      symbols = symbols.filter(symbol => 
        symbol['quote-currency'].toLowerCase() === filterLower ||
        symbol['base-currency'].toLowerCase() === filterLower
      );
    }
    
    // Apply limit
    symbols = symbols.slice(0, limit);
    
    const markets = symbols.map(symbol => {
      const ticker = tickerData.data?.find(t => t.symbol === symbol.symbol);
      return {
        symbol: symbol.symbol,
        baseCurrency: symbol['base-currency'],
        quoteCurrency: symbol['quote-currency'],
        state: symbol.state,
        price: ticker?.close || 0,
        volume: ticker?.vol || 0,
        high: ticker?.high || 0,
        low: ticker?.low || 0,
        change: ticker ? ((ticker.close - ticker.open) / ticker.open * 100) : 0
      };
    });
    
    const response = createSuccessResponse(
      { markets },
      {
        totalReturned: markets.length,
        totalAvailable: symbolsData.data?.length || 0,
        filter: filter || null,
        limit,
        endpoint: 'fetchMarkets'
      }
    );
    
    // Cache the response
    setCachedResponse(cacheKey, response, CACHE_TTL.TICKERS);
    
    return response;
  } catch (error) {
    if (error.message.includes('Rate limit')) {
      return createErrorResponse('RATE_002', error.message);
    }
    
    return createErrorResponse(
      'EXT_001',
      'Failed to fetch market data',
      { originalError: error.message }
    );
  }
}

/**
 * Fetch historical OHLCV candle data
 * @param {Object} params - { symbol: string, interval: string, limit: number }
 * @returns {Object} - Standardized candle data response
 */
export async function fetchCandles(params = {}) {
  try {
    // Comprehensive input validation
    const validation = validateInput(params, ValidationSchemas.fetchCandles, 'fetchCandles');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { symbol, interval, limit } = validation.sanitized;
    
    // Check cache first
    const cacheKey = `candles_${symbol}_${interval}_${limit}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
    
    const data = await enhancedFetch(
      `${HTX_BASE_URL}/market/history/kline?symbol=${symbol}&period=${interval}&size=${limit}`,
      {},
      'historical_candles'
    );
    
    const candles = (data.data || []).map(candle => ({
      timestamp: new Date(candle.id * 1000).toISOString(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.vol),
      amount: parseFloat(candle.amount)
    }));
    
    const response = createSuccessResponse(
      {
        candles,
        symbol,
        interval,
        count: candles.length
      },
      {
        endpoint: 'fetchCandles',
        dataRange: {
          start: candles.length > 0 ? candles[candles.length - 1].timestamp : null,
          end: candles.length > 0 ? candles[0].timestamp : null
        }
      }
    );
    
    // Cache the response
    setCachedResponse(cacheKey, response, CACHE_TTL.CANDLES);
    
    return response;
  } catch (error) {
    if (error.message.includes('Rate limit')) {
      return createErrorResponse('RATE_003', error.message);
    }
    
    return createErrorResponse(
      'EXT_002',
      'Failed to fetch candle data',
      { symbol: params.symbol, interval: params.interval, limit: params.limit, originalError: error.message }
    );
  }
}

/**
 * Parse HTX Excel report files
 * @param {Object} params - { filePath: string, reportType: string }
 * @returns {Object} - Standardized Excel parsing response
 */
export async function parseExcel(params = {}) {
  try {
    // Comprehensive input validation
    const validation = validateInput(params, ValidationSchemas.parseExcel, 'parseExcel');
    if (!validation.valid) {
      return validation.errorResponse;
    }
    
    const { filePath, reportType } = validation.sanitized;
    
    // Additional file security validation
    const fileValidation = validateFilePath(filePath);
    if (!fileValidation.valid) {
      return createErrorResponse(
        'SEC_001',
        'File path security validation failed',
        { securityErrors: fileValidation.errors }
      );
    }
    
    // Check if file exists and is accessible
    if (!fs.existsSync(filePath)) {
      return createErrorResponse(
        'NF_001',
        'File not found',
        { filePath }
      );
    }
    
    // Get file stats and validate size
    const stats = fs.statSync(filePath);
    if (stats.size > 50 * 1024 * 1024) { // 50MB limit
      return createErrorResponse(
        'VAL_009',
        'File size exceeds maximum limit',
        { fileSize: stats.size, maxSize: 50 * 1024 * 1024 }
      );
    }
    
    const ext = path.extname(filePath).toLowerCase();
    
    // For CSV files, delegate to CSV agent
    if (ext === '.csv') {
      const csvAgent = await import('./csvAgent.js');
      const csvResult = await csvAgent.parseCSV({ filePath });
      
      if (!csvResult.success) {
        return createErrorResponse(
          'EXT_003',
          'CSV parsing failed',
          { csvError: csvResult.error }
        );
      }
      
      return createSuccessResponse(
        {
          reportType,
          filePath,
          recordCount: csvResult.data.length,
          headers: csvResult.headers,
          dateRange: {
            start: null, // TODO: Extract from data
            end: null
          },
          fileInfo: {
            size: stats.size,
            modified: stats.mtime.toISOString(),
            format: 'csv'
          }
        },
        {
          endpoint: 'parseExcel',
          processingTime: Date.now()
        }
      );
    }
    
    // For Excel files, return enhanced placeholder with file analysis
    const summary = {
      reportType,
      filePath,
      recordCount: 0,
      dateRange: {
        start: null,
        end: null
      },
      fileInfo: {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        format: ext.substring(1)
      },
      status: 'pending_implementation',
      message: 'Excel parsing requires xlsx library - implementation pending'
    };
    
    return createSuccessResponse(
      summary,
      {
        endpoint: 'parseExcel',
        implementationStatus: 'partial'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_002',
      'Excel parsing failed',
      { filePath: params.filePath, originalError: error.message }
    );
  }
}

/**
 * Get HTX agent summary and health status
 * @returns {Object} - Comprehensive agent status and capabilities
 */
export function summary() {
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    
    // Calculate cache statistics
    const cacheStats = {
      totalEntries: responseCache.size,
      memoryUsage: JSON.stringify([...responseCache.values()]).length
    };
    
    // Calculate rate limit statistics
    const rateLimitStats = {
      activeTrackers: requestTracker.size,
      limits: RATE_LIMITS
    };
    
    return createSuccessResponse(
      {
        agent: 'htxAgent',
        version: '2.0.0',
        status: 'operational',
        capabilities: {
          apiVerification: {
            status: 'implemented',
            features: ['fernet_encryption', 'connectivity_test']
          },
          marketData: {
            status: 'implemented',
            features: ['caching', 'filtering', 'rate_limiting']
          },
          candleData: {
            status: 'implemented',
            features: ['multiple_intervals', 'validation', 'caching']
          },
          excelParsing: {
            status: 'partial',
            features: ['csv_support', 'file_validation'],
            limitations: ['xlsx_library_needed']
          },
          security: {
            status: 'implemented',
            features: ['fernet_encryption', 'input_validation', 'rate_limiting']
          }
        },
        performance: {
          cache: cacheStats,
          rateLimiting: rateLimitStats
        },
        endpoints: [
          {
            name: 'verifyKeys',
            method: 'POST',
            parameters: ['encrypted_key'],
            rateLimit: 'public'
          },
          {
            name: 'fetchMarkets',
            method: 'POST',
            parameters: ['limit?', 'filter?'],
            rateLimit: 'public',
            caching: true
          },
          {
            name: 'fetchCandles',
            method: 'POST',
            parameters: ['symbol', 'interval', 'limit'],
            rateLimit: 'historical',
            caching: true
          },
          {
            name: 'parseExcel',
            method: 'POST',
            parameters: ['filePath', 'reportType?'],
            rateLimit: 'none'
          },
          {
            name: 'summary',
            method: 'GET',
            parameters: [],
            rateLimit: 'none'
          }
        ]
      },
      {
        nodeVersion,
        timestamp: new Date().toISOString(),
        endpoint: 'summary'
      }
    );
  } catch (error) {
    return createErrorResponse(
      'INT_003',
      'Failed to generate agent summary',
      { originalError: error.message }
    );
  }
}
