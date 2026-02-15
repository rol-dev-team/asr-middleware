# Audio Recording Fix for VM Deployment

## Problem

The error "Failed to access audio: Cannot read properties of undefined (reading 'getUserMedia')" occurs because the `navigator.mediaDevices` API is only available in **secure contexts** (HTTPS or localhost).

When accessing the application on a VM via HTTP (not HTTPS), browsers block access to the microphone for security reasons.

## Solutions

### Option 1: Quick Development Fix - SSH Tunnel (Recommended for Testing)

If your VM doesn't have HTTPS configured, create an SSH tunnel to access it via localhost:

**Windows (PowerShell):**
```powershell
ssh -L 8080:localhost:80 user@your-vm-ip
```

**Linux/Mac:**
```bash
ssh -L 8080:localhost:80 user@your-vm-ip
```

Then access the application at: `http://localhost:8080`

### Option 2: Self-Signed Certificate (Quick Setup)

**1. Generate self-signed certificate on your VM:**
```bash
# SSH into your VM
ssh user@your-vm-ip

# Navigate to SSL directory
cd /path/to/asr-middleware/backend/nginx/ssl

# Generate self-signed certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-vm-ip"
```

**2. Enable HTTPS in nginx configuration:**

Edit `backend/nginx/conf.d/default.conf`:

```nginx
# Add this at the top - HTTP to HTTPS redirect
server {
    listen 80;
    server_name your-vm-ip;
    return 301 https://$server_name$request_uri;
}

# Modify existing server block
server {
    listen 443 ssl http2;
    server_name your-vm-ip;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of configuration remains the same
}
```

**3. Update docker-compose to expose port 443:**

Edit `docker-compose.yml` or `docker-compose.prod.yml`:

```yaml
services:
  nginx:
    ports:
      - "80:80"
      - "443:443"  # Add this line
```

**4. Restart services:**
```bash
docker-compose down
docker-compose up -d
```

**5. Accept the self-signed certificate:**
- Navigate to `https://your-vm-ip` in your browser
- You'll see a security warning
- Click "Advanced" → "Proceed to your-vm-ip (unsafe)"
- The warning is expected for self-signed certificates

### Option 3: Let's Encrypt (Production - Free SSL Certificate)

**1. Install Certbot:**
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

**2. Get SSL certificate:**
```bash
sudo certbot certonly --standalone -d your-domain.com
```

This creates:
- Certificate: `/etc/letsencrypt/live/your-domain.com/fullchain.pem`
- Private Key: `/etc/letsencrypt/live/your-domain.com/privkey.pem`

**3. Copy certificates to project:**
```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem \
  /path/to/asr-middleware/backend/nginx/ssl/cert.pem

sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem \
  /path/to/asr-middleware/backend/nginx/ssl/key.pem

sudo chmod 644 /path/to/asr-middleware/backend/nginx/ssl/*.pem
```

**4. Update nginx config** (same as Option 2 but use your domain name)

**5. Restart services:**
```bash
docker-compose down
docker-compose up -d
```

**6. Set up auto-renewal:**
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for auto-renewal
sudo crontab -e
# Add this line:
0 3 * * * certbot renew --quiet && docker-compose -f /path/to/asr-middleware/docker-compose.prod.yml restart nginx
```

## Verification

After implementing one of the solutions above:

1. **Check HTTPS is working:**
   - Open `https://your-vm-ip` or `https://your-domain.com`
   - You should see a padlock icon (green for valid certificate, gray with warning for self-signed)

2. **Check secure context:**
   - Open browser console (F12)
   - Type: `window.isSecureContext`
   - Should return `true`

3. **Test audio recording:**
   - Go to the Meeting Recorder page
   - Click "Record Audio"
   - Browser should prompt for microphone permission
   - Grant permission and start recording

## Troubleshooting

### Still getting the error?

**Hard refresh your browser:**
- Chrome/Edge: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Firefox: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)

**Check browser console:**
```javascript
// In browser console (F12), run:
console.log('navigator.mediaDevices:', navigator.mediaDevices);
console.log('isSecureContext:', window.isSecureContext);
```

**Clear browser cache and site data:**
1. Go to browser settings
2. Privacy and Security → Clear browsing data
3. Select "Cached images and files" and "Site settings"
4. Clear data
5. Restart browser

### Permission denied?

- Make sure you clicked "Allow" when prompted for microphone permission
- Check browser settings: Settings → Privacy → Microphone
- Ensure your microphone is not being used by another application

### No microphone found?

- For VM scenarios: You might be trying to record audio on the VM itself
- Use Option 1 (SSH Tunnel) to record audio from your local machine
- Or use a cloud-based transcription service instead of browser recording

## Changes Made to Code

The following improvements were made to `MeetingRecorder.jsx`:

1. ✅ Added check for `navigator.mediaDevices` existence
2. ✅ Added check for `window.isSecureContext`
3. ✅ Improved error messages with specific guidance
4. ✅ Added detailed error handling for different permission states
5. ✅ Added warning about HTTPS requirement in UI

## Additional Notes

- **For Development**: Use Option 1 (SSH Tunnel) - it's the quickest and doesn't require certificate management
- **For Production**: Use Option 3 (Let's Encrypt) - it's free, trusted by all browsers, and auto-renews
- **Self-Signed Certificate**: Good for internal/testing environments, but users will see security warnings

## References

- [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
- [Let's Encrypt Documentation](https://letsencrypt.org/getting-started/)
