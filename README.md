# ASR Middleware

Automated Speech Recognition (ASR) Middleware application with FastAPI backend and React frontend.

## Features

- 🎤 Audio transcription and translation
- 📊 Meeting analysis with AI
- 🔐 User authentication and authorization
- 🐳 Docker containerized deployment
- 🚀 Automated CI/CD pipeline

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd asr-middleware

# Start services
docker-compose up --build

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost/api/docs
```

### Production Deployment

See [CI-CD-SETUP.md](CI-CD-SETUP.md) for automated deployment setup.

```bash
# On VM server
cp .env.example .env
# Edit .env with your values

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│   Backend   │────▶│  PostgreSQL │
│   Proxy     │     │   (FastAPI) │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │
       ▼
┌─────────────┐
│   Frontend  │
│   (React)   │
└─────────────┘
```

## CI/CD Pipeline

Automated deployment pipeline with:
- ✅ Build Docker images on push to `main`
- ✅ Push images to DockerHub
- ✅ Auto-deploy to VM server
- ✅ Database migrations via Alembic
- ✅ Zero-downtime database updates

See [CI-CD-SETUP.md](CI-CD-SETUP.md) for full documentation.

**Quick Reference**: [CI-CD-QUICKREF.md](CI-CD-QUICKREF.md)

## Project Structure

```
asr-middleware/
├── backend/              # FastAPI backend application
│   ├── app/             # Application code
│   │   ├── api/         # API routes and models
│   │   └── alembic/     # Database migrations
│   ├── Dockerfile       # Backend container image
│   └── pyproject.toml   # Python dependencies
├── frontend/            # React frontend application
│   ├── src/             # Source code
│   ├── Dockerfile       # Frontend container image
│   └── package.json     # Node dependencies
├── scripts/             # Deployment and utility scripts
│   ├── deploy.sh        # Local deployment script
│   └── vm-deploy.sh     # VM auto-deployment script
├── .github/
│   └── workflows/       # GitHub Actions CI/CD
│       └── deploy.yml   # Deployment workflow
├── docker-compose.yml      # Development configuration
├── docker-compose.prod.yml # Production configuration
└── .env.example            # Environment template
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Quick setup guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Manual deployment guide
- **[CI-CD-SETUP.md](CI-CD-SETUP.md)** - Automated deployment setup
- **[CI-CD-QUICKREF.md](CI-CD-QUICKREF.md)** - Command reference
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Deployment checklist

## Technology Stack

### Backend
- Python 3.13
- FastAPI
- PostgreSQL 16
- SQLAlchemy + Alembic
- AsyncPG

### Frontend
- React
- Vite
- Nginx (production)

### DevOps
- Docker & Docker Compose
- GitHub Actions
- DockerHub

## Development

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e .
python main.py
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec backend alembic upgrade head

# Rollback
docker-compose exec backend alembic downgrade -1
```

## Environment Variables

### Required (VM Production)
Copy `.env.example` to `.env` and configure:

```env
DOCKERHUB_USERNAME=your_dockerhub_username
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=ASRMiddleware
HTTP_PORT=80
HTTPS_PORT=443
```

### Backend Specific
See `backend/.env.example` for backend configuration including:
- Database connection
- API keys (Gemini)
- JWT secrets
- CORS settings

## Common Operations

### View Logs
```bash
# Development
docker-compose logs -f

# Production
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart Services
```bash
# Development
docker-compose restart backend

# Production
docker-compose -f docker-compose.prod.yml restart backend
```

### Database Backup
```bash
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres ASRMiddleware | gzip > backup.sql.gz
```

### Clean Up
```bash
# Remove stopped containers
docker-compose down

# Remove all (including volumes - CAUTION: deletes data)
docker-compose down -v

# Clean up old images
docker image prune -a -f
```

## API Documentation

Once running, access interactive API documentation:
- **Swagger UI**: http://localhost/api/docs
- **ReDoc**: http://localhost/api/redoc

## License

See [LICENSE](backend/LICENSE) file for details.

## Support

For issues or questions:
1. Check documentation files
2. Review logs: `docker-compose logs`
3. Check GitHub Issues
4. Review [CI-CD-SETUP.md](CI-CD-SETUP.md) for deployment issues
