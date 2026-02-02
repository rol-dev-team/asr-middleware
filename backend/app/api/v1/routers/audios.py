from fastapi import APIRouter

router = APIRouter()

@router.get("/audios/extract-text")
async def extract_text_from_audio():
    return {"message": "This endpoint will extract text from audio."}

