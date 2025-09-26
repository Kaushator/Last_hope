# HTX Analytics – Setup Guide

## 1. Requirements
- Windows 11 with WSL2
- GitHub account with Codespaces enabled
- Docker Desktop (with WSL2 integration)
- Node.js v18+
- Python 3.10+ and pip
- Terraform CLI
- Qoder installed (npm i -g qoder)
- GitHub Copilot subscription

## 2. Local setup (Qoder)
1. Clone repo: `git clone <your-repo>`
2. Install deps: `npm install`
3. Run Qoder: `qoder start`
4. Use Qoder agents for CSV parsing, Docker, Terraform.

## 3. Codespaces setup
1. Push repo to GitHub
2. Open in Codespaces
3. Devcontainer auto-installs Node, Docker CLI, Terraform, Python
4. Copilot extensions preinstalled

## 4. GitHub Actions CI
- Workflow `.github/workflows/tests.yml` runs tests on push/PR
- Requires `npm test` configured in package.json

## 5. Secrets
- HTX API key (local): encrypt with Python Fernet
- GCP secrets: store in Google Secret Manager + GitHub Secrets
- Codespaces secrets: add in repo → Settings → Codespaces secrets

## 6. Workflow
- Local (WSL2): Qoder generates code
- Push to GitHub
- Codespaces: Copilot generates tests
- GitHub Actions: run CI tests
- GCP: Terraform applies infra, runs FinGPT
