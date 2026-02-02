#!/bin/bash
set -e

# Siege EC2 Initial Setup Script
# Run this once on a fresh EC2 instance

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.ec2-info" 2>/dev/null || {
    echo "Error: deploy/.ec2-info not found"
    echo "Create it with:"
    echo "  EC2_HOST=<your-elastic-ip>"
    echo "  EC2_USER=ubuntu"
    echo "  EC2_KEY=deploy/siege-key.pem"
    exit 1
}

SSH_CMD="ssh -i $EC2_KEY -o StrictHostKeyChecking=no $EC2_USER@$EC2_HOST"
SCP_CMD="scp -i $EC2_KEY -o StrictHostKeyChecking=no"

echo "=== Siege EC2 Setup ==="
echo "Host: $EC2_HOST"
echo ""

# Upload configuration files first
echo ">>> Uploading configuration files..."
$SCP_CMD "$SCRIPT_DIR/nginx.conf" "$EC2_USER@$EC2_HOST:/tmp/siege-nginx.conf"
$SCP_CMD "$SCRIPT_DIR/siege-server.json" "$EC2_USER@$EC2_HOST:/tmp/siege-server.json"

# Run setup on EC2
$SSH_CMD << 'REMOTE_SCRIPT'
set -e

echo ">>> Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

echo ">>> Installing dependencies..."
sudo apt-get install -y curl git nginx unzip

echo ">>> Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc

echo ">>> Installing Node.js (for npm)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo ">>> Installing PM2..."
sudo npm install -g pm2

echo ">>> Cloning Siege repository..."
cd ~
if [ -d "siege" ]; then
    echo "Repository already exists, pulling latest..."
    cd siege
    git pull
else
    git clone https://github.com/luisgurmendez/siege.git
    cd siege
fi

echo ">>> Installing dependencies with bun..."
bun install

echo ">>> Building shared package..."
cd packages/shared && bun run build || true && cd ../..

echo ">>> Building server..."
cd packages/server && bun run build && cd ../..

echo ">>> Configuring Nginx..."
sudo mv /tmp/siege-nginx.conf /etc/nginx/sites-available/siege
sudo ln -sf /etc/nginx/sites-available/siege /etc/nginx/sites-enabled/siege
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ">>> Creating web directory..."
sudo mkdir -p /var/www/siege
sudo chown -R $USER:$USER /var/www/siege

echo ">>> Setting up PM2..."
mv /tmp/siege-server.json ~/siege/deploy/siege-server.json
cd ~/siege
pm2 start deploy/siege-server.json
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER | tail -1 | sudo bash

echo ""
echo "=== Setup Complete ==="
echo "Server is running on port 8080"
echo "Nginx is serving on port 80"
echo ""
echo "Next steps:"
echo "1. Run ./deploy/update-client.sh to upload the client build"
echo "2. Visit http://$(curl -s ifconfig.me) to play!"
REMOTE_SCRIPT

echo ""
echo "=== Local Setup Complete ==="
echo "EC2 instance configured at: $EC2_HOST"
