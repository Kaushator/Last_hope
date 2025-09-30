// performance.js - Performance monitoring and optimization utilities
import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

/**
 * Performance monitoring utilities for MCP server
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTime = performance.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeHistory = [];
  }

  /**
   * Start timing an operation
   * @param {string} operation - Operation name
   * @returns {string} - Timing ID
   */
  startTiming(operation) {
    const timingId = `${operation}_${Date.now()}_${Math.random()}`;
    this.metrics.set(timingId, {
      operation,
      startTime: performance.now(),
      startMemory: process.memoryUsage()
    });
    return timingId;
  }

  /**
   * End timing an operation
   * @param {string} timingId - Timing ID from startTiming
   * @returns {Object} - Performance metrics
   */
  endTiming(timingId) {
    const metric = this.metrics.get(timingId);
    if (!metric) return null;

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - metric.startTime;

    const result = {
      operation: metric.operation,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memoryDelta: {
        rss: endMemory.rss - metric.startMemory.rss,
        heapUsed: endMemory.heapUsed - metric.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - metric.startMemory.heapTotal
      },
      timestamp: new Date().toISOString()
    };

    // Track response time history (keep last 100)
    this.responseTimeHistory.push(duration);
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }

    this.metrics.delete(timingId);
    return result;
  }

  /**
   * Record a request
   * @param {number} responseTime - Response time in ms
   * @param {boolean} isError - Whether request resulted in error
   */
  recordRequest(responseTime, isError = false) {
    this.requestCount++;
    if (isError) this.errorCount++;
    
    // Keep response time history
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory.shift();
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} - Performance stats
   */
  getStats() {
    const now = performance.now();
    const uptime = now - this.startTime;
    const memory = process.memoryUsage();
    
    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimeHistory].sort((a, b) => a - b);
    const p50 = this.getPercentile(sortedTimes, 50);
    const p95 = this.getPercentile(sortedTimes, 95);
    const p99 = this.getPercentile(sortedTimes, 99);

    return {
      uptime: Math.round(uptime),
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) : 0,
      activeTimings: this.metrics.size,
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024 * 100) / 100, // MB
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memory.external / 1024 / 1024 * 100) / 100
      },
      responseTimes: {
        count: this.responseTimeHistory.length,
        avg: sortedTimes.length > 0 ? Math.round(sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length * 100) / 100 : 0,
        min: sortedTimes.length > 0 ? sortedTimes[0] : 0,
        max: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0,
        p50,
        p95,
        p99
      },
      system: this.getSystemStats()
    };
  }

  /**
   * Get percentile value from array
   * @param {number[]} arr - Sorted array of numbers
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} - Percentile value
   */
  getPercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const index = Math.ceil(arr.length * percentile / 100) - 1;
    return Math.round(arr[Math.max(0, index)] * 100) / 100;
  }

  /**
   * Get system performance statistics
   * @returns {Object} - System stats
   */
  getSystemStats() {
    try {
      const nodeVersion = process.version;
      const platform = process.platform;
      const arch = process.arch;
      const cpuCount = require('os').cpus().length;
      
      return {
        nodeVersion,
        platform,
        arch,
        cpuCount,
        pid: process.pid,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: 'Failed to get system stats',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    this.startTime = performance.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeHistory = [];
  }

  /**
   * Generate performance report
   * @returns {Object} - Detailed performance report
   */
  generateReport() {
    const stats = this.getStats();
    const report = {
      summary: {
        status: this.getHealthStatus(stats),
        uptime: `${Math.floor(stats.uptime / 1000 / 60)} minutes`,
        totalRequests: stats.requestCount,
        errorRate: `${stats.errorRate}%`,
        avgResponseTime: `${stats.responseTimes.avg}ms`
      },
      performance: {
        responseTime: {
          average: stats.responseTimes.avg,
          p95: stats.responseTimes.p95,
          p99: stats.responseTimes.p99,
          trend: this.getResponseTimeTrend()
        },
        memory: {
          usage: stats.memory,
          trend: this.getMemoryTrend(),
          recommendations: this.getMemoryRecommendations(stats.memory)
        },
        throughput: {
          requestsPerMinute: stats.uptime > 60000 ? Math.round(stats.requestCount / (stats.uptime / 60000)) : 0,
          errorsPerMinute: stats.uptime > 60000 ? Math.round(stats.errorCount / (stats.uptime / 60000)) : 0
        }
      },
      recommendations: this.getPerformanceRecommendations(stats),
      timestamp: new Date().toISOString()
    };

    return report;
  }

  /**
   * Get health status based on metrics
   * @param {Object} stats - Performance statistics
   * @returns {string} - Health status
   */
  getHealthStatus(stats) {
    if (stats.errorRate > 10) return 'unhealthy';
    if (stats.responseTimes.avg > 2000) return 'degraded';
    if (stats.memory.heapUsed > 500) return 'warning';
    return 'healthy';
  }

  /**
   * Get response time trend
   * @returns {string} - Trend description
   */
  getResponseTimeTrend() {
    if (this.responseTimeHistory.length < 10) return 'insufficient_data';
    
    const recent = this.responseTimeHistory.slice(-10);
    const older = this.responseTimeHistory.slice(-20, -10);
    
    if (older.length === 0) return 'insufficient_data';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 20) return 'deteriorating';
    if (change < -20) return 'improving';
    return 'stable';
  }

  /**
   * Get memory trend
   * @returns {string} - Memory trend
   */
  getMemoryTrend() {
    // This would need historical memory data to implement properly
    // For now, return based on current usage
    const memory = process.memoryUsage();
    const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    
    if (heapUsagePercent > 90) return 'critical';
    if (heapUsagePercent > 80) return 'high';
    if (heapUsagePercent > 60) return 'moderate';
    return 'low';
  }

  /**
   * Get memory recommendations
   * @param {Object} memory - Memory statistics
   * @returns {string[]} - Array of recommendations
   */
  getMemoryRecommendations(memory) {
    const recommendations = [];
    
    if (memory.heapUsed > 500) {
      recommendations.push('Consider increasing heap size or optimizing memory usage');
    }
    
    if (memory.rss > 1000) {
      recommendations.push('High resident set size - check for memory leaks');
    }
    
    if (memory.external > 100) {
      recommendations.push('High external memory usage - review buffer and native module usage');
    }
    
    return recommendations;
  }

  /**
   * Get performance recommendations
   * @param {Object} stats - Performance statistics
   * @returns {string[]} - Array of recommendations
   */
  getPerformanceRecommendations(stats) {
    const recommendations = [];
    
    if (stats.errorRate > 5) {
      recommendations.push('High error rate detected - review error handling and input validation');
    }
    
    if (stats.responseTimes.avg > 1000) {
      recommendations.push('High average response time - consider caching or performance optimization');
    }
    
    if (stats.responseTimes.p95 > 5000) {
      recommendations.push('High P95 response time - investigate slow operations');
    }
    
    if (this.metrics.size > 50) {
      recommendations.push('Many active timing operations - potential memory leak in monitoring');
    }
    
    return recommendations;
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Express middleware for automatic performance monitoring
export function performanceMiddleware(req, res, next) {
  const timingId = performanceMonitor.startTiming(`${req.method} ${req.path}`);
  
  const originalSend = res.send;
  res.send = function(data) {
    const metrics = performanceMonitor.endTiming(timingId);
    const isError = res.statusCode >= 400;
    
    if (metrics) {
      performanceMonitor.recordRequest(metrics.duration, isError);
      
      // Add performance headers (optional)
      res.set('X-Response-Time', `${metrics.duration}ms`);
      res.set('X-Memory-Usage', `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
}

export default {
  PerformanceMonitor,
  performanceMonitor,
  performanceMiddleware
};