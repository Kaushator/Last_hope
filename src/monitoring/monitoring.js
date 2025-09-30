// src/monitoring/monitoring.js — Health checks, metrics, and observability with agent-specific monitoring
import os from 'os';
import process from 'process';
import fs from 'fs';
import { execSync } from 'child_process';

// Import agents for health monitoring
import * as htxAgent from '../agents/htxAgent.js';
import * as csvAgent from '../agents/csvAgent.js';

/**
 * System health monitoring
 */
export class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.checks = new Map();
    this.metrics = new Map();
    this.alerts = [];
    // Register agent-specific health checks
    this.registerAgentHealthChecks();
  }

  /**
   * Register health checks for all agents
   */
  registerAgentHealthChecks() {
    // HTX Agent health check
    this.registerCheck('htx_agent', async () => {
      try {
        const summary = htxAgent.summary();
        return {
          healthy: summary.success && summary.data.status === 'operational',
          message: `HTX Agent: ${summary.data?.status || 'unknown'}`,
          details: {
            version: summary.data?.version,
            endpoints: summary.data?.endpoints?.length || 0,
            features: Object.keys(summary.data?.capabilities || {})
          }
        };
      } catch (error) {
        return {
          healthy: false,
          message: 'HTX Agent health check failed',
          details: { error: error.message }
        };
      }
    }, { critical: false, timeout: 2000 });
    
    // CSV Agent health check
    this.registerCheck('csv_agent', async () => {
      try {
        const summary = csvAgent.summary();
        return {
          healthy: summary.success && summary.data.status === 'operational',
          message: `CSV Agent: ${summary.data?.status || 'unknown'}`,
          details: {
            version: summary.data?.version,
            endpoints: summary.data?.endpoints?.length || 0,
            capabilities: Object.keys(summary.data?.capabilities || {})
          }
        };
      } catch (error) {
        return {
          healthy: false,
          message: 'CSV Agent health check failed',
          details: { error: error.message }
        };
      }
    }, { critical: false, timeout: 2000 });
    
    // Agent response time test
    this.registerCheck('agent_performance', async () => {
      try {
        const startTime = Date.now();
        
        // Test both agents simultaneously
        const [htxSummary, csvSummary] = await Promise.all([
          htxAgent.summary(),
          csvAgent.summary()
        ]);
        
        const responseTime = Date.now() - startTime;
        
        return {
          healthy: responseTime < 1000, // Should respond within 1 second
          message: `Agent response time: ${responseTime}ms`,
          details: {
            responseTime,
            htxHealthy: htxSummary.success,
            csvHealthy: csvSummary.success,
            threshold: '1000ms'
          }
        };
      } catch (error) {
        return {
          healthy: false,
          message: 'Agent performance check failed',
          details: { error: error.message }
        };
      }
    }, { critical: false, timeout: 3000 });
    
    // Agent memory usage
    this.registerCheck('agent_memory', async () => {
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        
        return {
          healthy: heapUsedMB < 200, // Less than 200MB
          message: `Agent memory usage: ${heapUsedMB.toFixed(2)}MB`,
          details: {
            heapUsedMB: parseFloat(heapUsedMB.toFixed(2)),
            heapTotalMB: parseFloat((memUsage.heapTotal / 1024 / 1024).toFixed(2)),
            rssMB: parseFloat((memUsage.rss / 1024 / 1024).toFixed(2)),
            threshold: '200MB'
          }
        };
      } catch (error) {
        return {
          healthy: false,
          message: 'Memory check failed',
          details: { error: error.message }
        };
      }
    }, { critical: true, timeout: 1000 });
  }
  registerCheck(name, checkFn, options = {}) {
    this.checks.set(name, {
      fn: checkFn,
      timeout: options.timeout || 5000,
      critical: options.critical || false,
      lastRun: null,
      lastResult: null
    });
  }

  /**
   * Run all health checks
   * @returns {Object} - Health check results
   */
  async runHealthChecks() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {},
      system: this.getSystemMetrics()
    };

    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          check.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
          )
        ]);

        const duration = Date.now() - startTime;
        
        results.checks[name] = {
          status: result.healthy ? 'healthy' : 'unhealthy',
          message: result.message || 'OK',
          duration,
          critical: check.critical,
          details: result.details || {}
        };

        check.lastRun = Date.now();
        check.lastResult = result;

        // Mark overall status as unhealthy if critical check fails
        if (!result.healthy && check.critical) {
          results.status = 'unhealthy';
        }
      } catch (error) {
        results.checks[name] = {
          status: 'error',
          message: error.message,
          critical: check.critical,
          error: true
        };

        if (check.critical) {
          results.status = 'unhealthy';
        }
      }
    }

    return results;
  }

  /**
   * Get system metrics
   * @returns {Object} - System performance metrics
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        usage_percentage: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2)
      },
      cpu: {
        load_average: os.loadavg(),
        cpu_count: os.cpus().length,
        usage_percentage: this.getCPUUsage()
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        node_version: process.version,
        platform: process.platform
      },
      disk: this.getDiskUsage()
    };
  }

  /**
   * Get CPU usage percentage
   * @returns {number} - CPU usage percentage
   */
  getCPUUsage() {
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const output = execSync('top -bn1 | grep \"Cpu(s)\" | awk \"{print $2}\" | cut -d\"%\" -f1').toString().trim();
        return parseFloat(output) || 0;
      } else if (process.platform === 'win32') {
        const output = execSync('wmic cpu get loadpercentage /value').toString();
        const match = output.match(/LoadPercentage=(\\d+)/);
        return match ? parseFloat(match[1]) : 0;
      }
    } catch (error) {
      // Fallback calculation based on process CPU time
      return 0;
    }
    return 0;
  }

  /**
   * Get disk usage information
   * @returns {Object} - Disk usage metrics
   */
  getDiskUsage() {
    try {
      const stats = fs.statSync('.');
      return {
        available: 'unknown',
        used: 'unknown',
        total: 'unknown',
        usage_percentage: 'unknown'
      };
    } catch (error) {
      return {
        error: 'Unable to get disk usage',
        message: error.message
      };
    }
  }

  /**
   * Record agent-specific metrics
   * @param {string} agentName - Name of the agent
   * @param {string} operation - Operation performed
   * @param {number} duration - Operation duration in ms
   * @param {boolean} success - Whether operation succeeded
   * @param {Object} metadata - Additional metadata
   */
  recordAgentMetric(agentName, operation, duration, success, metadata = {}) {
    const metricName = `agent_${agentName}_${operation}`;
    
    this.recordMetric(`${metricName}_duration`, duration, {
      agent: agentName,
      operation,
      success,
      ...metadata
    });
    
    this.recordMetric(`${metricName}_success_rate`, success ? 1 : 0, {
      agent: agentName,
      operation,
      ...metadata
    });
    
    // Track error rates
    if (!success) {
      this.recordMetric(`${metricName}_errors`, 1, {
        agent: agentName,
        operation,
        error: metadata.error || 'unknown',
        ...metadata
      });
    }
  }
  recordMetric(name, value, tags = {}) {
    const timestamp = Date.now();
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricData = this.metrics.get(name);
    metricData.push({ value, timestamp, tags });
    
    // Keep only last 1000 data points
    if (metricData.length > 1000) {
      metricData.shift();
    }
  }

  /**
   * Get metric statistics
   * @param {string} name - Metric name
   * @param {number} duration - Duration in milliseconds
   * @returns {Object} - Metric statistics
   */
  getMetricStats(name, duration = 3600000) { // Default 1 hour
    const metricData = this.metrics.get(name) || [];
    const cutoff = Date.now() - duration;
    const recentData = metricData.filter(point => point.timestamp > cutoff);
    
    if (recentData.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0 };
    }
    
    const values = recentData.map(point => point.value);
    
    return {
      count: values.length,
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
      timespan: duration
    };
  }

  /**
   * Create an alert
   * @param {string} level - Alert level (info, warning, error, critical)
   * @param {string} message - Alert message
   * @param {Object} details - Additional details
   */
  createAlert(level, message, details = {}) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      details,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    // Log critical alerts
    if (level === 'critical' || level === 'error') {
      console.error(`[${level.toUpperCase()}] ${message}`, details);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, details);
    }
    
    return alert;
  }

  /**
   * Get recent alerts
   * @param {number} limit - Maximum number of alerts to return
   * @returns {Array} - Recent alerts
   */
  getRecentAlerts(limit = 10) {
    return this.alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

// Register default health checks
healthMonitor.registerCheck('memory', async () => {
  const memUsage = process.memoryUsage();
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  return {
    healthy: usagePercent < 90,
    message: `Memory usage: ${usagePercent.toFixed(2)}%`,
    details: { usagePercent, memUsage }
  };
}, { critical: true });

healthMonitor.registerCheck('disk_space', async () => {
  try {
    // Simple check - just verify we can write to current directory
    const testFile = '.health_check_tmp';
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return {
      healthy: true,
      message: 'Disk write access OK'
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Disk write failed',
      details: { error: error.message }
    };
  }
}, { critical: true });

healthMonitor.registerCheck('external_api', async () => {
  try {
    // Test basic internet connectivity
    const response = await fetch('https://httpbin.org/status/200', {
      timeout: 3000
    });
    
    return {
      healthy: response.ok,
      message: 'External API connectivity OK'
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'External API connectivity failed',
      details: { error: error.message }
    };
  }
}, { critical: false });

/**
 * Express middleware for health checks
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function healthCheckMiddleware(req, res) {
  try {
    const health = await healthMonitor.runHealthChecks();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
}

/**
 * Express middleware for enhanced metrics collection with agent tracking
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function enhancedMetricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Extract agent info from URL if present
  const agentMatch = req.path.match(/^\/agent\/([^/]+)\/([^/]+)/);
  const agentName = agentMatch ? agentMatch[1] : null;
  const operation = agentMatch ? agentMatch[2] : null;
  
  // Record request metrics
  healthMonitor.recordMetric('http_requests_total', 1, {
    method: req.method,
    path: req.path,
    agent: agentName,
    operation
  });
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // General HTTP metrics
    healthMonitor.recordMetric('http_request_duration', duration, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      agent: agentName,
      operation
    });
    
    healthMonitor.recordMetric('http_responses_total', 1, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      agent: agentName,
      operation
    });
    
    // Agent-specific metrics
    if (agentName && operation) {
      healthMonitor.recordAgentMetric(agentName, operation, duration, success, {
        method: req.method,
        status: res.statusCode
      });
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Get comprehensive monitoring dashboard with agent-specific data
 * @returns {Object} - Enhanced dashboard data
 */
export async function getEnhancedMonitoringDashboard() {
  const health = await healthMonitor.runHealthChecks();
  
  // Agent-specific metrics
  const agentMetrics = {
    htx: {
      summary: await getAgentSummary('htx'),
      performance: {
        averageResponseTime: healthMonitor.getMetricStats('agent_htx_summary_duration'),
        successRate: healthMonitor.getMetricStats('agent_htx_summary_success_rate'),
        errorRate: healthMonitor.getMetricStats('agent_htx_summary_errors')
      },
      operations: {
        verifyKeys: healthMonitor.getMetricStats('agent_htx_verifyKeys_duration'),
        fetchMarkets: healthMonitor.getMetricStats('agent_htx_fetchMarkets_duration'),
        fetchCandles: healthMonitor.getMetricStats('agent_htx_fetchCandles_duration')
      }
    },
    csv: {
      summary: await getAgentSummary('csv'),
      performance: {
        averageResponseTime: healthMonitor.getMetricStats('agent_csv_summary_duration'),
        successRate: healthMonitor.getMetricStats('agent_csv_summary_success_rate'),
        errorRate: healthMonitor.getMetricStats('agent_csv_summary_errors')
      },
      operations: {
        parseCSV: healthMonitor.getMetricStats('agent_csv_parseCSV_duration'),
        transformData: healthMonitor.getMetricStats('agent_csv_transformData_duration'),
        exportCSV: healthMonitor.getMetricStats('agent_csv_exportCSV_duration')
      }
    }
  };
  
  return {
    timestamp: new Date().toISOString(),
    health,
    metrics: {
      system: {
        requests: healthMonitor.getMetricStats('http_requests_total'),
        response_time: healthMonitor.getMetricStats('http_request_duration'),
        responses: healthMonitor.getMetricStats('http_responses_total')
      },
      agents: agentMetrics
    },
    alerts: healthMonitor.getRecentAlerts(),
    system: health.system,
    summary: {
      totalAgents: 2,
      healthyAgents: Object.values(agentMetrics).filter(agent => 
        agent.summary.healthy
      ).length,
      totalRequests: healthMonitor.getMetricStats('http_requests_total').count,
      averageResponseTime: healthMonitor.getMetricStats('http_request_duration').avg,
      uptime: Date.now() - healthMonitor.startTime
    }
  };
}

/**
 * Get comprehensive monitoring dashboard data (legacy compatibility)
 * @returns {Object} - Dashboard data
 */
export async function getMonitoringDashboard() {
  return await getEnhancedMonitoringDashboard();
}
async function getAgentSummary(agentName) {
  try {
    let summary;
    switch (agentName) {
    case 'htx':
      summary = htxAgent.summary();
      break;
    case 'csv':
      summary = csvAgent.summary();
      break;
    default:
      return { healthy: false, error: 'Unknown agent' };
    }
    
    return {
      healthy: summary.success && summary.data.status === 'operational',
      version: summary.data?.version || 'unknown',
      status: summary.data?.status || 'unknown',
      endpoints: summary.data?.endpoints?.length || 0,
      capabilities: Object.keys(summary.data?.capabilities || {}),
      lastChecked: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      lastChecked: new Date().toISOString()
    };
  }
}

export default {
  HealthMonitor,
  healthMonitor,
  healthCheckMiddleware,
  enhancedMetricsMiddleware,
  getMonitoringDashboard,
  getEnhancedMonitoringDashboard
};

// Legacy export for backward compatibility
export const metricsMiddleware = enhancedMetricsMiddleware;