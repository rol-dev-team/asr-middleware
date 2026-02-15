# CI/CD Setup Guide

This guide explains the automated deployment workflow for the ASR Middleware application.

## Overview

The CI/CD pipeline automatically:
1. Builds Docker images for backend and frontend when code is pushed to `main` branch
2. Pushes images to DockerHub
3. Deploys the new images to your VM server
4. Keeps the database container running (no downtime for data)
5. Runs database migrations automatically via Alembic

## Architecture

```
GitHub Repository (main branch)
    ↓ (push/merge)
GitHub Actions Workflow
    ↓
Build & Push to DockerHub
    ↓
SSH into VM Server
    ↓
Pull Latest Images
    ↓
Update Backend & Frontend Containers
    ↓
Run Alembic Migrations
    ↓
Restart Services
```

## Prerequisites

### 1. DockerHub Account
You need a DockerHub account to store your images:
- Sign up at https://hub.docker.com
- Create two repositories:
  - `asr-middleware-backend`
  - `asr-middleware-frontend`
- Generate an access token: Account Settings → Security → New Access Token

### 2. GitHub Repository Secrets
Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DOCKERHUB_USERNAME` | Your DockerHub username | `johndoe` |
| `DOCKERHUB_TOKEN` | Your DockerHub access token | `dckr_pat_xxxxx...` |
| `VM_HOST` | Your VM server IP or hostname | `192.168.1.100` or `server.example.com` |
| `VM_USERNAME` | SSH username for VM | `ubuntu` or `deploy` |
| `VM_SSH_KEY` | Private SSH key for VM access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VM_SSH_PORT` | SSH port (optional, default: 22) | `22` |
| `VM_DEPLOY_PATH` | Absolute path to project on VM | `/home/ubuntu/asr-middleware` |

### 3. VM Server Setup

#### a. Prepare the VM Environment
```bash
# Create .env file in project root
cat > .env << EOF
DOCKERHUB_USERNAME=your_dockerhub_username
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=ASRMiddleware
HTTP_PORT=80
HTTPS_PORT=443
EOF

# Make deployment script executable
chmod +x scripts/vm-deploy.sh
```

#### b. Initial Deployment on VM
For the first deployment, you need to start all services:

```bash
cd /path/to/asr-middleware

# Start all services including database
docker-compose -f docker-compose.prod.yml up -d

# Run initial migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Check status
docker-compose -f docker-compose.prod.yml ps
```

#### c. Configure SSH Access
The GitHub Actions workflow needs SSH access to deploy:

```bash
# On your local machine, generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy the public key to your VM
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-vm-ip

# Test the connection
ssh user@your-vm-ip "echo 'SSH connection successful'"

# Copy the PRIVATE key content and add it to GitHub Secrets as VM_SSH_KEY
cat ~/.ssh/id_ed25519
```

## Workflow Files

### 1. GitHub Actions Workflow
Location: `.github/workflows/deploy.yml`

This workflow:
- Triggers on push to `main` branch
- Can be manually triggered from GitHub Actions UI
- Builds Docker images with caching for faster builds
- Tags images with `latest` and git commit SHA
- Pushes to DockerHub
- SSHs into VM and runs deployment script

### 2. VM Deployment Script
Location: `scripts/vm-deploy.sh`

This script (runs on VM):
- Pulls latest images from DockerHub
- Stops and removes old backend/frontend containers
- Starts new containers with updated images
- Waits for backend to be healthy
- Runs Alembic migrations
- Restarts Nginx proxy
- Cleans up old images

### 3. Production Docker Compose
Location: `docker-compose.prod.yml`

Uses pre-built images from DockerHub instead of building locally.

## Usage

### Automatic Deployment
Simply push or merge to the `main` branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

The workflow will automatically:
1. Build images (~2-5 minutes)
2. Push to DockerHub (~1-2 minutes)
3. Deploy to VM (~1-2 minutes)

### Manual Deployment
From GitHub:
1. Go to Actions tab
2. Select "Build and Deploy" workflow
3. Click "Run workflow"
4. Select branch and confirm

### Monitor Deployment
1. **GitHub Actions**: Check the Actions tab for build status
2. **VM Logs**: 
   ```bash
   ssh user@vm-ip
   cd /path/to/project
   docker-compose -f docker-compose.prod.yml logs -f
   ```

## Docker Compose Configurations

### Development (Local)
Use `docker-compose.yml` for local development:
```bash
docker-compose up --build
```

### Production (VM)
Use `docker-compose.prod.yml` for production (uses DockerHub images):
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Build Fails
- **Check logs**: GitHub Actions → Failed workflow → Check step logs
- **Common issues**:
  - Missing dependencies in Dockerfile
  - Test failures
  - Docker build context issues

### Push to DockerHub Fails
- Verify `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets
- Check DockerHub repositories exist
- Verify token has write permissions

### Deployment Fails
- **SSH Connection Issues**:
  ```bash
  # Test SSH from local machine
  ssh -i ~/.ssh/key user@vm-ip
  ```
- **Docker Issues on VM**:
  ```bash
  # Check Docker is running
  docker info
  
  # Check disk space
  df -h
  ```
- **Image Pull Issues**:
  ```bash
  # Login to DockerHub on VM
  docker login
  
  # Manually pull image
  docker pull username/asr-middleware-backend:latest
  ```

### Migration Fails
- **Check database connection**:
  ```bash
  docker-compose -f docker-compose.prod.yml exec backend python -c "from app.api.db import engine; print('Connected')"
  ```
- **View migration status**:
  ```bash
  docker-compose -f docker-compose.prod.yml exec backend alembic current
  ```
- **View migration history**:
  ```bash
  docker-compose -f docker-compose.prod.yml exec backend alembic history
  ```
- **Rollback migration** (if needed):
  ```bash
  docker-compose -f docker-compose.prod.yml exec backend alembic downgrade -1
  ```

### Service Health Check Fails
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Check if backend is responding
curl http://localhost:8000/docs
```

## Manual Operations on VM

### Update Services Manually
```bash
cd /home/ubuntu/asr-middleware
./scripts/vm-deploy.sh
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Restart Services
```bash
# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# Restart all services
docker-compose -f docker-compose.prod.yml restart
```

### Check Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Run Migrations Manually
```bash
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Database Backup
```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres ASRMiddleware | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore backup
gunzip < backup_20260213_120000.sql.gz | docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres ASRMiddleware
```

### Clean Up Old Images
```bash
# Remove unused images
docker image prune -a -f

# Remove unused volumes (BE CAREFUL!)
docker volume prune -f
```

## Security Best Practices

1. **SSH Key**: Use a dedicated SSH key for deployments (not your personal key)
2. **Secrets**: Never commit secrets to git
3. **VM Access**: Restrict SSH access to specific IPs if possible
4. **Database**: Use strong passwords and restrict access
5. **SSL/TLS**: Configure HTTPS with valid certificates
6. **Firewall**: Only expose necessary ports (80, 443, 22)

## Rollback Strategy

### Rollback to Previous Version
If deployment fails, you can rollback:

1. **Using Git SHA Tags**:
   ```bash
   # List available tags
   docker images | grep asr-middleware-backend
   
   # Update docker-compose.prod.yml to use specific SHA tag
   # backend:
   #   image: username/asr-middleware-backend:main-abc1234
   
   # Restart services
   docker-compose -f docker-compose.prod.yml up -d backend frontend
   ```

2. **Revert Database Migration**:
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend alembic downgrade -1
   ```

## Monitoring

### Health Checks
The application includes health checks:
- Backend: `http://your-vm-ip/api/docs`
- Database: Automatic health check in docker-compose

### Logs
Monitor logs for issues:
```bash
# Real-time logs
docker-compose -f docker-compose.prod.yml logs -f

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Cost Optimization

1. **Image Caching**: GitHub Actions uses cache to speed up builds
2. **Multi-stage Builds**: Dockerfiles use multi-stage builds to reduce image size
3. **Image Cleanup**: Deployment script automatically removes old images
4. **Build Only When Needed**: Workflow only triggers on `main` branch changes

## Support

For issues or questions:
1. Check GitHub Actions logs
2. Review VM deployment script logs
3. Verify all secrets are configured correctly
4. Check DockerHub for image availability
