# Quick HTTPS Setup Guide

This guide will help you quickly enable HTTPS to fix the audio recording issue on your VM.

## Why HTTPS is Required

The browser's `navigator.mediaDevices.getUserMedia()` API (used for audio recording) only works in secure contexts:
- ✅ HTTPS connections
- ✅ localhost
- ❌ HTTP connections to remote servers

## Choose Your Setup Method

### Method 1: SSH Tunnel (Fastest - For Development)

**No configuration needed!** Just create a tunnel:

```bash
# From your local machine
ssh -L 8080:localhost:80 user@your-vm-ip

# Then access: http://localhost:8080
```

---

### Method 2: Self-Signed Certificate (Quick - For Testing)

**Step 1: Generate certificate**
```bash
# SSH into your VM
cd /path/to/asr-middleware

# Run the script (Linux/Mac)
chmod +x scripts/generate-ssl-cert.sh
./scripts/generate-ssl-cert.sh YOUR-VM-IP

# Or Windows PowerShell
.\scripts\generate-ssl-cert.ps1 YOUR-VM-IP
```

**Step 2: Update nginx config**
```bash
# Backup current config
cp backend/nginx/conf.d/default.conf backend/nginx/conf.d/default.conf.backup

# Use the HTTPS template
cp backend/nginx/conf.d/default.conf.https-template backend/nginx/conf.d/default.conf

# Edit and replace YOUR_VM_IP_OR_DOMAIN with your actual IP
nano backend/nginx/conf.d/default.conf
# or
vim backend/nginx/conf.d/default.conf
```

**Step 3: Update docker-compose.yml**

Add port 443 to nginx service:
```yaml
services:
  nginx:
    ports:
      - "80:80"
      - "443:443"  # Add this line
```

**Step 4: Restart**
```bash
docker-compose down
docker-compose up -d
```

**Step 5: Access and accept certificate**
- Go to `https://YOUR-VM-IP`
- Click "Advanced" → "Proceed to YOUR-VM-IP (unsafe)"
- This is expected for self-signed certificates

---

### Method 3: Let's Encrypt (Best - For Production)

**Requirements:**
- A domain name pointing to your VM
- Port 80 and 443 accessible

**Steps:**

```bash
# 1. Install certbot
sudo apt update
sudo apt install certbot

# 2. Stop nginx temporarily
docker-compose stop nginx

# 3. Get certificate
sudo certbot certonly --standalone -d your-domain.com

# 4. Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem \
  backend/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem \
  backend/nginx/ssl/key.pem
sudo chmod 644 backend/nginx/ssl/*.pem

# 5. Update nginx config (same as Method 2)
# But use your domain instead of IP

# 6. Restart
docker-compose up -d
```

---

## Verify HTTPS is Working

1. **Check the URL bar:**
   - Should show 🔒 (padlock icon)
   - Should start with `https://`

2. **Test in browser console (F12):**
   ```javascript
   console.log('Secure:', window.isSecureContext);
   console.log('Media:', navigator.mediaDevices);
   ```
   Both should return truthy values.

3. **Test audio recording:**
   - Go to Meeting Recorder
   - Click "Record Audio"
   - Should prompt for microphone permission
   - No errors!

---

## Troubleshooting

### Still seeing the error?

**Clear browser cache:**
- `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)

**Check nginx logs:**
```bash
docker-compose logs nginx
```

**Test nginx config:**
```bash
docker-compose exec nginx nginx -t
```

### Port 443 not accessible?

**Check firewall:**
```bash
# Ubuntu/Debian
sudo ufw allow 443/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=443/tcp --permanent
sudo firewall-cmd --reload
```

**Check docker-compose:**
Ensure ports section includes 443:
```yaml
ports:
  - "80:80"
  - "443:443"
```

### Certificate issues?

**Verify certificate exists:**
```bash
ls -la backend/nginx/ssl/
# Should see: cert.pem and key.pem
```

**Check certificate details:**
```bash
openssl x509 -in backend/nginx/ssl/cert.pem -text -noout
```

---

## Files Modified/Created

✅ **frontend/src/components/MeetingRecorder.jsx** - Added HTTPS checks and better error messages
✅ **AUDIO_RECORDING_FIX.md** - Detailed documentation
✅ **backend/nginx/conf.d/default.conf.https-template** - Ready-to-use HTTPS config
✅ **scripts/generate-ssl-cert.sh** - Linux/Mac certificate generation script
✅ **scripts/generate-ssl-cert.ps1** - Windows PowerShell certificate generation script

---

## Quick Reference Commands

```bash
# Generate self-signed cert
./scripts/generate-ssl-cert.sh YOUR-IP

# Test nginx config
docker-compose exec nginx nginx -t

# View nginx config
docker-compose exec nginx cat /etc/nginx/conf.d/default.conf

# Restart services
docker-compose restart

# View logs
docker-compose logs -f nginx

# Check if ports are open
netstat -tulpn | grep -E ':(80|443)'
```

---

## Need Help?

See **AUDIO_RECORDING_FIX.md** for comprehensive documentation with more details and troubleshooting steps.
