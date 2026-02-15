# Pre-Deployment Checklist

Complete this checklist before deploying to production.

## 📋 Environment Configuration

### Backend Environment
- [ ] Copy `backend/.env.example` to `backend/.env`
- [ ] Update `DATABASE_URL` with secure password
- [ ] Add valid `GEMINI_API_KEY`
- [ ] Generate secure `SECRET_KEY` (use: `openssl rand -hex 32`)
- [ ] Set appropriate token expiration times
- [ ] Verify all required environment variables are set

### Frontend Environment
- [ ] Copy `frontend/.env.example` to `frontend/.env`
- [ ] Verify `VITE_API_BASE_URL` is set to `/api` (for nginx proxy)
- [ ] Update any additional frontend configuration

### Docker Environment
- [ ] Create root `.env` for docker-compose
- [ ] Set secure `DB_PASSWORD`
- [ ] Configure `DB_USER` and `DB_NAME`
- [ ] Set `HTTP_PORT` and `HTTPS_PORT` (default: 80, 443)

## 🔒 Security

### Credentials
- [ ] All default passwords changed
- [ ] Strong database password (16+ characters, mixed case, numbers, symbols)
- [ ] SECRET_KEY is cryptographically secure (32+ bytes)
- [ ] No sensitive data in environment examples
- [ ] `.env` files added to `.gitignore`

### SSL/TLS
- [ ] SSL certificates obtained (Let's Encrypt or purchased)
- [ ] Certificates copied to `backend/nginx/ssl/`
- [ ] HTTPS enabled in `nginx/conf.d/default.conf`
- [ ] HTTP to HTTPS redirect configured
- [ ] SSL protocols set to TLSv1.2 and TLSv1.3 minimum

### Access Control
- [ ] Firewall configured (ports 80, 443, 22 only)
- [ ] SSH key-based authentication enabled
- [ ] Database not exposed to public internet
- [ ] Admin endpoints protected (if any)

## 🐳 Docker Configuration

### Images
- [ ] Dockerfiles use official base images
- [ ] Multi-stage builds implemented
- [ ] Containers run as non-root users
- [ ] `.dockerignore` files configured
- [ ] Health checks configured for all services

### Compose
- [ ] Service dependencies correctly specified
- [ ] Restart policies set (`unless-stopped`)
- [ ] Resource limits defined (if needed)
- [ ] Networks properly configured
- [ ] Volumes for persistent data defined

## ☁️ Infrastructure

### Server
- [ ] Server meets minimum requirements (2GB RAM, 10GB disk)
- [ ] Docker Engine installed (20.10+)
- [ ] Docker Compose V2 installed
- [ ] System updates applied
- [ ] Timezone configured correctly

### Domain & DNS
- [ ] Domain name registered
- [ ] DNS A record points to server IP
- [ ] DNS propagation verified
- [ ] Subdomain configured (if needed)

### Networking
- [ ] Static IP assigned (cloud provider)
- [ ] Ports 80, 443 accessible from internet
- [ ] Port 22 accessible from admin IPs only
- [ ] Internal network configured for containers

## 📦 Application

### Backend
- [ ] Database migrations prepared
- [ ] Media directory created with correct permissions
- [ ] API endpoints tested
- [ ] Error handling implemented
- [ ] Logging configured

### Frontend
- [ ] Production build tested locally
- [ ] Environment variables correctly referenced
- [ ] API endpoints configured
- [ ] Error boundaries implemented
- [ ] Loading states handled

### Database
- [ ] PostgreSQL 16 image selected
- [ ] Database name configured
- [ ] Shared buffers and cache size optimized
- [ ] Backup strategy defined
- [ ] Connection pooling configured

## 🔍 Testing

### Pre-Deployment
- [ ] All services build successfully
- [ ] Containers start without errors
- [ ] Health checks pass for all services
- [ ] Database connections work
- [ ] API endpoints respond correctly
- [ ] Frontend loads and renders
- [ ] SSL certificate valid (if configured)

### Integration
- [ ] Frontend can communicate with backend
- [ ] File uploads work
- [ ] Database operations complete successfully
- [ ] Authentication flow works
- [ ] API documentation accessible

## 📊 Monitoring & Logging

### Logging
- [ ] Log aggregation configured (optional)
- [ ] Log rotation set up
- [ ] Error tracking enabled (optional)
- [ ] Access logs enabled

### Monitoring
- [ ] Health check endpoints functional
- [ ] Resource monitoring configured (optional)
- [ ] Uptime monitoring set up (optional)
- [ ] Alert system configured (optional)

## 💾 Backup & Recovery

### Backups
- [ ] Database backup script tested
- [ ] Backup schedule defined
- [ ] Backup storage location configured
- [ ] Media files backup strategy defined
- [ ] Backup restoration tested

### Disaster Recovery
- [ ] Recovery procedures documented
- [ ] Backup restoration tested
- [ ] Rollback plan prepared
- [ ] Emergency contacts listed

## 📝 Documentation

### Internal
- [ ] Deployment process documented
- [ ] Architecture diagram created
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Common issues and solutions listed

### Team
- [ ] Access credentials shared securely
- [ ] On-call procedures defined
- [ ] Escalation paths documented
- [ ] Knowledge base updated

## 🚀 Deployment Process

### Pre-Deployment
- [ ] Code reviewed and tested
- [ ] All tests passing
- [ ] Dependencies updated
- [ ] Breaking changes documented
- [ ] Rollback plan prepared

### Deployment
- [ ] Scheduled during low-traffic period
- [ ] Stakeholders notified
- [ ] Backup created before deployment
- [ ] Changes deployed via script
- [ ] Services restarted successfully

### Post-Deployment
- [ ] All services running and healthy
- [ ] Health checks passing
- [ ] API endpoints responding
- [ ] Frontend accessible
- [ ] Database migrations applied
- [ ] Logs reviewed for errors
- [ ] Performance metrics normal

## 🎯 Final Checks

### Functional
- [ ] User registration works
- [ ] User login works
- [ ] File upload/download works
- [ ] All critical features functional
- [ ] Error pages display correctly

### Performance
- [ ] Page load time acceptable (< 3 seconds)
- [ ] API response time acceptable (< 500ms)
- [ ] Database queries optimized
- [ ] Static assets cached

### Security
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (if applicable)
- [ ] Input validation working

## ✅ Sign-Off

- [ ] Development team approval
- [ ] Security review completed
- [ ] Performance testing passed
- [ ] Documentation complete
- [ ] Production ready

---

## Quick Deploy Commands

```bash
# 1. Setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with actual values

# 2. Deploy
docker-compose up -d --build

# 3. Migrations
docker-compose exec backend alembic upgrade head

# 4. Verify
docker-compose ps
curl http://localhost/health
curl http://localhost/api/docs

# 5. Monitor
docker-compose logs -f
```

---

**Date Completed**: ________________

**Deployed By**: ________________

**Verified By**: ________________

**Production URL**: ________________
