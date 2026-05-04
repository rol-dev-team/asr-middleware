# CI/CD Quick Reference

## Setup Checklist

### One-Time Setup

- [ ] Create DockerHub account and repositories
- [ ] Generate DockerHub access token
- [ ] Add GitHub Secrets (8 secrets total)
- [ ] Setup SSH key for VM access
- [ ] Ensure Docker + Docker Compose v2 installed on VM
- [ ] Confirm the workflow can create the deployment directory on VM

### GitHub Secrets Required

```
DOCKERHUB_USERNAME      # Your DockerHub username
DOCKERHUB_TOKEN         # DockerHub access token
VM_HOST                 # VM IP or hostname
VM_USER                 # SSH username
VM_SSH_KEY              # Private SSH key content
VM_PORT                 # SSH port (e.g. 22)

# App secrets written into VM .env during deploy
DB_USER
DB_PASSWORD
DB_NAME
DB_PORT
GEMINI_API_KEY
SECRET_KEY
ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS
BACKEND_PORT
```

## Common Commands

### On VM Server

```bash
# The GitHub Action deploys using docker-compose.deploy.yml
# and creates/overwrites .env in the deploy directory.

# View logs
docker compose -f docker-compose.deploy.yml logs -f

# Check status
docker compose -f docker-compose.deploy.yml ps

# DB data persists in the postgres_data volume
docker volume ls | grep postgres_data

# Run migrations manually (usually automatic on backend container start)
docker compose -f docker-compose.deploy.yml exec backend alembic upgrade head

# Database backup
docker compose -f docker-compose.deploy.yml exec -T db pg_dump -U postgres ASRMiddleware | gzip > backup.sql.gz
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
| `.github/workflows/build-and-deploy.yml` | GitHub Actions build + deploy workflow |
| `docker-compose.deploy.yml` | VM deploy compose (db + redis + backend + worker) |
| `backend/entrypoint.sh` | Runs `alembic upgrade head` then starts Uvicorn |
| `backend/docker-compose.yml` | Backend-only local compose (run from `backend/`) |

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
→ Check VM_HOST, VM_USER, VM_PORT

# Deployment fails at migration
→ docker compose -f docker-compose.deploy.yml logs --tail 200 backend
→ docker compose -f docker-compose.deploy.yml exec backend alembic current
→ Check database connection
→ Review backend logs

# Service won't start
→ docker compose -f docker-compose.deploy.yml logs backend
→ Check DB credentials and volume state
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
