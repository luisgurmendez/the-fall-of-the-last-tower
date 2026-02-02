#!/bin/bash
set -e

# Siege Server Update Script
# Pulls latest code, rebuilds, and restarts the server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.ec2-info" 2>/dev/null || {
    echo "Error: deploy/.ec2-info not found"
    exit 1
}

SSH_CMD="ssh -i $EC2_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST"

echo "=== Updating Siege Server ==="
echo "Host: $EC2_HOST"
echo ""

$SSH_CMD << 'REMOTE_SCRIPT'
set -e
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

cd ~/siege

echo ">>> Pulling latest code..."
git pull

echo ">>> Installing dependencies..."
bun install

echo ">>> Rebuilding shared package..."
cd packages/shared && bun run build || true && cd ../..

echo ">>> Rebuilding server..."
cd packages/server && bun run build && cd ../..

echo ">>> Restarting server..."
pm2 restart siege-server

echo ""
echo "=== Server Updated ==="
pm2 status
REMOTE_SCRIPT

echo ""
echo "Server update complete!"
