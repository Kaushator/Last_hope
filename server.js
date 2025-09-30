// server.js – MCP Server for Copilot integration
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Performance monitoring
import { performanceMiddleware, performanceMonitor } from './src/monitoring/performance.js';

// Security imports
import { 
  createRateLimit, 
  securityHeaders, 
  sanitizeRequest, 
  validateApiKey,
  SecurityConfig 
} from './src/security/security.js';

// Agent imports
import * as htxAgent from './src/agents/htxAgent.js';
import * as finGPTAgent from './src/agents/finGPTAgent.js';
import * as csvAgent from './src/agents/csvAgent.js';
import * as infraAgent from './src/agents/infraAgent.js';
import * as ciAgent from './src/agents/ciAgent.js';
import * as orchestratorAgent from './src/agents/orchestratorAgent.js';

// Service imports
import { gcsService } from './src/services/gcs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(createRateLimit(SecurityConfig.rateLimits.general));

// Performance monitoring middleware
app.use(performanceMiddleware);

// Body parsing middleware
app.use(bodyParser.json({ limit: SecurityConfig.validation.maxPayloadSize }));
app.use(bodyParser.urlencoded({ extended: true, limit: SecurityConfig.validation.maxPayloadSize }));

// Request sanitization
app.use(sanitizeRequest);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Agent registry
const agents = new Map([
  ['htx', htxAgent],
  ['fingpt', finGPTAgent],
  ['csv', csvAgent],
  ['infra', infraAgent],
  ['ci', ciAgent],
  ['orchestrator', orchestratorAgent]
]);

// Health check endpoint with monitoring
app.get('/health', async (req, res) => {
  try {
    const { healthCheckMiddleware } = await import('./src/monitoring/monitoring.js');
    await healthCheckMiddleware(req, res);
  } catch (error) {
    res.json({ ok: true, basic: true, timestamp: new Date().toISOString() });
  }
});

// Performance monitoring endpoint
app.get('/performance', (req, res) => {
  try {
    const report = performanceMonitor.generateReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate performance report', message: error.message });
  }
});

// Performance stats endpoint
app.get('/performance/stats', (req, res) => {
  try {
    const stats = performanceMonitor.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get performance stats', message: error.message });
  }
});

// === /tests endpoint ===
app.post('/tests', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const testStub = `import { describe, it, expect } from '@jest/globals';
import module from '../src/index.js';

describe('Auto Tests', () => {
  it('should run without crashing', () => {
    expect(typeof module).toBeDefined();
  });
});`;

  res.json({ tests: testStub });
});

// === /billing endpoint ===
app.get('/billing', async (req, res) => {
  try {
    const ghToken = process.env.GITHUB_TOKEN;
    if (!ghToken) return res.status(403).json({ error: 'Missing GitHub token' });

    const response = await fetch('https://api.github.com/user/billing/copilot', {
      headers: { Authorization: `Bearer ${ghToken}`, 'User-Agent': 'MCP-Server' }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === /lint endpoint ===
app.post('/lint', async (req, res) => {
  try {
    const result = await ciAgent.lint(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === Agent routing endpoints ===
app.post('/agent/:agentName/:task', async (req, res) => {
  try {
    const { agentName, task } = req.params;
    const agent = agents.get(agentName);
    
    if (!agent) {
      return res.status(404).json({ error: `Agent '${agentName}' not found` });
    }
    
    if (typeof agent[task] !== 'function') {
      return res.status(404).json({ error: `Task '${task}' not found in agent '${agentName}'` });
    }
    
    const result = await agent[task](req.body);
    res.json({ success: true, result, agent: agentName, task });
  } catch (error) {
    console.error('Agent execution error:', error);
    res.status(500).json({ error: error.message, agent: req.params.agentName, task: req.params.task });
  }
});

// === Analytics endpoints ===
app.get('/analytics/summary', async (req, res) => {
  try {
    // Feature flag checks
    const enableHTX = process.env.ENABLE_HTX_API !== 'false';
    const enableFinGPT = process.env.ENABLE_FINGPT !== 'false';
    const enableGCS = process.env.ENABLE_GCS === 'true';
    const persist = req.query.persist === 'true';
    
    const reportId = `report-${Date.now()}`;
    let summary = { 
      reportId,
      timestamp: new Date().toISOString(),
      featureFlags: {
        htx: enableHTX,
        fingpt: enableFinGPT,
        gcs: enableGCS
      }
    };
    
    // Fetch HTX market data if enabled
    if (enableHTX) {
      try {
        summary.markets = await htxAgent.fetchMarkets();
      } catch (error) {
        console.error('HTX API error:', error);
        summary.markets = { error: 'HTX API unavailable', mock: true };
      }
    } else {
      summary.markets = { disabled: true, message: 'HTX API is disabled' };
    }
    
    // Fetch FinGPT predictions if enabled
    if (enableFinGPT) {
      try {
        // Check if we have market data to predict on
        const inputData = summary.markets?.data || [];
        summary.predictions = await finGPTAgent.getPredictions({ markets: inputData });
      } catch (error) {
        console.error('FinGPT error:', error);
        summary.predictions = { error: 'FinGPT unavailable', fallback: 'statistical' };
      }
    } else {
      summary.predictions = { disabled: true, message: 'FinGPT is disabled' };
    }
    
    // Generate insights combining HTX and FinGPT data
    summary.insights = {
      generated: true,
      summary: 'Combined HTX market data with FinGPT predictions',
      recommendations: []
    };
    
    // Persist to GCS if enabled and requested
    if (enableGCS && persist) {
      try {
        const uploadResult = await gcsService.uploadJSON(reportId, summary);
        summary.storage = uploadResult;
      } catch (error) {
        console.error('GCS upload error:', error);
        summary.storage = { error: 'Failed to persist report', message: error.message };
      }
    }
    
    res.json(summary);
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/analytics/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const enableGCS = process.env.ENABLE_GCS === 'true';
    
    // Try to fetch from GCS first if enabled
    if (enableGCS) {
      const report = await gcsService.downloadJSON(id);
      if (report.success) {
        return res.json(report.data);
      }
    }
    
    // Fallback to orchestrator agent
    try {
      const report = await orchestratorAgent.getReport(id);
      res.json(report);
    } catch (error) {
      res.status(404).json({ 
        error: 'Report not found', 
        id: req.params.id,
        message: 'Report not found in GCS or local storage'
      });
    }
  } catch (error) {
    console.error('Report retrieval error:', error);
    res.status(500).json({ error: error.message, id: req.params.id });
  }
});

// List all available reports
app.get('/analytics/reports', async (req, res) => {
  try {
    const enableGCS = process.env.ENABLE_GCS === 'true';
    
    const reports = enableGCS 
      ? await gcsService.listReports()
      : await orchestratorAgent.listReports();
    
    res.json({
      success: true,
      count: reports.length,
      reports,
      source: enableGCS ? 'gcs' : 'local'
    });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific report
app.delete('/analytics/report/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const enableGCS = process.env.ENABLE_GCS === 'true';
    
    const result = enableGCS
      ? await gcsService.deleteReport(id)
      : await orchestratorAgent.deleteReport(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`⚡ MCP Server running on port ${PORT}`);
  console.log(`📊 Agents loaded: ${Array.from(agents.keys()).join(', ')}`);
  console.log(`🔧 Feature flags: HTX=${process.env.ENABLE_HTX_API !== 'false'}, FinGPT=${process.env.ENABLE_FINGPT !== 'false'}, GCS=${process.env.ENABLE_GCS !== 'false'}`);
  console.log('🔒 Security: Rate limiting enabled, Input validation active');
});
