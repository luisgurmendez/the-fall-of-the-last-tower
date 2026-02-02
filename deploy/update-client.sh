#!/bin/bash
set -e

# Siege Client Update Script
# Builds client locally and uploads to EC2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/.ec2-info" 2>/dev/null || {
    echo "Error: deploy/.ec2-info not found"
    exit 1
}

SCP_CMD="scp -i $EC2_KEY -o StrictHostKeyChecking=no -r"
SSH_CMD="ssh -i $EC2_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST"

echo "=== Updating Siege Client ==="
echo "Host: $EC2_HOST"
echo ""

cd "$PROJECT_DIR"

echo ">>> Building client..."
# Set production WebSocket URL and use simple build (no js13k compression)
export VITE_WS_URL="ws://$EC2_HOST:8080"
export SIMPLE_BUILD=true
npx vite build

echo ">>> Uploading to EC2..."
$SCP_CMD dist/* "$EC2_USER@$EC2_HOST:/var/www/siege/"

echo ">>> Setting permissions..."
$SSH_CMD "sudo chown -R www-data:www-data /var/www/siege"

echo ""
echo "=== Client Updated ==="
echo "Visit: http://$EC2_HOST"
