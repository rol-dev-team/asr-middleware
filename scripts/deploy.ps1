# ASR Middleware Deployment Script (PowerShell)
# This script helps deploy the application with Docker on Windows

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Green
Write-Host "ASR Middleware Deployment Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
} catch {
    Write-Host "Error: Docker is not installed" -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
} catch {
    Write-Host "Error: Docker Compose is not installed" -ForegroundColor Red
    exit 1
}

# Check for environment files
if (-not (Test-Path "backend\.env")) {
    Write-Host "Warning: backend\.env not found" -ForegroundColor Yellow
    Write-Host "Copying from backend\.env.example" -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Please edit backend\.env with your actual values before proceeding!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "frontend\.env")) {
    Write-Host "Warning: frontend\.env not found" -ForegroundColor Yellow
    Write-Host "Copying from frontend\.env.example" -ForegroundColor Yellow
    Copy-Item "frontend\.env.example" "frontend\.env"
}

# Ask for deployment mode
Write-Host "Select deployment mode:" -ForegroundColor Green
Write-Host "1) Production (build fresh images)"
Write-Host "2) Development (with hot reload)"
Write-Host "3) Update (rebuild and restart)"
Write-Host "4) Stop all services"
Write-Host "5) View logs"
Write-Host "6) Run database migrations"
Write-Host "7) Backup database"
Write-Host "8) Check service status"
$choice = Read-Host "Enter choice [1-8]"

switch ($choice) {
    "1" {
        Write-Host "Starting production deployment..." -ForegroundColor Green
        docker-compose down
        docker-compose up -d --build
        Write-Host "Deployment complete!" -ForegroundColor Green
        Write-Host "Run migrations with: .\scripts\deploy.ps1 (option 6)" -ForegroundColor Yellow
        Write-Host "Access the app at: http://localhost" -ForegroundColor Yellow
    }
    "2" {
        Write-Host "Starting development mode..." -ForegroundColor Green
        Write-Host "Note: This will run in attached mode (Ctrl+C to stop)" -ForegroundColor Yellow
        docker-compose -f docker-compose.yml up --build
    }
    "3" {
        Write-Host "Updating application..." -ForegroundColor Green
        docker-compose down
        docker-compose up -d --build
        Write-Host "Update complete!" -ForegroundColor Green
    }
    "4" {
        Write-Host "Stopping all services..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "All services stopped" -ForegroundColor Green
    }
    "5" {
        Write-Host "Showing logs (Ctrl+C to exit)..." -ForegroundColor Green
        docker-compose logs -f
    }
    "6" {
        Write-Host "Running database migrations..." -ForegroundColor Green
        docker-compose exec backend alembic upgrade head
        Write-Host "Migrations complete!" -ForegroundColor Green
    }
    "7" {
        $backupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
        Write-Host "Creating database backup: $backupFile" -ForegroundColor Green
        docker-compose exec -T db pg_dump -U postgres ASRMiddleware | Out-File -FilePath $backupFile -Encoding utf8
        Write-Host "Backup saved to: $backupFile" -ForegroundColor Green
        
        # Compress the backup
        Write-Host "Compressing backup..." -ForegroundColor Yellow
        Compress-Archive -Path $backupFile -DestinationPath "$backupFile.zip"
        Remove-Item $backupFile
        Write-Host "Compressed backup saved to: $backupFile.zip" -ForegroundColor Green
    }
    "8" {
        Write-Host "Service Status:" -ForegroundColor Green
        docker-compose ps
        Write-Host ""
        Write-Host "Resource Usage:" -ForegroundColor Green
        docker stats --no-stream
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Useful commands:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "View logs:         docker-compose logs -f"
Write-Host "Check status:      docker-compose ps"
Write-Host "Stop services:     docker-compose down"
Write-Host "Restart service:   docker-compose restart [service]"
Write-Host "Shell access:      docker-compose exec backend bash"
Write-Host "Run migrations:    docker-compose exec backend alembic upgrade head"
Write-Host "========================================" -ForegroundColor Green
