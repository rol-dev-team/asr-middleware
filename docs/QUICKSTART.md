# ASR Middleware - Quick Deployment Reference

## ⚡ Quick Start

```bash
# 1. Setup environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Edit backend/.env with your values
# Required: DATABASE_URL, GEMINI_API_KEY, SECRET_KEY

# 3. Deploy
docker-compose up -d --build

# 4. Run migrations
docker-compose exec backend alembic upgrade head

# 5. Access
# Frontend: http://localhost
# API Docs: http://localhost/api/docs
```

## 🐳 Docker Commands

### Deployment
```bash
# Start all services
docker-compose up -d

# Start with rebuild
docker-compose up -d --build

# Stop all services
docker-compose down

# Stop and remove volumes (deletes data!)
docker-compose down -v
```

### Monitoring
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
docker-compose logs -f db

# Check service status
docker-compose ps

# Check resource usage
docker stats
```

### Management
```bash
# Restart a service
docker-compose restart backend

# Execute command in container
docker-compose exec backend bash
docker-compose exec backend python

# Run migrations
docker-compose exec backend alembic upgrade head

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"
```

### Database
```bash
# Backup database
docker-compose exec -T db pg_dump -U postgres ASRMiddleware > backup.sql

# Restore database
docker-compose exec -T db psql -U postgres ASRMiddleware < backup.sql

# Access database shell
docker-compose exec db psql -U postgres -d ASRMiddleware

# Reset database (careful!)
docker-compose down -v
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### Troubleshooting
```bash
# View container details
docker inspect asr-middleware-backend

# Check container health
docker-compose ps

# View nginx config test
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload

# Clean up dangling images
docker system prune

# Clean up everything (careful!)
docker system prune -a -volumes
```

## 📁 Environment Files

### backend/.env
```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@db:5432/ASRMiddleware
GEMINI_API_KEY=your_api_key_here
SECRET_KEY=generate_with_openssl_rand_hex_32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### frontend/.env
```env
VITE_API_BASE_URL=/api
```

### Root .env (for docker-compose)
```env
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=ASRMiddleware
HTTP_PORT=80
HTTPS_PORT=443
```

## 🔒 SSL/HTTPS Setup

### Let's Encrypt
```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy to nginx
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem backend/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem backend/nginx/ssl/key.pem

# Restart nginx
docker-compose restart nginx
```

### Self-Signed (Dev Only)
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/nginx/ssl/key.pem \
  -out backend/nginx/ssl/cert.pem

docker-compose restart nginx
```

## 🚀 Cloud Deployment

### Ports to Open
- **80** (HTTP)
- **443** (HTTPS)
- **22** (SSH for management)

### AWS EC2
```bash
# Security Group
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0
- SSH (22): Your IP

# Assign Elastic IP
# Configure Route 53 for DNS
```

### Google Cloud
```bash
gcloud compute firewall-rules create allow-http --allow tcp:80
gcloud compute firewall-rules create allow-https --allow tcp:443
```

### DigitalOcean
```bash
# Firewall rules created automatically
# Configure DNS in Networking panel
```

### Azure
```bash
# Network Security Group
- HTTP (80): Any
- HTTPS (443): Any
- SSH (22): Your IP
```

## 🔍 Health Checks

```bash
# Nginx health
curl http://localhost/health

# API health
curl http://localhost/api/docs

# Frontend health
curl http://localhost/

# All services status
docker-compose ps
```

## 🧵 Background Jobs (Celery)

The `/audios/process-async` endpoint enqueues a Celery task into Redis. That task will **not run** unless a Celery worker is running.

### If you run everything in Docker

- Start the worker (and everything else):

```bash
docker-compose up -d --build
```

- Watch worker logs:

```bash
docker-compose logs -f worker
```

### If you run the API on your host (Windows/macOS/Linux)

- Ensure Redis is reachable from the host (either run Redis locally or publish the container port).
- Set `REDIS_URL=redis://localhost:6379/0` in your environment.
- Start a worker process in another terminal:

```bash
cd backend
# Windows (Celery multiprocessing is not supported; use solo pool)
.\.venv\Scripts\python -m celery -A app.worker.celery_app.celery_app worker -l info -Q celery --pool=solo

# macOS/Linux
celery -A app.worker.celery_app.celery_app worker -l info -Q celery
```

### Quick diagnosis (queued vs consumed)

- If jobs stay stuck in `queued`, check the Redis queue length (default queue name is `celery`):

```bash
docker exec asr-middleware-redis redis-cli LLEN celery
```

- `LLEN > 0` means tasks are being published but no worker is consuming.

### About the Redis "Possible SECURITY ATTACK" log

If Redis logs a message about `POST` or `Host:` commands, it usually means something sent an HTTP request to the Redis port (often a port scan or a misdirected healthcheck). Redis should not be exposed publicly; keep it internal to Docker, or if you must publish it for local dev, bind it to `127.0.0.1` only.

## 📊 Performance Tuning

### Backend Workers
Edit `backend/Dockerfile`:
```dockerfile
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Database Tuning
Edit `docker-compose.yml` under db.environment:
```yaml
- POSTGRES_SHARED_BUFFERS=256MB
- POSTGRES_EFFECTIVE_CACHE_SIZE=1GB
- POSTGRES_MAX_CONNECTIONS=100
```

### Nginx (already optimized)
- Gzip compression ✓
- Static file caching ✓
- Connection keepalive ✓

## 🛡️ Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong SECRET_KEY
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall (ports 80, 443 only)
- [ ] Never commit .env files
- [ ] Use environment variables for secrets
- [ ] Regular security updates
- [ ] Set up automated backups
- [ ] Enable monitoring/logging
- [ ] Implement rate limiting

## 📞 Support

Full documentation: [DEPLOYMENT.md](DEPLOYMENT.md)

Common issues:
- **Container won't start**: Check logs with `docker-compose logs [service]`
- **Database connection failed**: Verify DATABASE_URL in backend/.env
- **Permission denied**: Check file permissions with `ls -la`
- **Port already in use**: Change ports in docker-compose.yml
- **Out of memory**: Increase VM resources or add swap space

## 📝 Scripts

```bash
# Linux/Mac
./scripts/deploy.sh

# Windows PowerShell
.\scripts\deploy.ps1
```

---

**Need more help?** See [DEPLOYMENT.md](DEPLOYMENT.md) for complete documentation.
