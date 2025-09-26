Specific Files — Node Server & Agents

Files: server.js, src/**/*.js

- Maintain ESM syntax: `import ... from` and `export`.
- Agents in `src/agents/*` should export small functions callable from Qoder tasks.
- Infrastructure actions should be guarded (dry-run or plan first) and log clearly.
- Keep console output concise; prefer structured messages.

