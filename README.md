Last Hope — Qoder + MCP Project

Overview
- Node.js MCP server + agent modules to automate HTX analytics and FinGPT integration.
- Designed to work smoothly with Qoder Quest Mode and GitHub Copilot Coding Agent.

Prerequisites
- Node.js 18+ and npm
- Python 3.10+ (for Fernet encryption utility in `tools/`)
- Docker (Desktop or Engine)
- Terraform 1.5+ (1.6+ recommended)
- GitHub CLI `gh` (optional)
- GCP CLI `gcloud` (optional, for Phase 2)

Quick Start
1) Install dependencies
- `npm install`

2) Environment variables
- Copy `.env.example` to `.env` and fill values.
- Secrets to prepare:
  - `FERNET_MASTER_KEY` or use `tools/encrypt_api_key.py` to generate `secret.key` and encrypt HTX keys to files.
  - `GITHUB_TOKEN` if you use the `/billing` endpoint.
  - For GCP (optional in Phase 2): `GCP_PROJECT`, `GCS_BUCKET`, `GCP_SA_KEY` (JSON).

3) Run MCP server
- `npm start`
- Health check: `curl -s http://localhost:4000/tests -X POST -H "Content-Type: application/json" -d '{"code":"console.log(123)"}'`

4) Qoder integration (Quest Mode)
- Generate Repo Wiki: open Qoder → Repo Wiki → Generate. This will create `.qoder/repowiki` which you may commit.
- Project Rules: review files under `.qoder/rules/` (Always Apply, Model Decision, Specific Files). Adjust to your preferences.
- Quest Specs: seed specs live under `.qoder/quest/` (e.g. `01_htx_interface_spec.md`). Open Quest Mode and point to these as starting specs.
- MCP: add our local server as STDIO or HTTP:
  - STDIO example (in Qoder MCP settings JSON):
    {
      "mcpServers": {
        "last-hope": {
          "command": "node",
          "args": ["server.js"],
          "cwd": "."
        }
      }
    }
  - SSE example (if hosted):
    {
      "mcpServers": {
        "last-hope": { "type": "sse", "url": "https://<your-host>/mcp" }
      }
    }

Project Structure
- `server.js` — MCP server (Express)
- `src/agents/` — Qoder-facing helper modules
- `tools/encrypt_api_key.py` — Fernet helper for secrets (Python)
- `terraform/` — infra templates for Phase 2 (GCP-ready)
- `.qoder/` — Qoder Quest Mode scaffolding

Qoder Usage Cheatsheet
- Quest Mode specs: `.qoder/quest/*.md`
- Repo Wiki cache: `.qoder/repowiki/`
- Project rules: `.qoder/rules/*.md`
- Suggested agent tasks available via `qoder.config.json`:
  - `htxAgent`: verify keys, fetch markets/candles, parse Excel
  - `finGPTAgent`: build/run Docker, plan/apply Terraform (GCP)
  - `orchestratorAgent`: end-to-end pipeline

NPM Scripts
- `npm start` — start MCP server
- `npm run dev` — start with live-reload (nodemon)
- `npm run lint` — run ESLint
- `npm test` — run Jest tests
- `npm run compose:up` — docker-compose up (when added)
- `npm run compose:down` — docker-compose down
- `npm run tf:plan` — terraform plan (in `terraform/`)
- `npm run tf:apply` — terraform apply (auto-approve)
- `npm run tf:destroy` — terraform destroy (auto-approve)
- `npm run encrypt:key` — generate Fernet key (Python helper)
- `npm run encrypt:api` — encrypt sample API key (Python helper)

Secrets with Fernet
- Python helper (quick demo):
  - `python tools/encrypt_api_key.py` then uncomment calls inside file as needed, or run via scripts below.
- Node helper (planned): `src/services/fernet.js` for decrypt at runtime (to be implemented during Phase 1).

Copilot Coding Agent Firewall Notes
- If your Next.js or other build fetches Google Fonts during CI, allowlist these hosts in Coding Agent settings:
  - `fonts.googleapis.com`
  - `fonts.gstatic.com`
  or self-host fonts to avoid outbound calls.

Contributing
- Use small, focused PRs; keep the agent modules cohesive.
- Follow `.qoder/rules` guidelines. Keep endpoints consistent and errors as `{ error: "message" }`.

