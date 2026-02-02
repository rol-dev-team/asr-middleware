from fastapi import FastAPI

from app.api.v1.routers import audios
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="ASR Middleware",
    description="A middleware service for Automatic Speech Recognition (ASR) tasks.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/greet")
async def greet():
    return {"message": "Hello World!"}


app.include_router(audios.router, prefix="/api/v1", tags=["audios"])