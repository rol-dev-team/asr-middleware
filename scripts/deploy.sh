#!/bin/bash

# ASR Middleware Deployment Script
# This script helps deploy the application with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ASR Middleware Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Check for environment files
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Warning: backend/.env not found${NC}"
    echo -e "${YELLOW}Copying from backend/.env.example${NC}"
    cp backend/.env.example backend/.env
    echo -e "${RED}Please edit backend/.env with your actual values before proceeding!${NC}"
    exit 1
fi

if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}Warning: frontend/.env not found${NC}"
    echo -e "${YELLOW}Copying from frontend/.env.example${NC}"
    cp frontend/.env.example frontend/.env
fi

# Ask for deployment mode
echo -e "${GREEN}Select deployment mode:${NC}"
echo "1) Production (build fresh images)"
echo "2) Development (with hot reload)"
echo "3) Update (rebuild and restart)"
echo "4) Stop all services"
echo "5) View logs"
echo "6) Run database migrations"
echo "7) Backup database"
read -p "Enter choice [1-7]: " choice

case $choice in
    1)
        echo -e "${GREEN}Starting production deployment...${NC}"
        docker-compose down
        docker-compose up -d --build
        echo -e "${GREEN}Deployment complete!${NC}"
        echo -e "${YELLOW}Run migrations with: ./scripts/deploy.sh (option 6)${NC}"
        echo -e "${YELLOW}Access the app at: http://localhost${NC}"
        ;;
    2)
        echo -e "${GREEN}Starting development mode...${NC}"
        echo -e "${YELLOW}Note: Use docker-compose.dev.yml for dev mode${NC}"
        docker-compose -f docker-compose.dev.yml up --build
        ;;
    3)
        echo -e "${GREEN}Updating application...${NC}"
        docker-compose down
        docker-compose up -d --build
        echo -e "${GREEN}Update complete!${NC}"
        ;;
    4)
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker-compose down
        echo -e "${GREEN}All services stopped${NC}"
        ;;
    5)
        echo -e "${GREEN}Showing logs (Ctrl+C to exit)...${NC}"
        docker-compose logs -f
        ;;
    6)
        echo -e "${GREEN}Running database migrations...${NC}"
        docker-compose exec backend alembic upgrade head
        echo -e "${GREEN}Migrations complete!${NC}"
        ;;
    7)
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql.gz"
        echo -e "${GREEN}Creating database backup: $BACKUP_FILE${NC}"
        docker-compose exec -T db pg_dump -U postgres ASRMiddleware | gzip > "$BACKUP_FILE"
        echo -e "${GREEN}Backup saved to: $BACKUP_FILE${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Useful commands:${NC}"
echo -e "${GREEN}========================================${NC}"
echo "View logs:         docker-compose logs -f"
echo "Check status:      docker-compose ps"
echo "Stop services:     docker-compose down"
echo "Restart service:   docker-compose restart [service]"
echo "Shell access:      docker-compose exec backend bash"
echo "Run migrations:    docker-compose exec backend alembic upgrade head"
echo -e "${GREEN}========================================${NC}"
