# Deployment Fix for "Failed to fetch" Registration Error

## Problem
Registration worked locally but failed on VM with "Failed to fetch" error.

## Root Causes Found
1. **Frontend API URL misconfiguration**: The Vite environment variable wasn't set during Docker build, causing it to use the wrong fallback URL
2. **Nginx routing mismatch**: Nginx was stripping `/api` prefix but backend expected `/api/v1` routes
3. **Missing health endpoint**: Nginx health checks were failing

## Fixes Applied

### 1. Frontend Dockerfile
- Added `ARG` and `ENV` for `VITE_API_BASE_URL=/api` before build step
- This ensures the correct API base URL is embedded in the production build

### 2. Nginx Configuration
- Changed rewrite rule from `^/api/(.*) /$1` to `^/api/(.*) /api/v1/$1`
- Added `/health` endpoint for nginx health checks
- Now frontend calls `/api/*` and nginx forwards to backend as `/api/v1/*`

### 3. Frontend API Service
- Updated default fallback to `/api` instead of `http://127.0.0.1:8000/api/v1`
- Ensures relative URLs work properly when accessed via browser

### 4. Docker Compose Health Checks
- Fixed backend health check to use `/health` endpoint instead of `/docs`
- Fixed frontend health check to check root `/` instead of non-existent `/health`
- Added proper nginx health endpoint

## Deployment Steps on VM

### 1. Pull Latest Changes
```bash
cd /path/to/asr-middleware
git pull origin main
```

### 2. Rebuild and Restart Services
```bash
# Stop existing containers
docker-compose down

# Rebuild images with new configuration
docker-compose build --no-cache

# Start all services
docker-compose up -d

# Watch logs to verify startup
docker-compose logs -f
```

### 3. Verify Services
```bash
# Check all containers are running
docker-compose ps

# Test backend health
curl http://localhost/api/health

# Test nginx health
curl http://localhost/health

# Check registration endpoint
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123",
    "full_name": "Test User"
  }'
```

### 4. Create Admin User
After successful deployment, create the admin user to approve new registrations:

```bash
# Access backend container
docker-compose exec backend bash

# Create admin user (you'll need to create a script or use alembic/SQL)
# For now, you can manually update a user in the database:

# Connect to database
docker-compose exec db psql -U postgres -d ASRMiddleware

# Update a user to be admin and active
UPDATE "user" SET is_active = true, is_superuser = true WHERE username = 'adminuser';
```

## Admin Workflow for User Activation

Since users register with `is_active=False` by default (for security):

1. User registers via frontend → account created but inactive
2. Admin logs in to the system
3. Admin can view user list via API: `GET /api/v1/admin/users` (if endpoint exists)
4. Admin activates user: `PATCH /api/v1/admin/users/{user_id}/status` with `{"is_active": true}`
5. User can now log in and use the system

## Verification Checklist

- [ ] All containers are running: `docker-compose ps`
- [ ] Backend responds: `curl http://localhost/api/health`
- [ ] Nginx responds: `curl http://localhost/health`
- [ ] Frontend loads in browser: `http://YOUR_VM_IP`
- [ ] Registration form submits without "Failed to fetch"
- [ ] Admin user is created and can log in
- [ ] Admin can activate newly registered users

## Troubleshooting

### "Failed to fetch" still occurs
```bash
# Check if nginx is routing correctly
docker-compose logs nginx

# Check if backend is responding
docker-compose exec nginx wget -O- http://backend:8000/health

# Check backend logs
docker-compose logs backend

# Verify frontend build has correct API URL
docker-compose exec frontend cat /usr/share/nginx/html/assets/index-*.js | grep -o "http[s]*://[^\"]*"
```

### Backend won't start
```bash
# Check database connection
docker-compose logs db

# Verify environment variables
docker-compose exec backend env | grep DATABASE_URL

# Check backend logs for errors
docker-compose logs backend --tail 100
```

### Frontend shows blank page
```bash
# Check frontend build
docker-compose logs frontend

# Access frontend container
docker-compose exec frontend ls -la /usr/share/nginx/html/

# Check nginx access logs
docker-compose exec nginx cat /var/log/nginx/access.log
```

## Notes
- The default user activation behavior (`is_active=False`) is intentional for security
- Admins must manually approve users before they can use the system
- This prevents unauthorized API access and potential abuse
