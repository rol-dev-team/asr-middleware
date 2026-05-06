from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from pathlib import Path

from app.api.v1.routers import audios, translations, auth, utils, emails
from app.api.v1.internal import admin


app = FastAPI(
    title="ASR Middleware",
    description="A middleware service for Automatic Speech Recognition (ASR) tasks.",
    version="1.0.0",
)


# Serve uploaded/generated files (audio + PDFs)
MEDIA_DIR = Path(__file__).resolve().parents[2] / "media"
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "message": "ASR Middleware is running."}


app.include_router(audios.router, prefix="/api/v1")
app.include_router(translations.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(utils.router, prefix="/api/v1")
app.include_router(emails.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")