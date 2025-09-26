Always Apply — Project Rules

- Use Node.js 18+, ESM modules (`type: module`).
- Keep server endpoints in `server.js` small; move logic to `src/services/*`.
- Error shape: return `{ error: "message" }` with appropriate HTTP status.
- Avoid plaintext secrets; prefer Fernet-encrypted files or env.
- Tests: use Jest; add unit tests when adding new services.
- Keep changes minimal and focused; don’t refactor unrelated code.
- Use consistent naming: `htx*` for exchange features; `finGPT*` for model service.
- For paths in docs, avoid absolute OS-specific paths. Prefer relative paths.

