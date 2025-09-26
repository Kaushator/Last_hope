Agent Working Notes

Scope
- These notes guide AI agents (Qoder, Copilot Coding Agent, Codex CLI) contributing to this repo.

Conventions
- Keep changes minimal and focused on the task at hand.
- Node 18+, ESM syntax, Express for HTTP.
- Move logic to `src/services/*`; keep `server.js` endpoints thin.
- Return errors as `{ error: "message" }` with appropriate HTTP status.
- Do not commit plaintext secrets. Prefer Fernet-encrypted files or environment variables.

Files & Structure
- `server.js`: MCP server endpoints `/tests`, `/billing`, `/lint`. Add `/health` if needed.
- `src/agents/*`: Simple exported functions, used by Qoder tasks.
- `tools/encrypt_api_key.py`: Fernet helper (Python). Provide CLI steps in README.
- `terraform/*`: Provisioning for GCP in Phase 2.
- `.qoder/*`: Qoder Quest Mode scaffolding: rules, wiki, and spec templates.

Qoder Quest Mode
- Store Specs in `.qoder/quest/`.
- Repo Wiki lives in `.qoder/repowiki/` — commit to share across the team.
- Rules in `.qoder/rules/` — Always Apply + Model Decision + Specific Files.

Testing & Validation
- Prefer Jest for unit/integration tests.
- Keep stubs or feature flags where external services are not available.
- Avoid changing unrelated files or styles.

