#!/usr/bin/env bash
set -e

echo "📦 Installing dependencies..."
sudo apt-get update -y || true

# Node.js
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Terraform
if ! command -v terraform >/dev/null 2>&1; then
  sudo apt-get install -y wget unzip
  wget -q https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
  unzip terraform_1.6.6_linux_amd64.zip
  sudo mv terraform /usr/local/bin/
  rm terraform_1.6.6_linux_amd64.zip
fi

# Docker
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get install -y docker.io
  sudo systemctl enable --now docker
fi

# GitHub CLI
if ! command -v gh >/dev/null 2>&1; then
  type -p curl >/dev/null || (sudo apt-get update && sudo apt-get install curl -y)
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install gh -y
fi

# GitHub login
echo "🔑 GitHub login..."
gh auth login --with-token < ~/.gh_token || true

echo "🐳 Docker login GHCR..."
echo $GH_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# MCP server check
echo "⚡ Checking MCP server..."
npm install
npm run start & sleep 3
curl -s http://localhost:4000/tests -X POST -H "Content-Type: application/json" -d '{"code":"console.log(123)"}'

# Terraform apply
echo "⚡ Applying Terraform infra..."
cd terraform
terraform init
terraform apply -auto-approve
cd ..
