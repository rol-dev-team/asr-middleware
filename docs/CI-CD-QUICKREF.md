# CI/CD Quick Reference

## Setup Checklist

### One-Time Setup

- [ ] Create DockerHub account and repositories
- [ ] Generate DockerHub access token
- [ ] Add GitHub Secrets (8 secrets total)
- [ ] Setup SSH key for VM access
- [ ] Copy `.env.example` to `.env` on VM
- [ ] Run initial deployment on VM

### GitHub Secrets Required

```
DOCKERHUB_USERNAME      # Your DockerHub username
DOCKERHUB_TOKEN         # DockerHub access token
VM_HOST                 # VM IP or hostname
VM_USERNAME             # SSH username
VM_SSH_KEY              # Private SSH key content
VM_SSH_PORT             # SSH port (optional, default: 22)
VM_DEPLOY_PATH          # Project path on VM
```

## Common Commands

### On VM Server

```bash
# Initial setup
cd /home/ubuntu/asr-middleware
cp .env.example .env
# Edit .env with your values
chmod +x scripts/vm-deploy.sh

# First deployment
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Manual deployment
./scripts/vm-deploy.sh

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps

# Restart service
docker-compose -f docker-compose.prod.yml restart backend

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Database backup
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres ASRMiddleware | gzip > backup.sql.gz
```

### From Local Machine

```bash
# Trigger automatic deployment
git push origin main

# SSH to VM
ssh user@vm-ip

# Test SSH connection
ssh user@vm-ip "docker ps"
```

## Workflow Behavior

| Event | Action |
|-------|--------|
| Push to `main` | Automatic build + deploy |
| Push to other branch | No action |
| Manual trigger | Build + deploy (any branch) |
| Pull request | No action (can be configured) |

## Files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | GitHub Actions workflow |
| `scripts/vm-deploy.sh` | VM deployment script |
| `docker-compose.prod.yml` | Production docker config |
| `docker-compose.yml` | Development docker config |
| `.env` | Environment variables (VM only) |

## Troubleshooting Quick Fixes

```bash
# Workflow fails at build
→ Check GitHub Actions logs
→ Verify Dockerfile syntax

# Workflow fails at push
→ Check DOCKERHUB_USERNAME and DOCKERHUB_TOKEN secrets
→ Verify DockerHub repositories exist

# Deployment fails at SSH
→ Test: ssh -i ~/.ssh/key user@vm-ip
→ Verify VM_SSH_KEY secret has full key including headers
→ Check VM_HOST, VM_USERNAME, VM_DEPLOY_PATH

# Deployment fails at migration
→ docker-compose -f docker-compose.prod.yml exec backend alembic current
→ Check database connection
→ Review backend logs

# Service won't start
→ docker-compose -f docker-compose.prod.yml logs backend
→ Check .env file exists and is correct
→ Verify disk space: df -h
```

## Health Check URLs

- Backend API: `http://your-vm-ip/api/docs`
- Frontend: `http://your-vm-ip/`
- Nginx health: `http://your-vm-ip/health`

## Rollback

```bash
# See available image versions
docker images | grep asr-middleware

# Use specific version
# Edit docker-compose.prod.yml:
#   image: username/asr-middleware-backend:main-abc1234

# Restart
docker-compose -f docker-compose.prod.yml up -d backend frontend

# Rollback migration
docker-compose -f docker-compose.prod.yml exec backend alembic downgrade -1
```
