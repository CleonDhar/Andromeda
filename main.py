"""
Andromeda Studio 2026 — API Background Removal Service
Port: 8080

Reminder: Start server via:
python -m uvicorn main:app --port 8080 --reload
"""

import os
import sys
import subprocess
import threading
import time

# ─── Top-Level Zero-Config Autopilot Bootstrap ─────────────────
def __bootstrap__():
    dependencies = {
        "rembg": "rembg",
        "dotenv": "python-dotenv",
        "onnxruntime": "onnxruntime",
        "PIL": "pillow"
    }
    
    missing_packages = []
    for module_name, package_name in dependencies.items():
        try:
            __import__(module_name)
        except ImportError:
            missing_packages.append(package_name)
            
    if missing_packages:
        print(f"🚀 Andromeda: Optimizing your environment... Installing {', '.join(missing_packages)}.")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", *missing_packages])
        except subprocess.CalledProcessError:
            print("\n" + "="*60)
            print("🌌 Andromeda Zen Error: We could not optimize your environment.")
            print("A one-time internet connection is required for the initial setup.")
            print("Please check your connection and try again.")
            print("="*60 + "\n")
            sys.exit(1)

__bootstrap__()

# ─── Lazy Loaded Dependencies ─────────────────────────────────
import io
import requests
from dotenv import load_dotenv, dotenv_values
from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image

# ─── Environment Setup & Validation ───────────────────────────
load_dotenv()
print(f"DEBUG RAW ENV: {os.environ.get('REMOVEBG_API_KEY')}")

def get_valid_api_key():
    # Force a fresh read of the .env file to ensure hot-reload picks up changes
    env_config = dotenv_values(".env")
    key = env_config.get("REMOVEBG_API_KEY") or env_config.get("REMOVE_BG_API_KEY")
    if not key:
        return None
    key = key.strip()
    if key == "<your API key here>" or len(key) < 20:
        return None
    return key

if get_valid_api_key():
    print("API Mode Activated")

import rembg


# ─── Global State & Engine Initialization ─────────────────────
ENGINE_MODE = "local"
rembg_session = None

def init_local_engine():
    global rembg_session
    if rembg_session is None:
        # Check if the model is downloaded
        model_path = os.path.expanduser("~/.u2net/birefnet-general.onnx")
        if not os.path.exists(model_path):
            print("🏠 No API Key: Activating Offline Mode. Downloading AI weights (approx 150MB)....")
        else:
            print("Initializing local rembg session with birefnet-general...")
            
        import onnxruntime as ort
        available_providers = ort.get_available_providers()
        
        providers = ['CPUExecutionProvider']
        if 'CUDAExecutionProvider' in available_providers:
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        elif 'CoreMLExecutionProvider' in available_providers:
            providers = ['CoreMLExecutionProvider', 'CPUExecutionProvider']
            
        rembg_session = rembg.new_session("birefnet-general", providers=providers)

# ─── Connectivity Daemon ──────────────────────────────────────
def connectivity_checker():
    global ENGINE_MODE
    while True:
        api_key = get_valid_api_key()
        if api_key:
            try:
                # Lightweight check
                resp = requests.get("https://api.remove.bg/v1.0/account", headers={'X-Api-Key': api_key}, timeout=5)
                if resp.status_code == 200:
                    ENGINE_MODE = "cloud"
                else:
                    ENGINE_MODE = "local"
            except Exception:
                ENGINE_MODE = "local"
        else:
            ENGINE_MODE = "local"
            
        time.sleep(10)

threading.Thread(target=connectivity_checker, daemon=True).start()
threading.Thread(target=init_local_engine, daemon=True).start()

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
    Background removal using Dual-Engine Architecture.
    Handles image data entirely in memory and falls back seamlessly.
    """
    global ENGINE_MODE, rembg_session
    api_key = get_valid_api_key()
    
    try:
        data = await file.read()
        
        # Cloud Engine Attempt
        if ENGINE_MODE == "cloud" and api_key:
            try:
                response = requests.post(
                    'https://api.remove.bg/v1.0/removebg',
                    files={'image_file': (file.filename, io.BytesIO(data), file.content_type)},
                    data={'size': 'auto'},
                    headers={'X-Api-Key': api_key},
                    timeout=15
                )
                if response.status_code == requests.codes.ok:
                    return Response(
                        content=response.content,
                        media_type="image/png",
                        headers={"Content-Disposition": "attachment; filename=andromeda_result.png"}
                    )
            except Exception:
                pass # Silently fallback to local

        # Local Engine Fallback
        if rembg_session is None:
            init_local_engine()
        
        input_img = Image.open(io.BytesIO(data))
        output_img = rembg.remove(input_img, session=rembg_session)
        
        img_byte_arr = io.BytesIO()
        output_img.save(img_byte_arr, format='PNG')
        output_bytes = img_byte_arr.getvalue()
        
        return Response(
            content=output_bytes,
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=andromeda_result.png"}
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Processing failed", "detail": str(e)}
        )

@app.get("/status")
async def engine_status():
    """Return the current engine mode for UI feedback."""
    return {"mode": ENGINE_MODE}

@app.get("/health")
async def health_check():
    """Quick check that backend is alive."""
    return {"status": "ok", "service": "Andromeda Dual-Engine API"}


# ─── Static Files (serve frontend) ───────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def serve_frontend():
    return FileResponse("static/index.html")


# ─── Entry Point ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)