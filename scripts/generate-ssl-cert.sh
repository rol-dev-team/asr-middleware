#!/bin/bash

# Script to generate self-signed SSL certificates for ASR Middleware
# Usage: ./generate-ssl-cert.sh [domain-or-ip]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get domain/IP from argument or prompt
if [ -z "$1" ]; then
    read -p "Enter your VM IP address or domain name: " DOMAIN
else
    DOMAIN=$1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_ROOT/backend/nginx/ssl"

echo -e "${YELLOW}=== Generating Self-Signed SSL Certificate ===${NC}"
echo "Domain/IP: $DOMAIN"
echo "Output Directory: $SSL_DIR"
echo ""

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate self-signed certificate
echo -e "${GREEN}Generating certificate...${NC}"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=US/ST=State/L=City/O=ASR-Middleware/CN=$DOMAIN"

# Set appropriate permissions
chmod 644 "$SSL_DIR/cert.pem"
chmod 644 "$SSL_DIR/key.pem"

echo -e "${GREEN}✓ Certificate generated successfully!${NC}"
echo ""
echo "Certificate files created:"
echo "  - Certificate: $SSL_DIR/cert.pem"
echo "  - Private Key: $SSL_DIR/key.pem"
echo "  - Valid for: 365 days"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update backend/nginx/conf.d/default.conf with HTTPS configuration"
echo "   (You can use default.conf.https-template as a reference)"
echo ""
echo "2. Replace 'YOUR_VM_IP_OR_DOMAIN' with: $DOMAIN"
echo ""
echo "3. Ensure docker-compose.yml exposes port 443:"
echo "   ports:"
echo "     - \"80:80\""
echo "     - \"443:443\""
echo ""
echo "4. Restart services:"
echo "   docker-compose down"
echo "   docker-compose up -d"
echo ""
echo "5. Access your application at: https://$DOMAIN"
echo ""
echo -e "${YELLOW}Note:${NC} Browsers will show a security warning for self-signed certificates."
echo "Click 'Advanced' → 'Proceed' to accept the certificate."
