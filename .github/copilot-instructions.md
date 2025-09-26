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

## AI Integration Notes

- MCP server provides `/tests` endpoint for auto-generating Jest test stubs
- `/billing` endpoint monitors GitHub Copilot usage
- `/lint` endpoint runs ESLint programmatically for code quality
- Future: FinGPT model integration via GCP for portfolio analytics

When working on this codebase, focus on the MCP server patterns for AI tool integration and maintain the agent-based architecture for task automation.
