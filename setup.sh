#!/bin/bash

# Axis Shared Context - Setup Script
# Usage: ./setup.sh

echo "🟢 Initializing Axis Shared Context..."

# 1. Check for Bun
if ! command -v bun &> /dev/null; then
    echo "⚠️  Bun is not installed."
    echo "This project requires Bun (https://bun.sh)"
    echo "Installing Bun for you..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo "✅ Bun is ready."

# 2. Install Dependencies
echo "📦 Installing Dependencies..."
bun install

# 3. Environment Setup
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found."
    if [ -f .env.example ]; then
        echo "Creating .env.local from example..."
        cp .env.example .env.local
        echo "❗️ Please edit .env.local with your Supabase and OpenAI keys."
    else
        echo "❌ .env.example missing. Cannot configure environment."
        exit 1
    fi
else
    echo "✅ .env.local exists."
fi

# 4. Interactive Configuration
echo ""
echo "--- Configuration ---"
read -p "Do you want to run the database migration (v2)? (y/N) " run_mig
if [[ "$run_mig" =~ ^[Yy]$ ]]; then
   echo "Please run the content of supabase/schema_v2.sql in your Supabase SQL Editor."
fi

echo ""
echo "🚀 Setup Complete!"
echo "To start the local MCP server: bun run src/local/mcp-server.ts"
echo "To start the API server:       bun run src/api/index.ts"
