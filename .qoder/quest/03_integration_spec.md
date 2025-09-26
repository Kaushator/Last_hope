Integration — Spec

Goal
- Connect HTX analytics and FinGPT flows while allowing each to run separately. Surface analytics via endpoints and persist to GCS when enabled.

Scope
- `src/services/gcs.js` for upload/download JSON + Excel (optional MinIO for dev).
- `/analytics/summary` endpoint: gather latest HTX data + call FinGPT `/predict`; return insights JSON.
- `/analytics/report/:id` endpoint: fetch stored report from GCS.
- Feature flags: `ENABLE_FINGPT`, `ENABLE_GCS`, `ENABLE_HTX_API`.

Acceptance
- Standalone HTX and FinGPT modes work independently.
- Integrated flow returns an insights JSON and can persist/retrieve in GCS.

Plan (High-Level)
1) Add GCS helper with env-based config and simple wrapper.
2) Add `/analytics/*` endpoints with clear error handling and tests.
3) Extend orchestrator agent with end-to-end tasks.

