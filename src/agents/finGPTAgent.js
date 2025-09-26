// finGPTAgent.js — Qoder tasks for FinGPT packaging/deploy
import { execSync } from "child_process";

export function buildDocker() {
  return "echo Build FinGPT Docker image (Dockerfile.fingpt pending)";
}

export function runLocal() {
  return "echo Run FinGPT locally via docker compose (pending)";
}

export function tfPlan() {
  try {
    const out = execSync("npm run tf:plan", { stdio: "pipe" }).toString();
    return out;
  } catch (e) {
    return e.stdout?.toString() || e.message;
  }
}

export function tfApply() {
  try {
    const out = execSync("npm run tf:apply", { stdio: "pipe" }).toString();
    return out;
  } catch (e) {
    return e.stdout?.toString() || e.message;
  }
}

