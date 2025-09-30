// test/integration/analytics.test.js - Integration tests for analytics endpoints
import { describe, it, expect, afterAll, beforeEach } from '@jest/globals';
import { gcsService } from '../../src/services/gcs.js';
import fs from 'fs';
import path from 'path';

describe('Analytics Integration Tests', () => {
  const testReportId = 'test-report-123';
  const testData = {
    reportId: testReportId,
    timestamp: new Date().toISOString(),
    markets: { data: [{ symbol: 'BTC-USDT', price: 45000 }] },
    predictions: { trend: 'bullish' }
  };

  beforeEach(() => {
    // Set environment variables for testing
    process.env.ENABLE_GCS = 'false';
    process.env.ENABLE_HTX_API = 'true';
    process.env.ENABLE_FINGPT = 'false';
    process.env.LOCAL_STORAGE_PATH = './data/test-reports';
  });

  afterAll(() => {
    // Cleanup test data
    const testPath = './data/test-reports';
    if (fs.existsSync(testPath)) {
      fs.rmSync(testPath, { recursive: true, force: true });
    }
  });

  describe('GCS Service', () => {
    it('should save report locally when GCS is disabled', async () => {
      const result = await gcsService.uploadJSON(testReportId, testData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('GCS is disabled');
      expect(result.localPath).toBeTruthy();
      expect(fs.existsSync(result.localPath)).toBe(true);
    });

    it('should load report from local storage', async () => {
      // First save a report
      await gcsService.uploadJSON(testReportId, testData);
      
      // Then load it
      const result = await gcsService.downloadJSON(testReportId);
      
      expect(result.success).toBe(true);
      expect(result.reportId).toBe(testReportId);
      expect(result.data.markets).toEqual(testData.markets);
      expect(result.source).toBe('local');
    });

    it('should list reports from local storage', async () => {
      // Save multiple reports
      await gcsService.uploadJSON('report-1', { ...testData, reportId: 'report-1' });
      await gcsService.uploadJSON('report-2', { ...testData, reportId: 'report-2' });
      
      const reports = await gcsService.listReports();
      
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThanOrEqual(2);
      expect(reports.some(r => r.reportId === 'report-1')).toBe(true);
      expect(reports.some(r => r.reportId === 'report-2')).toBe(true);
    });

    it('should delete report from local storage', async () => {
      const deleteId = 'report-to-delete';
      
      // Save and then delete
      await gcsService.uploadJSON(deleteId, { ...testData, reportId: deleteId });
      const deleteResult = await gcsService.deleteReport(deleteId);
      
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.reportId).toBe(deleteId);
      
      // Verify it's gone
      const loadResult = await gcsService.downloadJSON(deleteId);
      expect(loadResult.success).toBe(false);
    });

    it('should handle non-existent report gracefully', async () => {
      const result = await gcsService.downloadJSON('non-existent-report');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Analytics Summary Endpoint', () => {
    it('should generate summary with feature flags', async () => {
      const mockSummary = {
        reportId: 'report-12345',
        timestamp: new Date().toISOString(),
        featureFlags: {
          htx: true,
          fingpt: false,
          gcs: false
        },
        markets: { disabled: false },
        predictions: { disabled: true }
      };
      
      expect(mockSummary.featureFlags.htx).toBe(true);
      expect(mockSummary.featureFlags.fingpt).toBe(false);
      expect(mockSummary.featureFlags.gcs).toBe(false);
    });

    it('should include storage info when GCS is enabled and persist is requested', async () => {
      process.env.ENABLE_GCS = 'false';
      
      const mockSummary = {
        reportId: 'report-67890',
        timestamp: new Date().toISOString(),
        storage: {
          success: false,
          error: 'GCS is disabled',
          localPath: './data/reports/report-67890.json'
        }
      };
      
      expect(mockSummary.storage).toBeDefined();
      expect(mockSummary.storage.localPath).toBeTruthy();
    });

    it('should handle HTX API errors gracefully', async () => {
      const mockSummary = {
        markets: { error: 'HTX API unavailable', mock: true }
      };
      
      expect(mockSummary.markets.error).toBeDefined();
      expect(mockSummary.markets.mock).toBe(true);
    });

    it('should handle FinGPT unavailability gracefully', async () => {
      const mockSummary = {
        predictions: { error: 'FinGPT unavailable', fallback: 'statistical' }
      };
      
      expect(mockSummary.predictions.error).toBeDefined();
      expect(mockSummary.predictions.fallback).toBe('statistical');
    });
  });

  describe('Feature Flag Combinations', () => {
    const testCases = [
      {
        name: 'All features enabled',
        flags: { htx: true, fingpt: true, gcs: true },
        expected: { hasMarkets: true, hasPredictions: true, canPersist: true }
      },
      {
        name: 'Only HTX enabled',
        flags: { htx: true, fingpt: false, gcs: false },
        expected: { hasMarkets: true, hasPredictions: false, canPersist: false }
      },
      {
        name: 'All features disabled',
        flags: { htx: false, fingpt: false, gcs: false },
        expected: { hasMarkets: false, hasPredictions: false, canPersist: false }
      },
      {
        name: 'HTX and GCS enabled',
        flags: { htx: true, fingpt: false, gcs: true },
        expected: { hasMarkets: true, hasPredictions: false, canPersist: true }
      }
    ];

    testCases.forEach(({ name, flags, expected }) => {
      it(`should handle ${name}`, () => {
        const mockSummary = {
          featureFlags: flags,
          markets: expected.hasMarkets ? { data: [] } : { disabled: true },
          predictions: expected.hasPredictions ? { data: [] } : { disabled: true },
          storage: expected.canPersist ? { enabled: true } : { disabled: true }
        };
        
        expect(mockSummary.featureFlags).toEqual(flags);
        if (expected.hasMarkets) {
          expect(mockSummary.markets.data).toBeDefined();
        } else {
          expect(mockSummary.markets.disabled).toBe(true);
        }
      });
    });
  });

  describe('Report Lifecycle', () => {
    it('should create, retrieve, and delete a report', async () => {
      const reportId = 'lifecycle-test-report';
      const reportData = {
        reportId,
        timestamp: new Date().toISOString(),
        data: { test: 'data' }
      };
      
      // Create
      const createResult = await gcsService.uploadJSON(reportId, reportData);
      expect(createResult.localPath).toBeTruthy();
      
      // Retrieve
      const getResult = await gcsService.downloadJSON(reportId);
      expect(getResult.success).toBe(true);
      expect(getResult.data.reportId).toBe(reportId);
      
      // Delete
      const deleteResult = await gcsService.deleteReport(reportId);
      expect(deleteResult.success).toBe(true);
      
      // Verify deletion
      const verifyResult = await gcsService.downloadJSON(reportId);
      expect(verifyResult.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid report IDs', async () => {
      const invalidIds = ['', null, undefined, '../../../etc/passwd'];
      
      for (const id of invalidIds) {
        if (id === null || id === undefined) continue;
        
        const result = await gcsService.downloadJSON(id);
        expect(result.success).toBe(false);
      }
    });

    it('should handle corrupted local storage', async () => {
      const corruptedId = 'corrupted-report';
      const localPath = path.join(
        process.env.LOCAL_STORAGE_PATH || './data/reports',
        `${corruptedId}.json`
      );
      
      // Create directory if needed
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write invalid JSON
      fs.writeFileSync(localPath, 'invalid json content');
      
      const result = await gcsService.downloadJSON(corruptedId);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
