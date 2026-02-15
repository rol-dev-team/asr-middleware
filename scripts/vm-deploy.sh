#!/bin/bash

# VM Deployment Script for ASR Middleware
# This script is executed on the VM server by GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ASR Middleware VM Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Load environment variables if .env exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading environment variables...${NC}"
    set -a
    source .env
    set +a
else
    echo -e "${YELLOW}Warning: .env file not found, using defaults${NC}"
fi

# Set DockerHub username (should be in .env or set as environment variable)
DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME:-"yourusername"}

echo -e "${GREEN}Pulling latest images from DockerHub...${NC}"
docker pull ${DOCKERHUB_USERNAME}/asr-middleware-backend:latest
docker pull ${DOCKERHUB_USERNAME}/asr-middleware-frontend:latest

echo -e "${GREEN}Stopping and removing old backend and frontend containers...${NC}"
docker-compose -f docker-compose.prod.yml stop backend frontend
docker-compose -f docker-compose.prod.yml rm -f backend frontend

echo -e "${GREEN}Starting updated containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d backend frontend

echo -e "${GREEN}Waiting for backend to be healthy...${NC}"
sleep 5

# Wait for backend to be healthy (max 60 seconds)
COUNTER=0
MAX_TRIES=30
until docker-compose -f docker-compose.prod.yml ps backend | grep -q "healthy" || [ $COUNTER -eq $MAX_TRIES ]; do
    echo -e "${YELLOW}Waiting for backend to be healthy... ($COUNTER/$MAX_TRIES)${NC}"
    sleep 2
    COUNTER=$((COUNTER+1))
done

if [ $COUNTER -eq $MAX_TRIES ]; then
    echo -e "${RED}Error: Backend did not become healthy in time${NC}"
    echo -e "${YELLOW}Checking backend logs:${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=50 backend
    exit 1
fi

echo -e "${GREEN}Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

echo -e "${GREEN}Restarting nginx to ensure proper routing...${NC}"
docker-compose -f docker-compose.prod.yml restart nginx

echo -e "${GREEN}Cleaning up old Docker images...${NC}"
docker image prune -f

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Service Status:${NC}"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${YELLOW}To view logs, run:${NC} docker-compose -f docker-compose.prod.yml logs -f"
echo -e "${YELLOW}To check health:${NC} docker-compose -f docker-compose.prod.yml ps"
