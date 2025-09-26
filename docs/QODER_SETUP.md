Qoder Setup Guide

Prerequisites
- Install Qoder IDE (latest)
- Ensure this repo is indexed by Qoder (open the folder in Qoder)

Steps
- Generate Repo Wiki
  - Open Qoder → Repo Wiki → Generate
  - Commit `.qoder/repowiki` for team sharing (optional)

- Add Project Rules
  - Review `.qoder/rules/*` and adapt
  - These guide agents on style and structure

- Use Quest Mode
  - Start a new Quest → import/specify goals
  - Use `.qoder/quest/*.md` as starting Specs:
    - `01_htx_interface_spec.md`
    - `02_fingpt_deploy_spec.md`
    - `03_integration_spec.md`

- Configure MCP (local STDIO)
  - Qoder Settings → MCP → My Servers → +Add
  - Paste JSON (see `MCP_SETTINGS.txt`) to use `node server.js` as a local MCP server

Tips
- Keep specs concise and update during execution
- Use Agent mode with auto-run for faster iteration
- Use Rules to keep output aligned with this repo’s conventions

