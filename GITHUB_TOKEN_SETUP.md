# Environment Variables Setup

## GitHub Token Configuration

The GitHub token for this project should be set as an environment variable rather than hard-coded in configuration files for security reasons.

### Setting up the Environment Variable

**Windows (PowerShell):**
```powershell
set GITHUB_TOKEN=your_github_token_here
```

**Linux/macOS:**
```bash
export GITHUB_TOKEN=your_github_token_here
```

### Required Token Scopes

The GitHub personal access token requires the following scopes:
- `user` (minimum required)
- `codespace` (minimum required)
- `repo` (recommended for full functionality)
- `read:org` (recommended)
- `workflow` (recommended)

### Usage in MCP Server

The MCP server will automatically pick up the `GITHUB_TOKEN` environment variable when running. Make sure to set this variable before starting the server:

```bash
# Set the token
set GITHUB_TOKEN=your_token_here

# Start the MCP server
npm run dev:debug
```

### Security Notes

- Never commit GitHub tokens to version control
- Use `.env` files that are git-ignored for local development
- For production, use proper secret management systems
- GitHub's push protection will block commits containing tokens

### Configuration Files

The following configuration files reference the environment variable:
- `mcp-config.json`
- `mcp-dev-config.json` 
- `mcp-client-config.json`

These files use environment variable placeholders like `${GITHUB_TOKEN}` instead of the actual token values.