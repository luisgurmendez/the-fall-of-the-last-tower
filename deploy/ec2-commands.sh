#!/bin/bash

# Siege EC2 Utility Commands
# Source this file: source deploy/ec2-commands.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load EC2 info
if [ -f "$SCRIPT_DIR/.ec2-info" ]; then
    source "$SCRIPT_DIR/.ec2-info"
else
    echo "Warning: deploy/.ec2-info not found"
    echo "Siege EC2 commands will not work until configured."
fi

# SSH into the EC2 instance
siege-ssh() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST"
}

# View server logs (follow mode)
siege-logs() {
    local lines="${1:-100}"
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "pm2 logs siege-server --lines $lines"
}

# View server logs (follow mode, streaming)
siege-logs-follow() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "pm2 logs siege-server"
}

# Restart the game server
siege-restart() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "pm2 restart siege-server"
    echo "Server restarted"
}

# Stop the game server
siege-stop() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "pm2 stop siege-server"
    echo "Server stopped"
}

# Start the game server
siege-start() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "pm2 start siege-server"
    echo "Server started"
}

# Check server status
siege-status() {
    echo "=== PM2 Status ==="
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "pm2 status"
    echo ""
    echo "=== System Resources ==="
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "free -h && echo '' && df -h / && echo '' && uptime"
}

# Check Nginx status
siege-nginx-status() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "sudo systemctl status nginx"
}

# Restart Nginx
siege-nginx-restart() {
    ssh -i "$EC2_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" \
        "sudo systemctl restart nginx"
    echo "Nginx restarted"
}

# Show EC2 info
siege-info() {
    echo "=== Siege EC2 Info ==="
    echo "Host: $EC2_HOST"
    echo "User: $EC2_USER"
    echo "Key:  $EC2_KEY"
    echo ""
    echo "Game URL: http://$EC2_HOST"
    echo "WebSocket: ws://$EC2_HOST:8080"
}

echo "Siege EC2 commands loaded. Available commands:"
echo "  siege-ssh          - SSH into server"
echo "  siege-logs [n]     - View last n lines of logs (default 100)"
echo "  siege-logs-follow  - Stream logs in real-time"
echo "  siege-restart      - Restart game server"
echo "  siege-stop         - Stop game server"
echo "  siege-start        - Start game server"
echo "  siege-status       - Check server status"
echo "  siege-nginx-status - Check Nginx status"
echo "  siege-nginx-restart - Restart Nginx"
echo "  siege-info         - Show EC2 connection info"
