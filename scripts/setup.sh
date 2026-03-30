#!/usr/bin/env bash
# setup.sh — ClawOps setup script
# Installs OpenClaw, NemoClaw, and the ClawOps skill

set -e

echo "🦞 ClawOps Setup"
echo "──────────────────────────────────────────"

# 1. Install OpenClaw
if ! command -v openclaw &>/dev/null; then
  echo "📦 Installing OpenClaw..."
  curl -fsSL https://openclaw.im/install.sh | bash
  source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null || true
else
  echo "✅ OpenClaw already installed ($(openclaw --version))"
fi

# 2. Install NemoClaw (NVIDIA sandbox)
if ! command -v nemoclaw &>/dev/null; then
  echo "📦 Installing NemoClaw..."
  curl -fsSL https://raw.githubusercontent.com/NVIDIA/NemoClaw/refs/heads/main/install.sh | bash
  source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null || true
else
  echo "✅ NemoClaw already installed"
fi

# 3. Install skill dependencies
echo "📦 Installing ClawOps skill dependencies..."
cd "$(dirname "$0")/.."
npm install --prefix skills/clawops-devops

# 4. Set up environment
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚙️  Created .env — please fill in your API keys"
fi

# 5. Create logs directory
mkdir -p logs-demo

# 6. Register skill with OpenClaw
if command -v openclaw &>/dev/null; then
  echo "🔗 Registering ClawOps skill with OpenClaw..."
  openclaw skills install ./skills/clawops-devops || echo "⚠️  Skill registration skipped (run 'openclaw onboard' first)"
fi

echo ""
echo "✅ ClawOps is ready!"
echo ""
echo "Quick test:"
echo "  node skills/clawops-devops/index.js 'deploy auth-service to staging'"
echo ""
echo "With OpenClaw running, just message your assistant:"
echo "  'deploy auth-service to staging'"
echo "  'show errors in payment-service logs'"
