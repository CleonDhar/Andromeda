"""
Andromeda Studio 2026 — API Background Removal Service
Port: 8080

Reminder: Start server via:
python -m uvicorn main:app --port 8080 --reload
"""

import io
import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# Load environment variables
load_dotenv()
REMOVE_BG_API_KEY = os.getenv("REMOVE_BG_API_KEY")

# ─── App Setup ────────────────────────────────────────────────
app = FastAPI(title="Andromeda Studio", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Endpoints ────────────────────────────────────────────────
@app.post("/remove-bg")
async def remove_bg(file: UploadFile = File(...)):
    """
    Background removal using Remove.bg API.
    Handles image data entirely in memory.
    """
    if not REMOVE_BG_API_KEY:
        return JSONResponse(
            status_code=500,
            content={"error": "Configuration Error", "detail": "REMOVE_BG_API_KEY is not set in .env"}
        )

    try:
        # Avoid disk I/O, handle in memory
        data = await file.read()
        
        response = requests.post(
            'https://api.remove.bg/v1.0/removebg',
            files={'image_file': (file.filename, io.BytesIO(data), file.content_type)},
            data={'size': 'auto'},
            headers={'X-Api-Key': REMOVE_BG_API_KEY},
        )
        
        if response.status_code == requests.codes.ok:
            return Response(
                content=response.content,
                media_type="image/png",
                headers={"Content-Disposition": "attachment; filename=andromeda_result.png"}
            )
        else:
            try:
                error_data = response.json()
                error_details = error_data.get('errors', [{'title': 'Unknown API error'}])[0].get('title', 'Unknown API error')
            except Exception:
                error_details = f"HTTP {response.status_code}"
                
            return JSONResponse(
                status_code=response.status_code,
                content={
                    "error": "API Error",
                    "detail": f"Remove.bg said: {error_details}"
                }
            )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed", "detail": str(e)}
        )


@app.get("/health")
async def health_check():
    """Quick check that backend is alive."""
    return {"status": "ok", "service": "Remove.bg API"}


# ─── Static Files (serve frontend) ───────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def serve_frontend():
    return FileResponse("static/index.html")


# ─── Entry Point ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)