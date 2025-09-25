const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Docker = require('dockerode');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
require('dotenv').config();

const app = express();
const docker = new Docker();
const PORT = process.env.PORT || 3001;

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// In-memory store for MCP requests (in production, use a proper database)
const mcpRequests = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// MCP CSV Processing Endpoint
app.post('/mcp/csv/process', upload.single('file'), async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logger.info(`MCP CSV Processing request ${requestId} started`);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Create MCP request record
    const mcpRequest = {
      id: requestId,
      type: 'csv',
      status: 'processing',
      payload: {
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mcpRequests.set(requestId, mcpRequest);
    
    // Process CSV file
    const csvData = req.file.buffer.toString('utf8');
    const processed = await processCsvData(csvData);
    
    // Update request status
    mcpRequest.status = 'completed';
    mcpRequest.result = processed;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    logger.info(`MCP CSV Processing request ${requestId} completed`);
    
    res.json({
      requestId,
      status: 'completed',
      result: processed
    });
    
  } catch (error) {
    logger.error(`MCP CSV Processing request ${requestId} failed:`, error);
    
    const mcpRequest = mcpRequests.get(requestId) || {
      id: requestId,
      type: 'csv',
      createdAt: new Date()
    };
    
    mcpRequest.status = 'failed';
    mcpRequest.error = error.message;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    res.status(500).json({
      requestId,
      status: 'failed',
      error: error.message
    });
  }
});

// MCP Docker Operations Endpoint
app.post('/mcp/docker/:operation', async (req, res) => {
  const requestId = uuidv4();
  const operation = req.params.operation;
  
  try {
    logger.info(`MCP Docker ${operation} request ${requestId} started`);
    
    const mcpRequest = {
      id: requestId,
      type: 'docker',
      status: 'processing',
      payload: {
        operation,
        ...req.body
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mcpRequests.set(requestId, mcpRequest);
    
    let result;
    
    switch (operation) {
      case 'build':
        result = await buildDockerImage(req.body);
        break;
      case 'run':
        result = await runDockerContainer(req.body);
        break;
      case 'stop':
        result = await stopDockerContainer(req.body);
        break;
      case 'status':
        result = await getDockerStatus(req.body);
        break;
      default:
        throw new Error(`Unknown Docker operation: ${operation}`);
    }
    
    mcpRequest.status = 'completed';
    mcpRequest.result = result;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    logger.info(`MCP Docker ${operation} request ${requestId} completed`);
    
    res.json({
      requestId,
      status: 'completed',
      result
    });
    
  } catch (error) {
    logger.error(`MCP Docker ${operation} request ${requestId} failed:`, error);
    
    const mcpRequest = mcpRequests.get(requestId) || {
      id: requestId,
      type: 'docker',
      createdAt: new Date()
    };
    
    mcpRequest.status = 'failed';
    mcpRequest.error = error.message;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    res.status(500).json({
      requestId,
      status: 'failed',
      error: error.message
    });
  }
});

// MCP AI Integration Endpoint
app.post('/mcp/ai/analyze', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    logger.info(`MCP AI Analysis request ${requestId} started`);
    
    const mcpRequest = {
      id: requestId,
      type: 'ai',
      status: 'processing',
      payload: req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mcpRequests.set(requestId, mcpRequest);
    
    // Forward request to FinGPT service
    const fingptUrl = process.env.FINGPT_API_ENDPOINT || 'http://localhost:8080';
    const response = await axios.post(`${fingptUrl}/analyze`, req.body);
    
    mcpRequest.status = 'completed';
    mcpRequest.result = response.data;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    logger.info(`MCP AI Analysis request ${requestId} completed`);
    
    res.json({
      requestId,
      status: 'completed',
      result: response.data
    });
    
  } catch (error) {
    logger.error(`MCP AI Analysis request ${requestId} failed:`, error);
    
    const mcpRequest = mcpRequests.get(requestId) || {
      id: requestId,
      type: 'ai',
      createdAt: new Date()
    };
    
    mcpRequest.status = 'failed';
    mcpRequest.error = error.message;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    res.status(500).json({
      requestId,
      status: 'failed',
      error: error.message
    });
  }
});

// MCP CI/CD Pipeline Endpoint
app.post('/mcp/cicd/:action', async (req, res) => {
  const requestId = uuidv4();
  const action = req.params.action;
  
  try {
    logger.info(`MCP CI/CD ${action} request ${requestId} started`);
    
    const mcpRequest = {
      id: requestId,
      type: 'cicd',
      status: 'processing',
      payload: {
        action,
        ...req.body
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mcpRequests.set(requestId, mcpRequest);
    
    let result;
    
    switch (action) {
      case 'deploy':
        result = await deployApplication(req.body);
        break;
      case 'rollback':
        result = await rollbackApplication(req.body);
        break;
      case 'status':
        result = await getDeploymentStatus(req.body);
        break;
      default:
        throw new Error(`Unknown CI/CD action: ${action}`);
    }
    
    mcpRequest.status = 'completed';
    mcpRequest.result = result;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    logger.info(`MCP CI/CD ${action} request ${requestId} completed`);
    
    res.json({
      requestId,
      status: 'completed',
      result
    });
    
  } catch (error) {
    logger.error(`MCP CI/CD ${action} request ${requestId} failed:`, error);
    
    const mcpRequest = mcpRequests.get(requestId) || {
      id: requestId,
      type: 'cicd',
      createdAt: new Date()
    };
    
    mcpRequest.status = 'failed';
    mcpRequest.error = error.message;
    mcpRequest.updatedAt = new Date();
    mcpRequests.set(requestId, mcpRequest);
    
    res.status(500).json({
      requestId,
      status: 'failed',
      error: error.message
    });
  }
});

// Get MCP Request Status
app.get('/mcp/request/:requestId', (req, res) => {
  const requestId = req.params.requestId;
  const mcpRequest = mcpRequests.get(requestId);
  
  if (!mcpRequest) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  res.json(mcpRequest);
});

// List all MCP requests
app.get('/mcp/requests', (req, res) => {
  const allRequests = Array.from(mcpRequests.values());
  res.json({
    total: allRequests.length,
    requests: allRequests.sort((a, b) => b.createdAt - a.createdAt)
  });
});

// Helper Functions
async function processCsvData(csvData) {
  // Mock CSV processing - implement actual logic here
  const lines = csvData.split('\n').filter(line => line.trim());
  return {
    total_rows: lines.length - 1, // Exclude header
    columns: lines[0] ? lines[0].split(',').length : 0,
    sample_data: lines.slice(0, 5),
    processed_at: new Date()
  };
}

async function buildDockerImage(params) {
  // Mock Docker build - implement actual logic here
  return {
    image_id: 'img_' + Math.random().toString(36).substr(2, 9),
    status: 'built',
    size: '128MB',
    built_at: new Date()
  };
}

async function runDockerContainer(params) {
  // Mock Docker run - implement actual logic here
  return {
    container_id: 'container_' + Math.random().toString(36).substr(2, 9),
    status: 'running',
    ports: ['8080:8080'],
    started_at: new Date()
  };
}

async function stopDockerContainer(params) {
  return {
    container_id: params.container_id,
    status: 'stopped',
    stopped_at: new Date()
  };
}

async function getDockerStatus(params) {
  return {
    containers: [
      {
        id: 'container_123',
        image: 'fingpt:latest',
        status: 'running',
        uptime: '2 hours'
      }
    ],
    checked_at: new Date()
  };
}

async function deployApplication(params) {
  return {
    deployment_id: 'deploy_' + Math.random().toString(36).substr(2, 9),
    status: 'deployed',
    version: params.version || '1.0.0',
    deployed_at: new Date()
  };
}

async function rollbackApplication(params) {
  return {
    rollback_id: 'rollback_' + Math.random().toString(36).substr(2, 9),
    status: 'rolled_back',
    previous_version: params.previous_version || '0.9.0',
    rolled_back_at: new Date()
  };
}

async function getDeploymentStatus(params) {
  return {
    current_version: '1.0.0',
    status: 'healthy',
    last_deployed: new Date(Date.now() - 3600000), // 1 hour ago
    uptime: '99.9%'
  };
}

// Start server
app.listen(PORT, () => {
  logger.info(`MCP Server running on port ${PORT}`);
  console.log(`MCP Server running on port ${PORT}`);
});