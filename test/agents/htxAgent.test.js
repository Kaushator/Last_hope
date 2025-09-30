// test/agents/htxAgent.test.js - HTX Agent unit tests
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as htxAgent from '../../src/agents/htxAgent.js';
import { testUtils } from '../setup.js';

// Mock the security module
jest.mock('../../src/security/fernet.js', () => ({
  decryptApiKey: jest.fn(() => 'test-api-key'),
  verifyEncryptedCredentials: jest.fn(() => true)
}));

// Mock fetch
global.fetch = jest.fn();

describe('HTX Agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyKeys', () => {
    it('should verify encrypted API key successfully', async () => {
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok', data: 1640995200 })
      });

      const result = await htxAgent.verifyKeys({
        encrypted_key: testUtils.createMockEncryptedKey()
      });

      expect(result.ok).toBe(true);
      expect(result.message).toContain('HTX API connectivity verified');
      expect(result.keyValid).toBe(true);
    });

    it('should fail when encrypted_key is missing', async () => {
      const result = await htxAgent.verifyKeys({});

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Missing encrypted_key parameter');
    });

    it('should handle HTX API errors', async () => {
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'error', message: 'API error' })
      });

      const result = await htxAgent.verifyKeys({
        encrypted_key: testUtils.createMockEncryptedKey()
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('HTX API connectivity failed');
    });
  });

  describe('fetchMarkets', () => {
    it('should fetch and process market data', async () => {
      const mockSymbols = {
        status: 'ok',
        data: [
          { symbol: 'btcusdt', 'base-currency': 'btc', 'quote-currency': 'usdt', state: 'online' },
          { symbol: 'ethusdt', 'base-currency': 'eth', 'quote-currency': 'usdt', state: 'online' }
        ]
      };

      const mockTickers = {
        status: 'ok',
        data: [
          { symbol: 'btcusdt', close: 45000, vol: 1000, high: 46000, low: 44000, open: 45500 },
          { symbol: 'ethusdt', close: 3000, vol: 500, high: 3100, low: 2900, open: 3050 }
        ]
      };

      fetch
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockSymbols) })
        .mockResolvedValueOnce({ json: () => Promise.resolve(mockTickers) });

      const result = await htxAgent.fetchMarkets();

      expect(result.markets).toBeDefined();
      expect(result.markets.length).toBe(2);
      expect(result.markets[0]).toMatchObject({
        symbol: 'btcusdt',
        baseCurrency: 'btc',
        quoteCurrency: 'usdt',
        price: 45000
      });
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await htxAgent.fetchMarkets();

      expect(result.error).toContain('Network error');
      expect(result.markets).toEqual([]);
    });
  });

  describe('fetchCandles', () => {
    it('should fetch candle data for a symbol', async () => {
      const mockCandles = {
        status: 'ok',
        data: [
          { id: 1640995200, open: 45000, high: 46000, low: 44000, close: 45500, vol: 100, amount: 4550000 },
          { id: 1640991600, open: 44500, high: 45500, low: 44000, close: 45000, vol: 150, amount: 6750000 }
        ]
      };

      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockCandles)
      });

      const result = await htxAgent.fetchCandles({
        symbol: 'btcusdt',
        interval: '1hour',
        limit: 2
      });

      expect(result.candles).toBeDefined();
      expect(result.candles.length).toBe(2);
      expect(result.symbol).toBe('btcusdt');
      expect(result.candles[0]).toMatchObject({
        open: 45000,
        high: 46000,
        low: 44000,
        close: 45500,
        volume: 100
      });
    });

    it('should handle invalid symbol errors', async () => {
      const mockError = {
        status: 'error',
        'err-msg': 'invalid symbol'
      };

      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockError)
      });

      const result = await htxAgent.fetchCandles({ symbol: 'invalid' });

      expect(result.error).toContain('invalid symbol');
      expect(result.candles).toEqual([]);
    });
  });

  describe('parseExcel', () => {
    it('should return placeholder response for Excel parsing', async () => {
      const result = await htxAgent.parseExcel({
        filePath: 'test.xlsx',
        reportType: 'trades'
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.reportType).toBe('trades');
      expect(result.summary.message).toContain('Excel parsing not yet implemented');
    });

    it('should handle missing file path', async () => {
      const result = await htxAgent.parseExcel({ filePath: 'nonexistent.xlsx' });

      expect(result.error).toContain('File not found');
      expect(result.summary).toBeNull();
    });
  });

  describe('summary', () => {
    it('should return agent summary information', () => {
      const result = htxAgent.summary();

      expect(result.agent).toBe('htxAgent');
      expect(result.status).toBe('operational');
      expect(result.features).toBeDefined();
      expect(result.endpoints).toContain('verifyKeys');
      expect(result.endpoints).toContain('fetchMarkets');
      expect(result.endpoints).toContain('fetchCandles');
    });
  });
});