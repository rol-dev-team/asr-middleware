#!/bin/sh
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head
echo "==> Migrations complete."

echo "==> Starting uvicorn..."
exec uvicorn app.api.main:app --host 0.0.0.0 --port 8000