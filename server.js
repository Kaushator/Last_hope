// server.js – MCP Server for Copilot integration
import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import { exec } from "child_process";

const app = express();
app.use(bodyParser.json());

// === /tests endpoint ===
app.post("/tests", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });

  const testStub = `import { describe, it, expect } from '@jest/globals';
import module from '../src/index.js';

describe('Auto Tests', () => {
  it('should run without crashing', () => {
    expect(typeof module).toBeDefined();
  });
});`;

  res.json({ tests: testStub });
});

// === /billing endpoint ===
app.get("/billing", async (req, res) => {
  try {
    const ghToken = process.env.GITHUB_TOKEN;
    if (!ghToken) return res.status(403).json({ error: "Missing GitHub token" });

    const response = await fetch("https://api.github.com/user/billing/copilot", {
      headers: { Authorization: `Bearer ${ghToken}`, "User-Agent": "MCP-Server" }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === /lint endpoint ===
app.post("/lint", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });

  exec("npx eslint --stdin --format json", { input: code }, (err, stdout) => {
    if (err) return res.json({ lint: "Linting errors", details: stdout });
    res.json({ lint: "OK", details: stdout });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`⚡ MCP Server running on port ${PORT}`));
