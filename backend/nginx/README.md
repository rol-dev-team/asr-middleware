# Nginx Configuration

This directory contains the Nginx reverse proxy configuration for the ASR Middleware application.

## Structure

```
nginx/
├── nginx.conf           # Main Nginx configuration
├── conf.d/
│   └── default.conf    # Server blocks and routing rules
└── ssl/                # SSL/TLS certificates (not in version control)
    └── .gitkeep
```

## Configuration Overview

### Main Configuration (nginx.conf)
- Worker processes and connections
- Logging configuration
- Gzip compression
- Security headers
- MIME types

### Server Configuration (conf.d/default.conf)
- **API Proxy**: Routes `/api/*` requests to backend service
- **Frontend**: Serves React application for all other routes
- **Static Assets**: Caching for JS/CSS/images
- **Health Check**: `/health` endpoint for monitoring
- **SSL/TLS**: HTTPS configuration (commented by default)

## Routing

| Path | Destination | Description |
|------|-------------|-------------|
| `/` | frontend:8080 | React application |
| `/api/*` | backend:8000 | API endpoints (prefix removed) |
| `/docs` | backend:8000/docs | Swagger UI |
| `/openapi.json` | backend:8000/openapi.json | OpenAPI spec |
| `/media/*` | backend:8000/media/* | Uploaded media files |
| `/health` | nginx | Health check endpoint |

## SSL/HTTPS Setup

### 1. Add Certificates

Place your SSL certificates in the `ssl/` directory:
- `cert.pem` - SSL certificate
- `key.pem` - Private key
- `chain.pem` - Certificate chain (optional)

### 2. Enable HTTPS

Edit `conf.d/default.conf` and uncomment the SSL section:

```nginx
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
```

Uncomment the HTTP to HTTPS redirect block:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. Update Server Name

Replace `localhost` with your actual domain:

```nginx
server_name your-domain.com;
```

### 4. Restart Nginx

```bash
docker-compose restart nginx
```

## Testing Configuration

```bash
# Test configuration syntax
docker-compose exec nginx nginx -t

# Reload without downtime
docker-compose exec nginx nginx -s reload

# View configuration
docker-compose exec nginx cat /etc/nginx/nginx.conf
docker-compose exec nginx cat /etc/nginx/conf.d/default.conf
```

## Security Features

### Enabled by Default
- ✓ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✓ Gzip compression
- ✓ Request size limits (100MB max)
- ✓ Timeouts configured
- ✓ Buffer optimization

### Additional Security (Optional)

#### Rate Limiting
Add to `conf.d/default.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    # ... rest of config
}
```

#### IP Whitelisting
```nginx
location /admin {
    allow 192.168.1.0/24;
    deny all;
    # ... rest of config
}
```

#### Hide Nginx Version
Add to `nginx.conf` in http block:
```nginx
server_tokens off;
```

## Performance Tuning

### Caching
Static assets are cached for 1 year:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Compression
Gzip compression is enabled for text-based files to reduce bandwidth.

### Connection Pooling
Upstream keepalive connections are configured:
```nginx
upstream backend_api {
    server backend:8000;
    keepalive 32;
}
```

## Troubleshooting

### 502 Bad Gateway
- Backend service not running: `docker-compose ps backend`
- Wrong upstream address: Check `conf.d/default.conf`

### 404 Not Found
- Check routing rules in `conf.d/default.conf`
- Verify frontend build: `docker-compose logs frontend`

### SSL Certificate Issues
- Verify certificate paths: `docker-compose exec nginx ls -la /etc/nginx/ssl/`
- Check certificate validity: `openssl x509 -in ssl/cert.pem -text -noout`

### Permission Denied
- Check file ownership: `ls -la`
- Ensure nginx user has read access

## Monitoring

### Access Logs
```bash
docker-compose exec nginx tail -f /var/log/nginx/access.log
```

### Error Logs
```bash
docker-compose exec nginx tail -f /var/log/nginx/error.log
```

### Real-time Status
```bash
# Check if nginx is serving requests
curl -I http://localhost/health

# Check backend connectivity
curl -I http://localhost/api/docs
```

## Custom Configuration

To add custom configuration:

1. Create a new file in `conf.d/`:
   ```bash
   touch conf.d/custom.conf
   ```

2. Add your configuration

3. Test and reload:
   ```bash
   docker-compose exec nginx nginx -t
   docker-compose restart nginx
   ```

## References

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Nginx Reverse Proxy Guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [SSL/TLS Best Practices](https://wiki.mozilla.org/Security/Server_Side_TLS)
