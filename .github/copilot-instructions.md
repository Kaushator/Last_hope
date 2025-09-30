# Copilot Instructions for HTX Analytics Project

## Project Architecture

This is a **personal analytics platform** for HTX (Huobi) cryptocurrency exchange - **no trading functionality, analytics only**. The system consists of:

- **MCP Server** (`server.js`): Express API providing test generation, linting, and GitHub billing endpoints
- **Qoder Agents** (`src/agents/`): Specialized task automation for CSV parsing, infrastructure, and CI
- **Infrastructure** (`terraform/`): Docker + Terraform setup for future FinGPT integration on GCP
- **Security** (`tools/encrypt_api_key.py`): Fernet-based encryption for HTX API keys

## Development Workflow

1. **Local Development**: Use Qoder (`qoder start`) with agents for code generation
2. **Testing**: GitHub Codespaces + Copilot for test generation
3. **CI/CD**: GitHub Actions runs `npm test` on push/PR
4. **Deployment**: Terraform applies Docker infrastructure

## Key Conventions

### MCP Server Patterns
- **Endpoint Structure**: `/tests`, `/billing`, `/lint` - each returns JSON with specific schemas
- **Error Handling**: Always return `{ error: "message" }` for 4xx/5xx responses
- **GitHub Integration**: Use `GITHUB_TOKEN` env var for API access with proper User-Agent headers

### Qoder Agent Structure
```javascript
// Each agent exports specific functions matching qoder.config.json tasks
export function parseCSV(data) { /* CSV processing */ }
export function deployInfra() { /* Docker + Terraform */ }
export function runTests() { /* Test commands */ }
```

### Security & Secrets
- **HTX API Keys**: Use `tools/encrypt_api_key.py` with Fernet encryption locally
- **GCP Secrets**: Store in Google Secret Manager for production
- **GitHub Codespaces**: Use repository secrets for CI/CD tokens

### Infrastructure Commands
```bash
# Docker build (called from infraAgent.js)
docker build -t myapp .

# Terraform deployment
terraform init && terraform apply -auto-approve
```

## File Organization

- `server.js`: Main MCP server with Express endpoints
- `qoder.config.json`: Agent configuration - modify when adding new automation tasks  
- `src/agents/`: Task-specific automation modules
- `terraform/`: Infrastructure as code for Docker deployment
- `tools/`: Python utilities for encryption/security

## Dependencies & Tools

- **Runtime**: Node.js 18+ with ES modules (`"type": "module"`)
- **Testing**: Jest (`npm test`)
- **Linting**: ESLint with stdin support for MCP integration
- **Containerization**: Docker with Node.js 18 base image
- **Infrastructure**: Terraform with Docker provider

## Qoder Integration
- Use Repo Wiki to prime knowledge (`.qoder/repowiki/`)
- Enable Rules from `.qoder/rules/` (Always Apply, Model Decision, Specific Files)
- Quest Mode: start with specs under `.qoder/quest/`
- MCP: add local server via STDIO using `node server.js` (see `MCP_SETTINGS.txt`)

## Testing Guidelines

### Test Structure
- **Location**: Tests are in `test/` directory, organized by category:
  - `test/agents/`: Unit tests for agent modules
  - `test/integration/`: Integration tests for server endpoints
  - `test/security/`: Security and encryption tests
- **Framework**: Jest with ES modules support
- **Coverage**: Run `npm run test:coverage` to generate coverage reports
- **Setup**: Global test utilities in `test/setup.js`

### Writing Tests
```javascript
// Import from @jest/globals for ES modules
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as myAgent from '../../src/agents/myAgent.js';

describe('MyAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle success case', async () => {
    const result = await myAgent.myFunction({ param: 'value' });
    expect(result.success).toBe(true);
  });
});
```

### Test Commands
- `npm test`: Run all tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Run tests with coverage report

## Common Patterns

### Agent Function Pattern
All agent functions should follow this structure:
```javascript
export async function myFunction(params = {}) {
  try {
    // 1. Validate inputs
    if (!params.required_field) {
      return { 
        success: false, 
        error: 'Missing required_field parameter' 
      };
    }

    // 2. Perform operation
    const result = await someOperation(params);

    // 3. Return success response
    return {
      success: true,
      data: result,
      message: 'Operation completed successfully'
    };
  } catch (err) {
    // 4. Handle errors consistently
    return {
      success: false,
      error: err.message
    };
  }
}
```

### API Endpoint Pattern
MCP server endpoints should follow this structure:
```javascript
app.post('/endpoint', async (req, res) => {
  try {
    // Validate request
    const { param } = req.body;
    if (!param) {
      return res.status(400).json({ error: 'Missing required parameter' });
    }

    // Call agent function
    const result = await agent.function(req.body);

    // Return response
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Async/Await Pattern
- Always use `async/await` for asynchronous operations
- Wrap in try/catch blocks for error handling
- Return consistent response objects with `success`, `error`, or `data` fields

## Anti-Patterns to Avoid

### ❌ Don't Do
```javascript
// No error handling
export function unsafeFunction(params) {
  return doSomething(params); // Will crash if doSomething throws
}

// Inconsistent return values
export function inconsistent(params) {
  if (error) return null; // Sometimes null
  return { data: 'value' }; // Sometimes object
}

// Synchronous file operations
export function syncRead() {
  const data = fs.readFileSync('file.txt'); // Blocks event loop
}
```

### ✅ Do This Instead
```javascript
// Proper error handling
export async function safeFunction(params = {}) {
  try {
    return await doSomething(params);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Consistent return values
export async function consistent(params = {}) {
  if (error) {
    return { success: false, error: 'Error message' };
  }
  return { success: true, data: 'value' };
}

// Asynchronous file operations
export async function asyncRead() {
  const data = await fs.promises.readFile('file.txt', 'utf-8');
  return data;
}
```

## Security Best Practices

### Handling API Keys
1. **Never commit plaintext secrets** - Use `.env` files (gitignored)
2. **Encrypt sensitive data** - Use `tools/encrypt_api_key.py` for HTX keys
3. **Use environment variables** - Access via `process.env.VARIABLE_NAME`
4. **Validate credentials** - Check encryption before use in production

### Example: Safe Key Usage
```javascript
// Load encrypted key
import { decryptApiKey } from '../security/fernet.js';

export async function callAPI(params = {}) {
  const apiKey = params.encrypted_key 
    ? await decryptApiKey(params.encrypted_key)
    : process.env.HTX_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'API key not configured' };
  }

  // Use apiKey safely
}
```

## Error Handling Guidelines

### Standard Error Response
All functions should return errors in this format:
```javascript
{
  success: false,
  error: 'Human-readable error message',
  details: { /* optional additional context */ }
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (missing/invalid auth)
- `404`: Not found
- `500`: Internal server error

### Logging Errors
```javascript
// Log errors before returning
console.error('[AgentName] Error:', err.message);
console.error('[AgentName] Stack:', err.stack);

return { 
  success: false, 
  error: 'User-friendly message',
  details: process.env.NODE_ENV === 'development' ? err.stack : undefined
};
```

## Troubleshooting Tips

### Common Issues

**Jest ES Module Errors**: If you see "Cannot use import statement outside a module":
- Ensure `package.json` has `"type": "module"`
- Use `import` from `@jest/globals` in tests
- Check `jest.config.js` is properly configured

**Docker Build Failures**: If Docker build fails:
- Check `Dockerfile` is using Node 18+ base image
- Ensure all dependencies are in `package.json`
- Run `docker build --no-cache` to rebuild from scratch

**Terraform Errors**: If Terraform fails:
- Run `terraform init -upgrade` to update providers
- Check GCP credentials are configured: `gcloud auth application-default login`
- Verify project ID is correct in `terraform.tfvars`

**MCP Server Not Starting**: If server won't start:
- Check port 4000 is available: `lsof -i :4000`
- Verify environment variables are set (`.env` file)
- Check logs with: `DEBUG=mcp:* npm run dev:debug`

## AI Integration Notes

- MCP server provides `/tests` endpoint for auto-generating Jest test stubs
- `/billing` endpoint monitors GitHub Copilot usage
- `/lint` endpoint runs ESLint programmatically for code quality
- Future: FinGPT model integration via GCP for portfolio analytics

## Quick Reference

### Essential Commands
```bash
# Development
npm start                  # Start MCP server
npm run dev               # Start with auto-reload
npm run dev:debug         # Start with debug logging

# Testing & Quality
npm test                  # Run all tests
npm run lint              # Check code style
npm run lint:fix          # Fix linting issues

# Infrastructure
npm run compose:up        # Start Docker containers
npm run tf:plan          # Preview Terraform changes
npm run tf:apply         # Apply infrastructure changes

# Security
npm run encrypt:key      # Generate encryption key
python tools/encrypt_api_key.py  # Encrypt API keys
```

### Key Files Quick Reference
- `server.js` - Main MCP server entry point
- `src/agents/*.js` - Agent implementations
- `qoder.config.json` - Qoder IDE configuration
- `jest.config.js` - Test configuration
- `terraform/main.tf` - Infrastructure definitions
- `.env.example` - Template for environment variables

When working on this codebase, focus on the MCP server patterns for AI tool integration and maintain the agent-based architecture for task automation.
