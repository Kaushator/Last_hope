#!/usr/bin/env bash
set -e
npm i -g qoder
pip install -U pip pytest httpx
if [ -d "/workspaces/Last_hope/apps/frontend" ]; then
  cd /workspaces/Last_hope/apps/frontend && npm i
fi
echo "DevContainer ready."
