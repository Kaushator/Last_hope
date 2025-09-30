// test/setup.js - Test setup and utilities
import { jest } from '@jest/globals';
import fetch from 'node-fetch';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.ENABLE_HTX_API = 'true';
process.env.ENABLE_FINGPT = 'false';
process.env.ENABLE_GCS = 'false';

// Mock external dependencies
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: 'ok', data: Date.now() })
  })
);

// Test utilities
export const testUtils = {
  // Create mock request object
  createMockReq: (overrides = {}) => ({
    body: {},
    query: {},
    params: {},
    headers: {},
    ip: '127.0.0.1',
    get: jest.fn((header) => overrides.headers?.[header] || 'test-agent'),
    ...overrides
  }),

  // Create mock response object
  createMockRes: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      removeHeader: jest.fn().mockReturnThis()
    };
    return res;
  },

  // Create mock encrypted API key
  createMockEncryptedKey: () => 'gAAAAABhZ5K5TqG2Y3j8...' + Buffer.from('test-key').toString('base64'),

  // Wait for async operations
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate test data
  generateTestMarketData: (count = 5) => Array.from({ length: count }, (_, i) => ({
    symbol: `BTC${i}-USDT`,
    price: 45000 + (i * 1000),
    volume: 1000000 + (i * 100000),
    change: (Math.random() - 0.5) * 10
  })),

  generateTestCandleData: (count = 24) => Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - (i * 3600000)).toISOString(),
    open: 45000 + (Math.random() * 1000),
    high: 46000 + (Math.random() * 1000),
    low: 44000 + (Math.random() * 1000),
    close: 45000 + (Math.random() * 1000),
    volume: 100 + (Math.random() * 1000)
  })),

  // CSV test data
  generateTestCSV: () => [
    'name,age,email',
    'John Doe,30,john@example.com',
    'Jane Smith,25,jane@example.com',
    'Bob Johnson,35,bob@example.com'
  ].join('\n')
};

// Global test teardown
afterEach(() => {
  jest.clearAllMocks();
});