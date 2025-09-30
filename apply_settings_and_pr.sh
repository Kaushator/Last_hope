#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH:-chore/setup-infra-no-cryptopanic}"
ZIP_PATH="${ZIP_PATH:-last_hope_settings.zip}"
REPO_DIR="${REPO_DIR:-.}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "❌ REPO_DIR does not look like a git repo: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

echo "🔎 Checking prerequisites..."
command -v git >/dev/null || { echo "git not found"; exit 1; }
if ! command -v gh >/dev/null; then
  echo "⚠️ GitHub CLI (gh) not found. You can still commit/push manually."
  USE_GH=0
else
  USE_GH=1
fi

echo "📦 Unpacking settings archive: $ZIP_PATH"
if [ ! -f "$ZIP_PATH" ]; then
  echo "❌ Archive not found in $PWD: $ZIP_PATH"
  exit 1
fi

TMPDIR="$(mktemp -d)"
unzip -q "$ZIP_PATH" -d "$TMPDIR"

# Copy settings into repo root (no rsync)
cp -r "$TMPDIR"/last_hope_settings/* ./ || true

rm -rf "$TMPDIR"

echo "🧹 Removing CryptoPanic artefacts (files and obvious references)."
find . -type f -iname "*cryptopanic*" -print -delete || true
find . -type d -iname "*cryptopanic*" -print -exec rm -rf {} + || true

echo "🔍 Searching for remaining references to CryptoPanic:"
if command -v rg >/dev/null; then
  rg -n --ignore-case "cryptopanic" || true
else
  grep -Rin "cryptopanic" . || true
fi

echo "🌿 Creating branch: $BRANCH"
git checkout -b "$BRANCH" || git checkout "$BRANCH"

echo "➕ Staging changes..."
git add -A

echo "📝 Commit..."
git commit -m "chore: add DevContainer, Docker (CUDA), Terraform, CI; remove CryptoPanic artefacts; add Qoder config" || true

echo "🚀 Push branch..."
git push -u origin "$BRANCH"

if [ "$USE_GH" -eq 1 ]; then
  echo "🔧 Opening PR via gh..."
  gh pr create --fill --title "Setup dev stack (CUDA), Terraform & CI; remove CryptoPanic" --body-file PR_BODY.md || true
  echo "✅ PR created."
else
  echo "ℹ️ GitHub CLI not available. Open a PR manually on GitHub."
fi

echo "Done."
