// finGPTAgent.js — FinGPT packaging, deployment, and health monitoring
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

/**
 * Build FinGPT Docker image
 * @param {Object} params - { tag, platform, push }
 * @returns {Object} - Build result and image details
 */
export async function buildDocker(params = {}) {
  try {
    const { tag = 'fingpt:latest', platform = 'linux/amd64', push = false } = params;
    
    // Check if Dockerfile.fingpt exists
    const dockerfilePath = './docker/Dockerfile.fingpt';
    if (!fs.existsSync(dockerfilePath)) {
      // Create basic FinGPT Dockerfile if it doesn't exist
      const dockerDir = './docker';
      if (!fs.existsSync(dockerDir)) {
        fs.mkdirSync(dockerDir, { recursive: true });
      }
      
      const dockerfileContent = `# FinGPT Docker Image
FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install FinGPT
RUN pip install fingpt

# Copy application code
COPY src/ ./src/
COPY models/ ./models/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["python", "src/fingpt_service.py"]
`;
      
      fs.writeFileSync(dockerfilePath, dockerfileContent);
    }
    
    const buildCommand = `docker build -f ${dockerfilePath} --platform ${platform} -t ${tag} .`;
    console.log(`Building Docker image: ${buildCommand}`);
    
    const { stdout, stderr } = await execAsync(buildCommand, { timeout: 300000 }); // 5 minute timeout
    
    let result = {
      success: true,
      tag,
      platform,
      buildOutput: stdout,
      timestamp: new Date().toISOString()
    };
    
    if (push) {
      const pushCommand = `docker push ${tag}`;
      const { stdout: pushOutput } = await execAsync(pushCommand);
      result.pushOutput = pushOutput;
      result.pushed = true;
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr,
      tag: params.tag || 'fingpt:latest'
    };
  }
}

/**
 * Run FinGPT locally using Docker Compose
 * @param {Object} params - { service, detached, build }
 * @returns {Object} - Container status and details
 */
export async function runLocal(params = {}) {
  try {
    const { service = 'fingpt-api', detached = true, build = false } = params;
    
    // Check if docker-compose.yml exists
    const composePath = './docker-compose.yml';
    if (!fs.existsSync(composePath)) {
      // Create basic docker-compose.yml
      const composeContent = `version: '3.8'

services:
  fingpt-api:
    build:
      context: .
      dockerfile: docker/Dockerfile.fingpt
    ports:
      - "8080:8080"
    environment:
      - ENVIRONMENT=development
      - LOG_LEVEL=debug
    volumes:
      - ./models:/app/models
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mcp-server:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
      - ENABLE_FINGPT=true
      - FINGPT_ENDPOINT=http://fingpt-api:8080
    depends_on:
      - fingpt-api

networks:
  default:
    name: last-hope-network
`;
      
      fs.writeFileSync(composePath, composeContent);
    }
    
    let command = 'docker compose';
    if (build) command += ' build';
    command += ` up${detached ? ' -d' : ''}`;
    if (service !== 'all') command += ` ${service}`;
    
    console.log(`Running: ${command}`);
    const { stdout, stderr } = await execAsync(command, { timeout: 180000 }); // 3 minute timeout
    
    // Check container status
    const { stdout: psOutput } = await execAsync('docker compose ps --format json');
    const containers = psOutput.trim().split('\n').map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    return {
      success: true,
      service,
      detached,
      containers,
      output: stdout,
      command
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      service: params.service || 'fingpt-api'
    };
  }
}

/**
 * Execute Terraform plan for GCP infrastructure
 * @param {Object} params - { workspace, var_file }
 * @returns {Object} - Terraform plan output
 */
export async function tfPlan(params = {}) {
  try {
    const { workspace = 'default', var_file } = params;
    
    let command = 'cd terraform && terraform init -upgrade';
    if (workspace !== 'default') {
      command += ` && terraform workspace select ${workspace} || terraform workspace new ${workspace}`;
    }
    command += ' && terraform plan';
    if (var_file) {
      command += ` -var-file=${var_file}`;
    }
    
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 }); // 2 minute timeout
    
    return {
      success: true,
      workspace,
      output: stdout,
      command,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr,
      workspace: params.workspace || 'default'
    };
  }
}

/**
 * Execute Terraform apply for GCP infrastructure deployment
 * @param {Object} params - { workspace, var_file, auto_approve }
 * @returns {Object} - Terraform apply output
 */
export async function tfApply(params = {}) {
  try {
    const { workspace = 'default', var_file, auto_approve = true } = params;
    
    let command = 'cd terraform && terraform init -upgrade';
    if (workspace !== 'default') {
      command += ` && terraform workspace select ${workspace} || terraform workspace new ${workspace}`;
    }
    command += ' && terraform apply';
    if (auto_approve) {
      command += ' -auto-approve';
    }
    if (var_file) {
      command += ` -var-file=${var_file}`;
    }
    
    const { stdout, stderr } = await execAsync(command, { timeout: 600000 }); // 10 minute timeout
    
    return {
      success: true,
      workspace,
      output: stdout,
      command,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr,
      workspace: params.workspace || 'default'
    };
  }
}

/**
 * Health check for FinGPT service endpoint
 * @param {Object} params - { endpoint, timeout }
 * @returns {Object} - Health status and response details
 */
export async function healthCheck(params = {}) {
  try {
    const { endpoint = 'http://localhost:8080/health', timeout = 5000 } = params;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'FinGPT-Agent-HealthCheck',
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    return {
      healthy: response.ok,
      status: response.status,
      endpoint,
      response: data,
      responseTime: Date.now() - (response.headers.get('X-Response-Time') || Date.now()),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      healthy: false,
      endpoint: params.endpoint || 'http://localhost:8080/health',
      error: error.message,
      timeout: error.name === 'AbortError',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get FinGPT predictions (placeholder for ML inference)
 * @param {Object} params - { data, model_version }
 * @returns {Object} - Prediction results
 */
export async function getPredictions(params = {}) {
  try {
    const { data, model_version = 'latest' } = params;
    const endpoint = process.env.FINGPT_ENDPOINT || 'http://localhost:8080';
    
    const response = await fetch(`${endpoint}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Model-Version': model_version
      },
      body: JSON.stringify({ data })
    });
    
    if (!response.ok) {
      throw new Error(`Prediction API error: ${response.status}`);
    }
    
    const predictions = await response.json();
    
    return {
      success: true,
      predictions,
      model_version,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Fallback to mock predictions if service unavailable
    return {
      success: false,
      error: error.message,
      fallback: {
        predictions: [{
          symbol: 'BTC-USDT',
          direction: 'bullish',
          confidence: 0.65,
          target_price: 45000,
          timeframe: '24h'
        }],
        model_version: 'mock',
        note: 'Service unavailable - using fallback predictions'
      }
    };
  }
}

/**
 * Get FinGPT agent summary and operational status
 * @returns {Object} - Agent status and capabilities
 */
export function summary() {
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    let dockerVersion = 'not available';
    let terraformVersion = 'not available';
    
    try {
      dockerVersion = execSync('docker --version').toString().trim();
    } catch (e) {
      // Docker not installed
    }
    
    try {
      terraformVersion = execSync('terraform --version').toString().trim().split('\n')[0];
    } catch (e) {
      // Terraform not installed
    }
    
    return {
      agent: 'finGPTAgent',
      status: 'operational',
      nodeVersion,
      dockerVersion,
      terraformVersion,
      features: {
        dockerBuild: dockerVersion !== 'not available' ? 'available' : 'missing',
        terraformDeploy: terraformVersion !== 'not available' ? 'available' : 'missing',
        healthMonitoring: 'implemented',
        mlInference: 'implemented',
        localDevelopment: 'implemented'
      },
      endpoints: [
        'buildDocker',
        'runLocal',
        'tfPlan',
        'tfApply',
        'healthCheck',
        'getPredictions',
        'summary'
      ],
      environment: {
        fingptEndpoint: process.env.FINGPT_ENDPOINT || 'http://localhost:8080',
        nodeEnv: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    return {
      agent: 'finGPTAgent',
      status: 'error',
      error: error.message
    };
  }
}

