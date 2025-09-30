# Setup Dev Stack (CUDA), Terraform & CI; remove CryptoPanic

## Summary
- Adds **DevContainer + Qoder** (token-saver config)
- Adds **Docker dev stack** (Postgres, Redis, Backend, Frontend) + **FinGPT (CUDA)** container
- Adds **Terraform** (GCP: BigQuery tables, GCS bucket, Secret Manager)
- Adds **CI** (GitHub Actions: frontend lint/tests, backend pytest, TruffleHog)
- Removes **CryptoPanic** artefacts and references
- Provides `.env.example` and `Makefile`

## Checklist
- [ ] Fill `.env` with HTX/OpenAI/(optional) CoinGecko keys
- [ ] `make up` starts all services successfully
- [ ] `http://localhost:8000/health` and `http://localhost:9000/health` are reachable
- [ ] CI passes on this PR
- [ ] (If using GCP) `terraform apply` created BigQuery dataset/tables, GCS bucket and Secrets
- [ ] No remaining references to CryptoPanic in the codebase

## Notes
- DevContainer auto-installs `qoder` and front-end deps on first start
- FinGPT container uses CUDA 12.1 runtime; ensure NVIDIA drivers on Windows and WSL2 integration are enabled
