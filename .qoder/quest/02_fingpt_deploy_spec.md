FinGPT Deploy — Spec

Goal
- Package FinGPT as a Docker service locally and deploy to GCP (Cloud Run or GKE) via Terraform. Integrate health checks and basic `/predict` endpoint.

Scope
- Dockerfile.fingpt + docker-compose service.
- Terraform modules for Artifact Registry + runtime + IAM.
- CI: build, scan (optional), push; then `terraform plan` (PR) and `apply` (main).

Acceptance
- Local: `docker compose up` brings FinGPT healthy; `/health` endpoint returns 200.
- Remote: successful Cloud Run or GKE deployment; health check green.

Plan (High-Level)
1) Add `Dockerfile.fingpt` (Python base, model config via env), expose `/predict` and `/health`.
2) Add `docker-compose.yml` linking `mcp-server` and `fingpt` network.
3) Terraform: modules for storage, artifact registry, runtime (CR/GKE), IAM service account.
4) Add npm scripts for compose and terraform flows; docs for GCP creds.
5) Qoder tasks in `src/agents/finGPTAgent.js` to build/run/test and plan/apply infra.

