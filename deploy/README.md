# Siege AWS EC2 Deployment

Deploy Siege multiplayer MOBA to AWS EC2 in São Paulo (sa-east-1).

## Live Game

**URL: http://54.20.7.138**

## Architecture

```
┌─────────────────────────────────────┐
│         EC2 (sa-east-1)             │
│         t3.small (~$15/mo)          │
├─────────────────────────────────────┤
│  Nginx (port 80)                    │
│  ├─ / → serves /var/www/siege/      │
│  └─ /ws → proxy to :8080            │
│                                     │
│  Bun (port 8080)                    │
│  └─ WebSocket game server           │
│                                     │
│  PM2 (process manager)              │
│  └─ Auto-restart on crash/reboot    │
└─────────────────────────────────────┘
```

## Quick Commands

### Update Server Code

After making changes to `packages/server/`, commit, push, then run:

```bash
./deploy/update-server.sh
```

This will:
1. SSH into EC2
2. Pull latest code from git
3. Install dependencies with bun
4. Rebuild shared and server packages
5. Restart the server with PM2

### Update Client Code

After making changes to client code (`src/`), run:

```bash
./deploy/update-client.sh
```

This will:
1. Build the client locally with production WebSocket URL
2. Upload to EC2's `/var/www/siege/`

**Note:** Client changes don't need to be committed first - the script builds locally.

### Utility Commands

```bash
# Source the utility commands first
source deploy/ec2-commands.sh

# Then use any of these:
siege-ssh           # SSH into server
siege-logs          # View last 100 lines of logs
siege-logs 500      # View last 500 lines of logs
siege-logs-follow   # Stream logs in real-time
siege-restart       # Restart game server
siege-stop          # Stop game server
siege-start         # Start game server
siege-status        # Check server status and resources
siege-nginx-status  # Check Nginx status
siege-nginx-restart # Restart Nginx
siege-info          # Show EC2 connection info
```

## Infrastructure Details

### EC2 Instance

| Property | Value |
|----------|-------|
| Instance ID | i-09c4485718189f6a7 |
| Region | sa-east-1 (São Paulo) |
| Type | t3.small (2 vCPU, 2GB RAM) |
| OS | Ubuntu 22.04 LTS |
| Storage | 20GB gp3 |
| Elastic IP | 54.20.7.138 |

### Security Group (siege-sg)

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | 0.0.0.0/0 | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP (Nginx) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (future) |
| 8080 | TCP | 0.0.0.0/0 | WebSocket |

### Installed Software

- **Bun** - JavaScript runtime (runs TypeScript directly)
- **Node.js 20** - For npm/PM2
- **PM2** - Process manager with auto-restart
- **Nginx** - Reverse proxy and static file server

## File Structure

```
deploy/
├── README.md              # This file
├── setup-ec2.sh          # One-time EC2 setup script
├── update-server.sh      # Deploy server changes
├── update-client.sh      # Deploy client changes
├── ec2-commands.sh       # Utility functions (source this)
├── nginx.conf            # Nginx configuration
├── siege-server.json     # PM2 ecosystem file
├── siege-key.pem         # SSH private key (gitignored)
├── .ec2-info             # EC2 connection details (gitignored)
└── .ec2-info.example     # Template for .ec2-info
```

## Initial Setup (Already Done)

These steps have been completed. Documented here for reference.

### 1. Create AWS Infrastructure

```bash
# Source personal AWS credentials
source .envrc

# Create security group
aws ec2 create-security-group \
  --group-name siege-sg \
  --description "Siege game server" \
  --region sa-east-1

# Add security group rules (SSH, HTTP, HTTPS, WebSocket)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0ba4dd1b5a3c10289 \
  --protocol tcp --port 22 --cidr 0.0.0.0/0 \
  --region sa-east-1
# ... repeat for ports 80, 443, 8080

# Create key pair
aws ec2 create-key-pair \
  --key-name siege-key \
  --query 'KeyMaterial' \
  --output text \
  --region sa-east-1 > deploy/siege-key.pem
chmod 400 deploy/siege-key.pem

# Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0533a139e02b00be4 \
  --instance-type t3.small \
  --key-name siege-key \
  --security-group-ids sg-0ba4dd1b5a3c10289 \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=siege-server}]' \
  --region sa-east-1

# Allocate and associate Elastic IP
aws ec2 allocate-address --domain vpc --region sa-east-1
aws ec2 associate-address \
  --instance-id i-09c4485718189f6a7 \
  --allocation-id eipalloc-0465e9035f3936395 \
  --region sa-east-1
```

### 2. Run Setup Script

```bash
./deploy/setup-ec2.sh
```

### 3. Deploy Client

```bash
./deploy/update-client.sh
```

## Monitoring & Troubleshooting

### View Server Logs

```bash
source deploy/ec2-commands.sh
siege-logs          # Last 100 lines
siege-logs-follow   # Stream live
```

Or SSH in directly:
```bash
siege-ssh
pm2 logs siege-server
```

### Check Server Status

```bash
siege-status
```

Shows PM2 process status, memory usage, disk space, and uptime.

### Server Not Starting

```bash
siege-ssh
pm2 logs siege-server --lines 100
```

Common issues:
- Port 8080 already in use
- Missing dependencies (run `bun install`)
- TypeScript errors (bun runs TS directly, but check logs)

### Client Not Connecting

1. Check security group allows port 8080
2. Verify Nginx is running: `siege-nginx-status`
3. Check WebSocket URL in client matches EC2 IP
4. Test WebSocket endpoint: `curl http://54.20.7.138:8080/health`

### Restart Everything

```bash
siege-ssh
pm2 restart siege-server
sudo systemctl restart nginx
```

## Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| EC2 t3.small | ~$15 |
| Elastic IP (attached) | Free |
| Data transfer | ~$0.09/GB |
| **Total** | ~$15-20/month |

## Future Improvements

- [ ] Add HTTPS with Let's Encrypt
- [ ] Set up domain name
- [ ] Add CloudWatch monitoring
- [ ] Create AMI for faster recovery
- [ ] Add load balancing for multiple game servers
