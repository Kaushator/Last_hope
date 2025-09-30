// infraAgent.js — Infrastructure management via Terraform and GCP
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

/**
 * Initialize Terraform workspace and backend
 * @param {Object} params - { workspace, backend_config }
 * @returns {Object} - Initialization result
 */
export async function initTerraform(params = {}) {
  try {
    const { workspace = 'default', backend_config } = params;
    
    let command = 'cd terraform && terraform init';
    
    if (backend_config) {
      command += ` -backend-config="${backend_config}"`;
    }
    
    // Upgrade providers
    command += ' -upgrade';
    
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    
    // Switch to or create workspace
    if (workspace !== 'default') {
      try {
        await execAsync(`cd terraform && terraform workspace select ${workspace}`);
      } catch (e) {
        // Workspace doesn't exist, create it
        await execAsync(`cd terraform && terraform workspace new ${workspace}`);
      }
    }
    
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
 * Plan Terraform infrastructure changes
 * @param {Object} params - { workspace, var_file, target, destroy }
 * @returns {Object} - Plan output and analysis
 */
export async function planInfrastructure(params = {}) {
  try {
    const { workspace = 'default', var_file, target, destroy = false } = params;
    
    // Ensure terraform is initialized
    await initTerraform({ workspace });
    
    let command = 'cd terraform && terraform plan';
    
    if (destroy) {
      command += ' -destroy';
    }
    
    if (var_file) {
      command += ` -var-file="${var_file}"`;
    }
    
    if (target) {
      command += ` -target="${target}"`;
    }
    
    // Output to file for analysis
    command += ' -out=tfplan';
    
    const { stdout, stderr } = await execAsync(command, { timeout: 300000 }); // 5 minute timeout
    
    // Analyze the plan
    const analysis = analyzeTerraformPlan(stdout);
    
    return {
      success: true,
      workspace,
      planOutput: stdout,
      analysis,
      command,
      planFile: 'terraform/tfplan',
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
 * Apply Terraform infrastructure changes
 * @param {Object} params - { workspace, auto_approve, plan_file }
 * @returns {Object} - Apply result
 */
export async function applyInfrastructure(params = {}) {
  try {
    const { workspace = 'default', auto_approve = false, plan_file = 'tfplan' } = params;
    
    let command = 'cd terraform && terraform apply';
    
    if (plan_file && fs.existsSync(`terraform/${plan_file}`)) {
      command += ` ${plan_file}`;
    } else if (auto_approve) {
      command += ' -auto-approve';
    }
    
    const { stdout, stderr } = await execAsync(command, { timeout: 1800000 }); // 30 minute timeout
    
    // Get infrastructure state
    const state = await getInfrastructureState({ workspace });
    
    return {
      success: true,
      workspace,
      output: stdout,
      state: state.resources || [],
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
 * Destroy Terraform infrastructure
 * @param {Object} params - { workspace, auto_approve, target }
 * @returns {Object} - Destroy result
 */
export async function destroyInfrastructure(params = {}) {
  try {
    const { workspace = 'default', auto_approve = false, target } = params;
    
    let command = 'cd terraform && terraform destroy';
    
    if (auto_approve) {
      command += ' -auto-approve';
    }
    
    if (target) {
      command += ` -target="${target}"`;
    }
    
    const { stdout, stderr } = await execAsync(command, { timeout: 1800000 }); // 30 minute timeout
    
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
 * Get current infrastructure state
 * @param {Object} params - { workspace, format }
 * @returns {Object} - Current state information
 */
export async function getInfrastructureState(params = {}) {
  try {
    const { workspace = 'default', format = 'json' } = params;
    
    // Switch to workspace
    if (workspace !== 'default') {
      await execAsync(`cd terraform && terraform workspace select ${workspace}`);
    }
    
    // Get state list
    const { stdout: listOutput } = await execAsync('cd terraform && terraform state list');
    const resources = listOutput.trim().split('\n').filter(line => line.trim());
    
    // Get detailed state if format is json
    let detailedState = null;
    if (format === 'json' && resources.length > 0) {
      try {
        const { stdout: stateOutput } = await execAsync('cd terraform && terraform show -json');
        detailedState = JSON.parse(stateOutput);
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    // Get workspace list
    const { stdout: workspaceOutput } = await execAsync('cd terraform && terraform workspace list');
    const workspaces = workspaceOutput.split('\n')
      .map(line => line.replace('*', '').trim())
      .filter(line => line);
    
    return {
      success: true,
      workspace,
      resources,
      resourceCount: resources.length,
      detailedState,
      workspaces,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      workspace: params.workspace || 'default',
      resources: []
    };
  }
}

/**
 * Deploy complete infrastructure with Docker and Terraform
 * @param {Object} params - { docker_tag, terraform_workspace, auto_approve }
 * @returns {Object} - Complete deployment result
 */
export async function deployInfra(params = {}) {
  try {
    const { docker_tag = 'last-hope:latest', terraform_workspace = 'default', auto_approve = false } = params;
    
    const deploymentSteps = [];
    
    // Step 1: Build Docker image
    try {
      const { stdout: dockerOutput } = await execAsync(`docker build -t ${docker_tag} .`, { timeout: 600000 });
      deploymentSteps.push({
        step: 'docker_build',
        success: true,
        output: dockerOutput.split('\n').slice(-5).join('\n'), // Last 5 lines
        tag: docker_tag
      });
    } catch (error) {
      deploymentSteps.push({
        step: 'docker_build',
        success: false,
        error: error.message,
        tag: docker_tag
      });
      throw new Error(`Docker build failed: ${error.message}`);
    }
    
    // Step 2: Initialize and plan Terraform
    const planResult = await planInfrastructure({ workspace: terraform_workspace });
    deploymentSteps.push({
      step: 'terraform_plan',
      success: planResult.success,
      ...planResult
    });
    
    if (!planResult.success) {
      throw new Error(`Terraform plan failed: ${planResult.error}`);
    }
    
    // Step 3: Apply Terraform
    const applyResult = await applyInfrastructure({ 
      workspace: terraform_workspace, 
      auto_approve 
    });
    deploymentSteps.push({
      step: 'terraform_apply',
      success: applyResult.success,
      ...applyResult
    });
    
    if (!applyResult.success) {
      throw new Error(`Terraform apply failed: ${applyResult.error}`);
    }
    
    return {
      success: true,
      deploymentSteps,
      docker_tag,
      terraform_workspace,
      resourcesCreated: applyResult.state?.length || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      deploymentSteps: [],
      docker_tag: params.docker_tag || 'last-hope:latest',
      terraform_workspace: params.terraform_workspace || 'default'
    };
  }
}

/**
 * Manage GCP resources and monitoring
 * @param {Object} params - { project_id, region, action }
 * @returns {Object} - GCP operation result
 */
export async function manageGCP(params = {}) {
  try {
    const { project_id, region = 'us-central1', action = 'status' } = params;
    
    if (!project_id) {
      return { error: 'GCP project_id is required', success: false };
    }
    
    let result = {
      project_id,
      region,
      action,
      timestamp: new Date().toISOString()
    };
    
    switch (action) {
    case 'status':
      // Get project status and basic info
      try {
        const { stdout } = await execAsync(`gcloud projects describe ${project_id} --format=json`);
        const projectInfo = JSON.parse(stdout);
        result.project = projectInfo;
        result.success = true;
      } catch (error) {
        result.error = 'Failed to get project info. Ensure gcloud CLI is installed and authenticated.';
        result.success = false;
      }
      break;
        
    case 'list-resources':
      // List key resources
      try {
        const commands = [
          `gcloud compute instances list --project=${project_id} --format=json`,
          `gcloud run services list --project=${project_id} --region=${region} --format=json`,
          `gcloud sql instances list --project=${project_id} --format=json`
        ];
          
        const [instances, services, databases] = await Promise.all(
          commands.map(async cmd => {
            try {
              const { stdout } = await execAsync(cmd);
              return JSON.parse(stdout);
            } catch {
              return [];
            }
          })
        );
          
        result.resources = { instances, services, databases };
        result.success = true;
      } catch (error) {
        result.error = error.message;
        result.success = false;
      }
      break;
        
    case 'billing':
      // Get billing information
      try {
        const { stdout } = await execAsync('gcloud billing accounts list --format=json');
        const billingAccounts = JSON.parse(stdout);
        result.billing = billingAccounts;
        result.success = true;
      } catch (error) {
        result.error = 'Failed to get billing info';
        result.success = false;
      }
      break;
        
    default:
      result.error = `Unknown action: ${action}`;
      result.success = false;
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      project_id: params.project_id,
      action: params.action || 'status'
    };
  }
}

// Helper functions
function analyzeTerraformPlan(planOutput) {
  const analysis = {
    toCreate: 0,
    toUpdate: 0,
    toDestroy: 0,
    resources: [],
    warnings: [],
    errors: []
  };
  
  // Parse plan output for resource changes
  const lines = planOutput.split('\n');
  
  lines.forEach(line => {
    if (line.includes('will be created')) {
      analysis.toCreate++;
      const resource = line.match(/^\s*#\s*(.+?)\s+will be created/)?.[1];
      if (resource) analysis.resources.push({ action: 'create', resource });
    } else if (line.includes('will be updated')) {
      analysis.toUpdate++;
      const resource = line.match(/^\s*#\s*(.+?)\s+will be updated/)?.[1];
      if (resource) analysis.resources.push({ action: 'update', resource });
    } else if (line.includes('will be destroyed')) {
      analysis.toDestroy++;
      const resource = line.match(/^\s*#\s*(.+?)\s+will be destroyed/)?.[1];
      if (resource) analysis.resources.push({ action: 'destroy', resource });
    } else if (line.includes('Warning:')) {
      analysis.warnings.push(line.trim());
    } else if (line.includes('Error:')) {
      analysis.errors.push(line.trim());
    }
  });
  
  analysis.totalChanges = analysis.toCreate + analysis.toUpdate + analysis.toDestroy;
  
  return analysis;
}

/**
 * Get infrastructure agent summary and capabilities
 * @returns {Object} - Agent status and features
 */
export function summary() {
  try {
    const nodeVersion = execSync('node -v').toString().trim();
    let terraformVersion = 'not available';
    let dockerVersion = 'not available';
    let gcloudVersion = 'not available';
    
    try {
      terraformVersion = execSync('terraform --version').toString().trim().split('\n')[0];
    } catch (e) {
      // Terraform not installed
    }
    
    try {
      dockerVersion = execSync('docker --version').toString().trim();
    } catch (e) {
      // Docker not installed
    }
    
    try {
      gcloudVersion = execSync('gcloud --version').toString().trim().split('\n')[0];
    } catch (e) {
      // gcloud not installed
    }
    
    return {
      agent: 'infraAgent',
      status: 'operational',
      nodeVersion,
      terraformVersion,
      dockerVersion,
      gcloudVersion,
      features: {
        terraformOperations: terraformVersion !== 'not available' ? 'available' : 'missing',
        dockerManagement: dockerVersion !== 'not available' ? 'available' : 'missing',
        gcpIntegration: gcloudVersion !== 'not available' ? 'available' : 'missing',
        workspaceManagement: 'implemented',
        stateManagement: 'implemented'
      },
      supportedOperations: {
        terraform: ['init', 'plan', 'apply', 'destroy', 'state'],
        docker: ['build', 'deploy'],
        gcp: ['status', 'list-resources', 'billing']
      },
      endpoints: [
        'initTerraform',
        'planInfrastructure',
        'applyInfrastructure',
        'destroyInfrastructure',
        'getInfrastructureState',
        'deployInfra',
        'manageGCP',
        'summary'
      ],
      terraform: {
        configPath: './terraform',
        workspaceSupport: true,
        stateBackend: 'local'
      }
    };
  } catch (error) {
    return {
      agent: 'infraAgent',
      status: 'error',
      error: error.message
    };
  }
}
