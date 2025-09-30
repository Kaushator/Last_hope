// orchestratorAgent.js — End-to-end pipeline coordination and reporting
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Import other agents for orchestration
import * as htxAgent from './htxAgent.js';
import * as finGPTAgent from './finGPTAgent.js';
import * as csvAgent from './csvAgent.js';
import * as infraAgent from './infraAgent.js';
import * as ciAgent from './ciAgent.js';

// In-memory storage for reports (in production, use Redis or database)
const reportStorage = new Map();
const pipelineStorage = new Map();

/**
 * Build comprehensive dataset from multiple sources
 * @param {Object} params - { sources, htx_config, csv_files }
 * @returns {Object} - Compiled dataset
 */
export async function buildDataset(params = {}) {
  try {
    const { sources = ['htx'], htx_config = {}, csv_files = [] } = params;
    
    const dataset = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      sources: [],
      data: {},
      metadata: {
        totalRecords: 0,
        dataSources: sources.length,
        buildTime: Date.now()
      }
    };
    
    // Process HTX data if requested
    if (sources.includes('htx')) {
      try {
        const marketsResult = await htxAgent.fetchMarkets(htx_config);
        if (marketsResult.markets) {
          dataset.data.htx_markets = marketsResult.markets;
          dataset.sources.push('htx_markets');
          dataset.metadata.totalRecords += marketsResult.markets.length;
        }
        
        // Fetch candle data for top markets
        const topMarkets = marketsResult.markets?.slice(0, 5) || [];
        dataset.data.htx_candles = {};
        
        for (const market of topMarkets) {
          const candlesResult = await htxAgent.fetchCandles({
            symbol: market.symbol,
            interval: '1hour',
            limit: 24
          });
          
          if (candlesResult.candles) {
            dataset.data.htx_candles[market.symbol] = candlesResult.candles;
            dataset.metadata.totalRecords += candlesResult.candles.length;
          }
        }
        
        dataset.sources.push('htx_candles');
      } catch (error) {
        dataset.errors = dataset.errors || [];
        dataset.errors.push(`HTX data error: ${error.message}`);
      }
    }
    
    // Process CSV files if provided
    if (sources.includes('csv') && csv_files.length > 0) {
      dataset.data.csv_data = {};
      
      for (const csvFile of csv_files) {
        try {
          const csvResult = await csvAgent.parseCSV({ filePath: csvFile });
          if (csvResult.success) {
            const fileName = path.basename(csvFile, path.extname(csvFile));
            dataset.data.csv_data[fileName] = csvResult.data;
            dataset.sources.push(`csv_${fileName}`);
            dataset.metadata.totalRecords += csvResult.data.length;
          }
        } catch (error) {
          dataset.errors = dataset.errors || [];
          dataset.errors.push(`CSV ${csvFile} error: ${error.message}`);
        }
      }
    }
    
    dataset.metadata.buildTime = Date.now() - dataset.metadata.buildTime;
    
    return {
      success: true,
      dataset,
      summary: {
        totalRecords: dataset.metadata.totalRecords,
        sources: dataset.sources,
        buildTimeMs: dataset.metadata.buildTime
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      dataset: null
    };
  }
}

/**
 * Call FinGPT for predictions and analysis
 * @param {Object} params - { dataset, model_config }
 * @returns {Object} - FinGPT analysis results
 */
export async function callFinGPT(params = {}) {
  try {
    const { dataset, model_config = {} } = params;
    
    if (!dataset) {
      return { error: 'Dataset is required', predictions: null };
    }
    
    // Prepare data for FinGPT
    const analysisData = prepareDataForAnalysis(dataset);
    
    // Call FinGPT prediction service
    const predictionResult = await finGPTAgent.getPredictions({
      data: analysisData,
      model_version: model_config.version || 'latest'
    });
    
    const analysis = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      datasetId: dataset.id,
      predictions: predictionResult.predictions || predictionResult.fallback?.predictions,
      model_version: predictionResult.model_version || 'mock',
      success: predictionResult.success,
      metadata: {
        inputRecords: dataset.metadata?.totalRecords || 0,
        processingTime: Date.now()
      }
    };
    
    if (!predictionResult.success) {
      analysis.fallback = true;
      analysis.error = predictionResult.error;
    }
    
    analysis.metadata.processingTime = Date.now() - analysis.metadata.processingTime;
    
    return {
      success: true,
      analysis,
      predictions: analysis.predictions,
      model_used: analysis.model_version
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      predictions: null
    };
  }
}

/**
 * Publish comprehensive report to storage
 * @param {Object} params - { dataset, analysis, format, destination }
 * @returns {Object} - Publication result
 */
export async function publishReport(params = {}) {
  try {
    const { dataset, analysis, format = 'json', destination = 'local' } = params;
    
    const report = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      dataset: dataset || {},
      analysis: analysis || {},
      metadata: {
        format,
        destination,
        publishTime: Date.now()
      },
      summary: generateReportSummary(dataset, analysis)
    };
    
    // Store report based on destination
    switch (destination) {
    case 'local':
      // Store in memory and optionally write to file
      reportStorage.set(report.id, report);
        
      if (process.env.SAVE_REPORTS === 'true') {
        const reportsDir = './reports';
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
          
        const fileName = `report_${report.id}_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        report.filePath = filePath;
      }
      break;
        
    case 'gcs':
      // TODO: Implement GCS upload
      report.gcs_upload = 'not implemented';
      break;
        
    default:
      reportStorage.set(report.id, report);
    }
    
    report.metadata.publishTime = Date.now() - report.metadata.publishTime;
    
    return {
      success: true,
      report_id: report.id,
      report,
      location: report.filePath || 'memory'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      report_id: null
    };
  }
}

/**
 * Execute end-to-end analytics pipeline
 * @param {Object} params - { htx_config, csv_files, model_config, auto_publish }
 * @returns {Object} - Complete pipeline result
 */
export async function e2e(params = {}) {
  try {
    const { 
      htx_config = {}, 
      csv_files = [], 
      model_config = {}, 
      auto_publish = true,
      sources = ['htx']
    } = params;
    
    const pipeline = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      stages: [],
      startTime: Date.now()
    };
    
    // Stage 1: Build Dataset
    console.log('E2E Stage 1: Building dataset...');
    const datasetResult = await buildDataset({ sources, htx_config, csv_files });
    pipeline.stages.push({
      stage: 'dataset',
      success: datasetResult.success,
      result: datasetResult,
      timestamp: new Date().toISOString()
    });
    
    if (!datasetResult.success) {
      throw new Error(`Dataset build failed: ${datasetResult.error}`);
    }
    
    // Stage 2: FinGPT Analysis
    console.log('E2E Stage 2: Running FinGPT analysis...');
    const analysisResult = await callFinGPT({ 
      dataset: datasetResult.dataset, 
      model_config 
    });
    pipeline.stages.push({
      stage: 'analysis',
      success: analysisResult.success,
      result: analysisResult,
      timestamp: new Date().toISOString()
    });
    
    if (!analysisResult.success) {
      console.log('FinGPT analysis failed, continuing with mock data...');
    }
    
    // Stage 3: Publish Report (if auto_publish enabled)
    if (auto_publish) {
      console.log('E2E Stage 3: Publishing report...');
      const publishResult = await publishReport({
        dataset: datasetResult.dataset,
        analysis: analysisResult.analysis,
        format: 'json',
        destination: 'local'
      });
      pipeline.stages.push({
        stage: 'publish',
        success: publishResult.success,
        result: publishResult,
        timestamp: new Date().toISOString()
      });
    }
    
    pipeline.endTime = Date.now();
    pipeline.totalTime = pipeline.endTime - pipeline.startTime;
    pipeline.success = pipeline.stages.every(stage => stage.success);
    
    // Store pipeline execution
    pipelineStorage.set(pipeline.id, pipeline);
    
    return {
      success: pipeline.success,
      pipeline_id: pipeline.id,
      pipeline,
      summary: {
        stages_completed: pipeline.stages.length,
        total_time_ms: pipeline.totalTime,
        dataset_records: datasetResult.dataset?.metadata?.totalRecords || 0,
        predictions_generated: analysisResult.analysis?.predictions?.length || 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      pipeline_id: params.pipeline_id || null,
      stages_completed: 0
    };
  }
}

/**
 * Get stored report by ID
 * @param {Object} params - { report_id }
 * @returns {Object} - Report data
 */
export async function getReport(params = {}) {
  try {
    const { report_id } = params;
    
    if (!report_id) {
      return { error: 'Report ID is required', report: null };
    }
    
    const report = reportStorage.get(report_id);
    
    if (!report) {
      return { error: 'Report not found', report: null };
    }
    
    return {
      success: true,
      report,
      accessed_at: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      report: null
    };
  }
}

/**
 * Get pipeline execution status
 * @param {Object} params - { pipeline_id }
 * @returns {Object} - Pipeline status
 */
export async function getPipelineStatus(params = {}) {
  try {
    const { pipeline_id } = params;
    
    if (!pipeline_id) {
      // Return list of all pipelines
      const pipelines = Array.from(pipelineStorage.values()).map(p => ({
        id: p.id,
        timestamp: p.timestamp,
        success: p.success,
        stages: p.stages.length,
        totalTime: p.totalTime
      }));
      
      return {
        success: true,
        pipelines,
        total: pipelines.length
      };
    }
    
    const pipeline = pipelineStorage.get(pipeline_id);
    
    if (!pipeline) {
      return { error: 'Pipeline not found', pipeline: null };
    }
    
    return {
      success: true,
      pipeline,
      status: pipeline.success ? 'completed' : 'failed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      pipeline: null
    };
  }
}

// Helper functions
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function prepareDataForAnalysis(dataset) {
  // Extract key metrics for FinGPT analysis
  const analysisData = {
    timestamp: dataset.timestamp,
    sources: dataset.sources
  };
  
  // HTX market data
  if (dataset.data.htx_markets) {
    analysisData.markets = dataset.data.htx_markets.slice(0, 10).map(market => ({
      symbol: market.symbol,
      price: market.price,
      volume: market.volume,
      change: market.change
    }));
  }
  
  // HTX candle data
  if (dataset.data.htx_candles) {
    analysisData.price_history = {};
    Object.entries(dataset.data.htx_candles).forEach(([symbol, candles]) => {
      analysisData.price_history[symbol] = candles.slice(-12).map(candle => ({
        timestamp: candle.timestamp,
        close: candle.close,
        volume: candle.volume
      }));
    });
  }
  
  return analysisData;
}

function generateReportSummary(dataset, analysis) {
  const summary = {
    data_sources: dataset?.sources?.length || 0,
    total_records: dataset?.metadata?.totalRecords || 0,
    predictions_count: analysis?.predictions?.length || 0,
    model_used: analysis?.model_version || 'unknown',
    success_rate: 'unknown'
  };
  
  if (analysis?.predictions) {
    const confident_predictions = analysis.predictions.filter(p => 
      p.confidence && p.confidence > 0.7
    ).length;
    
    summary.confident_predictions = confident_predictions;
    summary.success_rate = analysis.predictions.length > 0 
      ? `${Math.round(confident_predictions / analysis.predictions.length * 100)}%`
      : '0%';
  }
  
  return summary;
}

/**
 * Get orchestrator agent summary and capabilities
 * @returns {Object} - Agent status and features
 */
export function summary() {
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    
    return {
      agent: 'orchestratorAgent',
      status: 'operational',
      nodeVersion,
      features: {
        pipelineOrchestration: 'implemented',
        datasetBuilding: 'implemented',
        finGPTIntegration: 'implemented',
        reportGeneration: 'implemented',
        statusTracking: 'implemented'
      },
      storage: {
        reports_stored: reportStorage.size,
        pipelines_executed: pipelineStorage.size,
        storage_type: 'memory'
      },
      endpoints: [
        'buildDataset',
        'callFinGPT',
        'publishReport',
        'e2e',
        'getReport',
        'getPipelineStatus',
        'listReports',
        'deleteReport',
        'summary'
      ],
      pipeline_stages: [
        'dataset_building',
        'fingpt_analysis',
        'report_publishing'
      ],
      supported_sources: ['htx', 'csv'],
      environment: {
        save_reports: process.env.SAVE_REPORTS || 'false',
        node_env: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    return {
      agent: 'orchestratorAgent',
      status: 'error',
      error: error.message
    };
  }
}

/**
 * List all reports in local storage
 * @returns {Promise<Array>} List of report metadata
 */
export async function listReports() {
  try {
    const reports = Array.from(reportStorage.entries()).map(([id, data]) => ({
      reportId: id,
      timestamp: data.timestamp,
      type: data.type || 'analytics',
      size: JSON.stringify(data).length,
      source: 'memory'
    }));
    
    return reports;
  } catch (error) {
    console.error('List reports error:', error);
    return [];
  }
}

/**
 * Delete a report from local storage
 * @param {string} reportId - Report ID to delete
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteReport(reportId) {
  try {
    if (reportStorage.has(reportId)) {
      reportStorage.delete(reportId);
      return {
        success: true,
        reportId,
        message: 'Report deleted from memory storage'
      };
    } else {
      return {
        success: false,
        reportId,
        message: 'Report not found in memory storage'
      };
    }
  } catch (error) {
    console.error('Delete report error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

