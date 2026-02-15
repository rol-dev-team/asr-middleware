# Script to generate self-signed SSL certificates for ASR Middleware
# Usage: .\generate-ssl-cert.ps1 [domain-or-ip]

param(
    [Parameter(Position=0)]
    [string]$Domain
)

# Get domain/IP from argument or prompt
if ([string]::IsNullOrWhiteSpace($Domain)) {
    $Domain = Read-Host "Enter your VM IP address or domain name"
}

# Get script directory and paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SslDir = Join-Path $ProjectRoot "backend\nginx\ssl"

Write-Host "`n=== Generating Self-Signed SSL Certificate ===" -ForegroundColor Yellow
Write-Host "Domain/IP: $Domain"
Write-Host "Output Directory: $SslDir"
Write-Host ""

# Create SSL directory if it doesn't exist
if (!(Test-Path $SslDir)) {
    New-Item -ItemType Directory -Force -Path $SslDir | Out-Null
}

# Check if OpenSSL is available
$opensslPath = (Get-Command openssl -ErrorAction SilentlyContinue).Source

if ([string]::IsNullOrWhiteSpace($opensslPath)) {
    Write-Host "ERROR: OpenSSL not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSSL:"
    Write-Host "  1. Download from: https://slproweb.com/products/Win32OpenSSL.html"
    Write-Host "  2. Or install via Chocolatey: choco install openssl"
    Write-Host "  3. Or use WSL/Git Bash to run the .sh version of this script"
    exit 1
}

# Generate self-signed certificate
Write-Host "Generating certificate..." -ForegroundColor Green

$certPath = Join-Path $SslDir "cert.pem"
$keyPath = Join-Path $SslDir "key.pem"

$opensslArgs = @(
    "req", "-x509", "-nodes", "-days", "365", "-newkey", "rsa:2048",
    "-keyout", $keyPath,
    "-out", $certPath,
    "-subj", "/C=US/ST=State/L=City/O=ASR-Middleware/CN=$Domain"
)

& openssl $opensslArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Certificate generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Certificate files created:"
    Write-Host "  - Certificate: $certPath"
    Write-Host "  - Private Key: $keyPath"
    Write-Host "  - Valid for: 365 days"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Update backend\nginx\conf.d\default.conf with HTTPS configuration"
    Write-Host "   (You can use default.conf.https-template as a reference)"
    Write-Host ""
    Write-Host "2. Replace 'YOUR_VM_IP_OR_DOMAIN' with: $Domain"
    Write-Host ""
    Write-Host "3. Ensure docker-compose.yml exposes port 443:"
    Write-Host "   ports:"
    Write-Host "     - `"80:80`""
    Write-Host "     - `"443:443`""
    Write-Host ""
    Write-Host "4. Restart services:"
    Write-Host "   docker-compose down"
    Write-Host "   docker-compose up -d"
    Write-Host ""
    Write-Host "5. Access your application at: https://$Domain"
    Write-Host ""
    Write-Host "Note: Browsers will show a security warning for self-signed certificates." -ForegroundColor Yellow
    Write-Host "Click 'Advanced' → 'Proceed' to accept the certificate."
} else {
    Write-Host "`nERROR: Failed to generate certificate" -ForegroundColor Red
    exit 1
}
