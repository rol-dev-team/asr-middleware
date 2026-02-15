# ASR Middleware Deployment Guide

## Overview
This guide covers deploying the ASR Middleware application with Docker containers for production use.

## Architecture
- **Backend**: FastAPI application (Python)
- **Frontend**: React/Vite application served via Nginx
- **Database**: PostgreSQL 16
- **Reverse Proxy**: Nginx (routes /api to backend, / to frontend)

## Prerequisites
- Docker Engine 20.10+
- Docker Compose V2
- 2GB+ RAM
- 10GB+ disk space
- Open ports: 80 (HTTP), 443 (HTTPS)

## Initial Setup

### 1. Clone and Prepare Environment Files

```bash
# Copy environment examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Configure Backend Environment
Edit `backend/.env` with your actual values:

```env
# Database (must match docker-compose settings)
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_DB_PASSWORD@db:5432/ASRMiddleware

# API Keys
GEMINI_API_KEY=your_actual_gemini_api_key

# Security (generate with: openssl rand -hex 32)
SECRET_KEY=your_generated_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. Configure Docker Environment
Create a `.env` file in the project root for Docker Compose:

```env
# Database credentials
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_NAME=ASRMiddleware
DB_PORT=5432

# Ports
HTTP_PORT=80
HTTPS_PORT=443
```

### 4. Configure Frontend (Optional)
Edit `frontend/.env` if needed:

```env
# Use /api for nginx-proxied requests (recommended)
VITE_API_BASE_URL=/api
```

## Deployment

### Production Deployment

```bash
# Build and start all services
docker-compose up -d --build

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Run Database Migrations

```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Create first admin user (optional)
docker-compose exec backend python -m app.scripts.create_admin
```

### Verify Deployment

```bash
# Check health endpoints
curl http://localhost/health              # Nginx health
curl http://localhost/api/docs           # API docs (Swagger UI)

# Check all containers are healthy
docker-compose ps
```

## SSL/HTTPS Configuration

### 1. Obtain SSL Certificates

**Option A: Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem backend/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem backend/nginx/ssl/key.pem
```

**Option B: Self-Signed (Development Only)**
```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/nginx/ssl/key.pem \
  -out backend/nginx/ssl/cert.pem
```

### 2. Enable HTTPS in Nginx
Edit `backend/nginx/conf.d/default.conf` and uncomment the HTTPS section:

```nginx
# Uncomment these lines
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

### 3. Restart Nginx
```bash
docker-compose restart nginx
```

## Firewall Configuration

### UFW (Ubuntu)
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Firewalld (CentOS/RHEL)
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Cloud Provider Setup

### AWS EC2
1. Create EC2 instance (t3.medium or larger recommended)
2. Configure Security Group:
   - Inbound: HTTP (80), HTTPS (443), SSH (22)
3. Assign Elastic IP for static IP address
4. Configure Route 53 for domain management

### Google Cloud Platform
1. Create Compute Engine instance
2. Configure firewall rules:
   ```bash
   gcloud compute firewall-rules create allow-http --allow tcp:80
   gcloud compute firewall-rules create allow-https --allow tcp:443
   ```
3. Reserve static external IP
4. Configure Cloud DNS

### Azure
1. Create Virtual Machine
2. Configure Network Security Group:
   - Allow: HTTP (80), HTTPS (443), SSH (22)
3. Assign Public IP address
4. Configure Azure DNS

### DigitalOcean
1. Create Droplet (2GB+ RAM recommended)
2. Firewall rules are automatic for HTTP/HTTPS
3. Configure DNS in Networking section

## Monitoring

### View Real-time Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f nginx
```

### Check Resource Usage
```bash
docker stats
```

### Health Checks
```bash
# Overall health
curl http://localhost/health

# Backend API
curl http://localhost/api/docs

# Database connection
docker-compose exec backend python -c "from app.api.db import engine; print('DB OK')"
```

## Backup and Restore

### Database Backup
```bash
# Create backup
docker-compose exec db pg_dump -U postgres ASRMiddleware > backup_$(date +%Y%m%d).sql

# With Docker
docker-compose exec -T db pg_dump -U postgres ASRMiddleware | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Database Restore
```bash
# Restore from backup
docker-compose exec -T db psql -U postgres ASRMiddleware < backup_20240208.sql

# From compressed backup
gunzip -c backup_20240208.sql.gz | docker-compose exec -T db psql -U postgres ASRMiddleware
```

### Media Files Backup
```bash
# Backup media directory
tar -czf media_backup_$(date +%Y%m%d).tar.gz backend/media/
```

## Maintenance

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Run new migrations
docker-compose exec backend alembic upgrade head
```

### Scale Services
```bash
# Scale backend (requires load balancer configuration)
docker-compose up -d --scale backend=3
```

### Clean Up
```bash
# Remove stopped containers
docker-compose down

# Remove with volumes (WARNING: deletes database)
docker-compose down -v

# Clean up unused images
docker system prune -a
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Inspect container
docker-compose ps
docker inspect asr-middleware-backend
```

### Database Connection Issues
```bash
# Check database is running
docker-compose ps db

# Test connection
docker-compose exec backend python -c "from app.api.db import engine; engine.connect()"

# Check DATABASE_URL in backend/.env
```

### Permission Issues
```bash
# Fix media directory permissions
sudo chown -R 1000:1000 backend/media
```

### Nginx Configuration Issues
```bash
# Test nginx config
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload
```

### Out of Memory
```bash
# Check resource usage
docker stats

# Increase VM resources or upgrade instance
# Add swap space (Linux):
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Security Best Practices

1. **Change Default Credentials**: Update all default passwords in `.env` files
2. **Use Strong Secrets**: Generate SECRET_KEY with `openssl rand -hex 32`
3. **Enable HTTPS**: Always use SSL/TLS in production
4. **Firewall**: Only expose necessary ports (80, 443)
5. **Regular Updates**: Keep Docker images and dependencies updated
6. **Backup**: Implement regular automated backups
7. **Monitoring**: Set up monitoring and alerting
8. **Rate Limiting**: Consider adding rate limiting to nginx
9. **Environment Files**: Never commit `.env` files to version control
10. **Non-root Users**: Containers run as non-root users (already configured)

## Performance Tuning

### Database
```env
# Add to docker-compose.yml under db.environment
- POSTGRES_SHARED_BUFFERS=256MB
- POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
- POSTGRES_MAX_CONNECTIONS=100
```

### Backend
```bash
# Increase worker processes in CMD
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Nginx
Already configured with:
- Gzip compression
- Static file caching
- Connection keep-alive
- Buffer optimization

## Support
For issues and questions:
- Check logs: `docker-compose logs -f`
- Review documentation: `/backend/README.md`
- Check API docs: `http://your-domain/api/docs`
