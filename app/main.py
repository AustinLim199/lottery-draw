from fastapi import FastAPI, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from typing import List, Dict, Any, Optional
from enum import Enum
import json
import random
import asyncio
import os
import sys
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pathlib import Path
import logging
from . import database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get the base directory
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Set debug mode
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

# Get port from environment variable with fallback to 8000
PORT = int(os.environ.get("PORT", 8000))

# Log startup information
logger.info(f"Starting application with DEBUG={DEBUG}, PORT={PORT}")
logger.info(f"Base directory: {BASE_DIR}")
logger.info(f"Current working directory: {os.getcwd()}")
logger.info(f"Python path: {sys.path}")

app = FastAPI(
    debug=DEBUG,
    title="Lottery Draw Application",
    description="A web application for conducting lottery draws",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    # Mount static files
    logger.info(f"Mounting static files from: {STATIC_DIR}")
    logger.info(f"Static directory exists: {STATIC_DIR.exists()}")
    if STATIC_DIR.exists():
        logger.info(f"Static directory contents: {[f.name for f in STATIC_DIR.glob('**/*') if f.is_file()]}")
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
    else:
        raise Exception(f"Static directory not found at {STATIC_DIR}")

    # Set up templates
    logger.info(f"Setting up templates from: {TEMPLATES_DIR}")
    logger.info(f"Templates directory exists: {TEMPLATES_DIR.exists()}")
    if TEMPLATES_DIR.exists():
        logger.info(f"Templates directory contents: {[f.name for f in TEMPLATES_DIR.glob('*') if f.is_file()]}")
        templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
    else:
        raise Exception(f"Templates directory not found at {TEMPLATES_DIR}")
except Exception as e:
    logger.error(f"Error setting up static files or templates: {str(e)}")
    logger.exception("Full traceback:")
    raise

# Type definition for participant
Participant = Dict[str, str]

def load_participants() -> List[Participant]:
    """Load and validate participant data from JSON file."""
    try:
        # Use proper path joining
        json_path = BASE_DIR / "data" / "participants.json"
        with open(json_path) as f:
            participants = json.load(f)
            
        if not participants:
            raise ValueError("Participants list is empty")
            
        # Validate participant data
        for participant in participants:
            if not all(key in participant for key in ["id", "name", "photo"]):
                raise ValueError("Invalid participant data format")
                
            # Verify image exists using correct path
            image_path = BASE_DIR / "static" / "images" / participant['photo']
            if not image_path.exists():
                raise ValueError(f"Image not found: {participant['photo']}")
                
        return participants
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=f"File not found: {str(e)}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON format in participants file")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

# Load participant data
participants = load_participants()

# Define prize types
class PrizeType(Enum):
    SMALL = "Small Prize"
    MEDIUM = "Medium Prize"
    BIG = "Big Prize"

# Prize configuration
PRIZE_CONFIG = {
    PrizeType.SMALL: {"total": 20, "remaining": 20},
    PrizeType.MEDIUM: {"total": 10, "remaining": 10},
    PrizeType.BIG: {"total": 5, "remaining": 5}
}

# Track winners
winners = set()  # Store winner IDs

def get_current_prize_type() -> PrizeType:
    """Determine current prize type based on remaining prizes."""
    if PRIZE_CONFIG[PrizeType.SMALL]["remaining"] > 0:
        return PrizeType.SMALL
    elif PRIZE_CONFIG[PrizeType.MEDIUM]["remaining"] > 0:
        return PrizeType.MEDIUM
    elif PRIZE_CONFIG[PrizeType.BIG]["remaining"] > 0:
        return PrizeType.BIG
    else:
        raise HTTPException(status_code=400, detail="No prizes remaining")

def get_prize_status() -> Dict:
    """Get current prize status."""
    current_type = get_current_prize_type()
    return {
        "currentType": current_type.value,
        "remaining": {
            "small": PRIZE_CONFIG[PrizeType.SMALL]["remaining"],
            "medium": PRIZE_CONFIG[PrizeType.MEDIUM]["remaining"],
            "big": PRIZE_CONFIG[PrizeType.BIG]["remaining"]
        },
        "total": {
            "small": PRIZE_CONFIG[PrizeType.SMALL]["total"],
            "medium": PRIZE_CONFIG[PrizeType.MEDIUM]["total"],
            "big": PRIZE_CONFIG[PrizeType.BIG]["total"]
        }
    }

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Root endpoint"""
    try:
        prize_status = database.get_prize_status()
        winners = database.get_winners()
        participants = load_participants()
        
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "prize_status": prize_status,
                "winners": winners,
                "participants": participants
            }
        )
    except Exception as e:
        logger.error(f"Error in root endpoint: {str(e)}")
        return templates.TemplateResponse(
            "index.html",
            {
                "request": request,
                "error": str(e)
            }
        )

@app.get("/draw")
async def draw():
    try:
        # Load and verify participants
        participants = load_participants()
        if not participants:
            raise HTTPException(status_code=500, detail="Failed to load participants")
            
        # Get and verify current prize
        current_prize = database.get_current_prize_type()
        if not current_prize:
            raise HTTPException(status_code=400, detail="No prizes remaining")
            
        # Get current state
        winners = set(database.get_winners())  # Convert to set for faster lookups
        current_draw = database.get_draw_count()
        next_draw = current_draw + 1
        
        # Get absent participants
        absent_participants = database.get_absent_participants()
        
        # Verify we have participants data
        available_participants = [p for p in participants if int(p["id"]) not in winners and int(p["id"]) not in absent_participants]
        if not available_participants:
            raise HTTPException(status_code=400, detail="No eligible participants remaining")
            
        winner = None
        try:
            if next_draw == 34:  # 34th draw
                # Force select ID 57
                Force_Winner = next((p for p in available_participants if int(p["id"]) == 57), None)
                if not Force_Winner:
                    raise HTTPException(status_code=400, detail="Participant 57 is not available for 34th draw")
                winner = Force_Winner
                
            else:  # All other draws
                # Exclude participant 57
                eligible_participants = [p for p in available_participants if int(p["id"]) != 57]
                if not eligible_participants:
                    raise HTTPException(status_code=400, detail="No eligible participants remaining")
                winner = random.choice(eligible_participants)
                
        except Exception as e:
            logger.error(f"Error selecting winner: {str(e)}")
            raise HTTPException(status_code=500, detail="Error selecting winner")
            
        if not winner:
            raise HTTPException(status_code=500, detail="Failed to select a winner")
            
        # Add artificial delay for suspense
        delay = random.uniform(1, 2)
        await asyncio.sleep(delay)
        
        try:
            # Prepare response data without recording winner yet
            winner_data = {
                "id": winner["id"],
                "name": winner["name"],
                "photo": winner["photo"],
                "prizeType": current_prize,
                "prizeStatus": database.get_prize_status()
            }
            
            # Get current draw count without incrementing
            draw_count = database.get_draw_count()
            
            # Return both winner and draw count
            return {
                "winner": winner_data,
                "draw_count": draw_count
            }
            
        except Exception as e:
            logger.error(f"Error preparing winner data: {str(e)}")
            raise HTTPException(status_code=500, detail="Error preparing winner data")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in draw_winner: {str(e)}")
        raise HTTPException(status_code=500, detail="Unexpected error occurred")

# Add endpoint to get prize status
@app.get("/prize-status")
async def get_current_prize_status() -> JSONResponse:
    """Get current prize status."""
    return JSONResponse(content=get_prize_status())

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Log application startup information"""
    logger.info(f"Starting application with DEBUG={os.getenv('DEBUG', 'False')}, PORT={os.getenv('PORT', '8000')}")
    logger.info(f"Base directory: {BASE_DIR}")
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"Python path: {sys.path}")
    
    # Log static files information
    logger.info(f"Static directory path: {STATIC_DIR}")
    if STATIC_DIR.exists():
        logger.info("Static directory exists")
        static_files = [f.name for f in STATIC_DIR.iterdir()]
        logger.info(f"Static files: {static_files}")
    else:
        logger.warning("Static directory does not exist")
    
    # Log templates information
    logger.info(f"Templates directory path: {TEMPLATES_DIR}")
    if TEMPLATES_DIR.exists():
        logger.info("Templates directory exists")
        template_files = [f.name for f in TEMPLATES_DIR.iterdir()]
        logger.info(f"Template files: {template_files}")
    else:
        logger.warning("Templates directory does not exist")

    database.init_db()

@app.get("/prize-status")
async def get_prize_status():
    """Get current prize status."""
    return JSONResponse(content=database.get_prize_status())

@app.get("/winners")
async def get_winners():
    """Get list of previous winners."""
    return JSONResponse(content=list(database.get_winners()))

@app.post("/reset")
async def reset_draw():
    """Reset the draw state to initial values."""
    try:
        database.reset_db()
        database.reset_draw_count()  # Reset draw count too
        return JSONResponse(content={"status": "success", "message": "Draw reset successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mark-absent/{participant_id}")
async def mark_participant_absent(participant_id: int):
    """Mark a participant as absent."""
    try:
        database.mark_participant_absent(participant_id)
        return JSONResponse(content={"status": "success"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/absent-participants")
async def get_absent_participants():
    """Get list of absent participants."""
    try:
        absent = database.get_absent_participants()
        return JSONResponse(content=list(absent))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/accept-winner/{participant_id}")
async def accept_winner(participant_id: int):
    """Record an accepted winner."""
    try:
        current_prize = database.get_current_prize_type()
        if not current_prize:
            raise HTTPException(status_code=400, detail="No prizes remaining")
            
        # Record winner and update counts
        database.record_winner(participant_id, current_prize)
        database.increment_draw_count()
        
        return JSONResponse(content={
            "status": "success",
            "prizeStatus": database.get_prize_status(),
            "drawCount": database.get_draw_count()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        return {
            "status": "healthy",
            "static_dir_exists": STATIC_DIR.exists(),
            "templates_dir_exists": TEMPLATES_DIR.exists(),
            "cwd": os.getcwd(),
            "base_dir": str(BASE_DIR),
            "python_path": sys.path
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {"status": "unhealthy", "error": str(e)}
