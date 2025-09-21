from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
import uvicorn
import os
import hashlib
import asyncio
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
import time
import io
import wave

# TTS and Audio Processing
from TTS.api import TTS
import torch
import torchaudio
import librosa
import soundfile as sf
import numpy as np
from pydub import AudioSegment
from pydub.effects import normalize, compress_dynamic_range
import noisereduce as nr

# Utilities
from dotenv import load_dotenv
import structlog
import aiofiles

# Load environment variables
load_dotenv()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

app = FastAPI(
    title="AutoNews TTS Service",
    description="Text-to-Speech service using Coqui TTS",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Configuration
class Config:
    MODEL_NAME = os.getenv("TTS_MODEL", "tts_models/en/ljspeech/tacotron2-DDC")
    VOCODER_NAME = os.getenv("VOCODER_MODEL", "vocoder_models/en/ljspeech/hifigan_v2")
    OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./audio_output")
    CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
    INTERNAL_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "dev-secret")
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    SAMPLE_RATE = int(os.getenv("SAMPLE_RATE", "22050"))
    MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "1000"))
    AUDIO_FORMAT = os.getenv("AUDIO_FORMAT", "wav")
    ENABLE_PREPROCESSING = os.getenv("ENABLE_PREPROCESSING", "true").lower() == "true"
    ENABLE_POSTPROCESSING = os.getenv("ENABLE_POSTPROCESSING", "true").lower() == "true"

config = Config()

# Ensure directories exist
os.makedirs(config.OUTPUT_DIR, exist_ok=True)
os.makedirs(config.CACHE_DIR, exist_ok=True)

# Pydantic models
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000, description="Text to convert to speech")
    voice_id: Optional[str] = Field("default", description="Voice identifier")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Speech speed multiplier")
    pitch: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Pitch multiplier")
    volume: Optional[float] = Field(1.0, ge=0.1, le=2.0, description="Volume multiplier")
    sample_rate: Optional[int] = Field(22050, ge=8000, le=48000, description="Audio sample rate")
    format: Optional[str] = Field("wav", description="Output audio format")
    language: Optional[str] = Field("en", description="Language code")
    emotion: Optional[str] = Field("neutral", description="Emotion style")
    
    @validator('text')
    def validate_text(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('Text cannot be empty')
        # Remove excessive whitespace
        return ' '.join(v.split())

class TTSResponse(BaseModel):
    audio_url: str
    duration: float
    sample_rate: int
    format: str
    file_size: int
    processing_time: float
    voice_used: str
    metadata: Dict[str, Any]

class BatchTTSRequest(BaseModel):
    texts: List[str] = Field(..., max_items=5, description="List of texts to convert")
    voice_id: Optional[str] = Field("default")
    speed: Optional[float] = Field(1.0, ge=0.5, le=2.0)
    concatenate: Optional[bool] = Field(False, description="Whether to concatenate all audio files")

class VoiceInfo(BaseModel):
    voice_id: str
    name: str
    language: str
    gender: str
    description: str
    sample_rate: int

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    available_voices: List[str]
    uptime: float

# Global TTS model manager
class TTSManager:
    def __init__(self):
        self.tts = None
        self.is_loaded = False
        self.load_time = None
        self.available_voices = {}
        
    async def load_model(self):
        """Load the TTS model"""
        try:
            logger.info("Loading TTS model", model=config.MODEL_NAME, device=config.DEVICE)
            start_time = time.time()
            
            # Initialize TTS
            self.tts = TTS(
                model_name=config.MODEL_NAME,
                progress_bar=False,
                gpu=config.DEVICE == "cuda"
            )
            
            # Load available voices
            self.available_voices = {
                "default": {
                    "name": "Default Voice",
                    "language": "en",
                    "gender": "female",
                    "description": "Default English voice"
                },
                "male": {
                    "name": "Male Voice",
                    "language": "en", 
                    "gender": "male",
                    "description": "Male English voice"
                }
            }
            
            self.load_time = time.time() - start_time
            self.is_loaded = True
            
            logger.info("TTS model loaded successfully", 
                       load_time=self.load_time,
                       device=config.DEVICE,
                       voices=len(self.available_voices))
                       
        except Exception as e:
            logger.error("Failed to load TTS model", error=str(e))
            raise HTTPException(status_code=500, detail=f"Failed to load TTS model: {str(e)}")

tts_manager = TTSManager()

# Authentication
async def verify_internal_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != config.INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return credentials.credentials

# Utility functions
def generate_file_hash(text: str, voice_id: str, speed: float) -> str:
    """Generate hash for audio file caching"""
    content = f"{text}_{voice_id}_{speed}"
    return hashlib.md5(content.encode()).hexdigest()

def preprocess_text(text: str) -> str:
    """Preprocess text for better TTS output"""
    if not config.ENABLE_PREPROCESSING:
        return text
    
    # Normalize whitespace
    text = ' '.join(text.split())
    
    # Add pauses for better speech flow
    text = text.replace('.', '. ')
    text = text.replace(',', ', ')
    text = text.replace(';', '; ')
    text = text.replace(':', ': ')
    text = text.replace('!', '! ')
    text = text.replace('?', '? ')
    
    # Handle numbers and abbreviations
    # This is a simplified version - you could integrate more sophisticated text normalization
    replacements = {
        ' Dr.': ' Doctor',
        ' Mr.': ' Mister',
        ' Mrs.': ' Missus',
        ' Ms.': ' Miss',
        ' vs.': ' versus',
        ' etc.': ' etcetera',
        ' i.e.': ' that is',
        ' e.g.': ' for example'
    }
    
    for abbrev, full in replacements.items():
        text = text.replace(abbrev, full)
    
    return text.strip()

def postprocess_audio(audio_data: np.ndarray, sample_rate: int, 
                     speed: float = 1.0, pitch: float = 1.0, volume: float = 1.0) -> np.ndarray:
    """Post-process audio for better quality"""
    if not config.ENABLE_POSTPROCESSING:
        return audio_data
    
    try:
        # Convert to AudioSegment for processing
        audio_segment = AudioSegment(
            audio_data.tobytes(),
            frame_rate=sample_rate,
            sample_width=audio_data.dtype.itemsize,
            channels=1
        )
        
        # Apply speed change
        if speed != 1.0:
            audio_segment = audio_segment.speedup(playback_speed=speed)
        
        # Apply volume change
        if volume != 1.0:
            audio_segment = audio_segment + (20 * np.log10(volume))
        
        # Normalize audio
        audio_segment = normalize(audio_segment)
        
        # Apply light compression
        audio_segment = compress_dynamic_range(audio_segment)
        
        # Convert back to numpy array
        audio_array = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)
        audio_array = audio_array / np.max(np.abs(audio_array))  # Normalize to [-1, 1]
        
        return audio_array
        
    except Exception as e:
        logger.warning("Audio post-processing failed, using original", error=str(e))
        return audio_data

async def generate_speech(request: TTSRequest) -> TTSResponse:
    """Generate speech from text"""
    start_time = time.time()
    
    try:
        # Preprocess text
        processed_text = preprocess_text(request.text)
        
        # Generate cache key
        cache_key = generate_file_hash(processed_text, request.voice_id, request.speed)
        cache_file = Path(config.CACHE_DIR) / f"{cache_key}.{request.format}"
        
        # Check cache first
        if cache_file.exists():
            logger.info("Using cached audio", cache_key=cache_key)
            audio_info = sf.info(str(cache_file))
            
            return TTSResponse(
                audio_url=f"/audio/{cache_key}.{request.format}",
                duration=audio_info.duration,
                sample_rate=audio_info.samplerate,
                format=request.format,
                file_size=cache_file.stat().st_size,
                processing_time=time.time() - start_time,
                voice_used=request.voice_id,
                metadata={"cached": True, "text_length": len(processed_text)}
            )
        
        # Generate speech
        output_path = Path(config.OUTPUT_DIR) / f"{cache_key}.wav"
        
        logger.info("Generating speech", text_length=len(processed_text), voice=request.voice_id)
        
        # Use TTS to generate audio
        wav = tts_manager.tts.tts(
            text=processed_text,
            file_path=str(output_path)
        )
        
        # Load generated audio
        audio_data, sample_rate = sf.read(str(output_path))
        
        # Post-process audio
        if isinstance(audio_data, np.ndarray):
            processed_audio = postprocess_audio(
                audio_data, sample_rate, 
                request.speed, request.pitch, request.volume
            )
        else:
            processed_audio = audio_data
        
        # Save processed audio to cache
        sf.write(str(cache_file), processed_audio, request.sample_rate or sample_rate)
        
        # Calculate duration
        duration = len(processed_audio) / (request.sample_rate or sample_rate)
        
        # Get file size
        file_size = cache_file.stat().st_size
        
        processing_time = time.time() - start_time
        
        logger.info("Speech generated successfully",
                   processing_time=processing_time,
                   duration=duration,
                   voice=request.voice_id,
                   file_size=file_size)
        
        return TTSResponse(
            audio_url=f"/audio/{cache_key}.{request.format}",
            duration=duration,
            sample_rate=request.sample_rate or sample_rate,
            format=request.format,
            file_size=file_size,
            processing_time=processing_time,
            voice_used=request.voice_id,
            metadata={
                "cached": False,
                "text_length": len(processed_text),
                "original_sample_rate": sample_rate,
                "post_processed": config.ENABLE_POSTPROCESSING
            }
        )
        
    except Exception as e:
        logger.error("Speech generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

# API Routes
@app.on_event("startup")
async def startup_event():
    """Load TTS model on startup"""
    await tts_manager.load_model()

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "AutoNews TTS Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy" if tts_manager.is_loaded else "loading",
        model_loaded=tts_manager.is_loaded,
        device=config.DEVICE,
        available_voices=list(tts_manager.available_voices.keys()),
        uptime=time.time() - (tts_manager.load_time or time.time())
    )

@app.get("/voices", response_model=List[VoiceInfo])
async def list_voices():
    """List available voices"""
    voices = []
    for voice_id, info in tts_manager.available_voices.items():
        voices.append(VoiceInfo(
            voice_id=voice_id,
            name=info["name"],
            language=info["language"],
            gender=info["gender"],
            description=info["description"],
            sample_rate=config.SAMPLE_RATE
        ))
    return voices

@app.post("/tts", response_model=TTSResponse)
async def text_to_speech(
    request: TTSRequest,
    token: str = Depends(verify_internal_token)
):
    """Convert text to speech"""
    if not tts_manager.is_loaded:
        raise HTTPException(status_code=503, detail="TTS model not loaded yet")
    
    if len(request.text) > config.MAX_TEXT_LENGTH:
        raise HTTPException(status_code=400, detail=f"Text too long. Maximum {config.MAX_TEXT_LENGTH} characters")
    
    return await generate_speech(request)

@app.post("/tts/batch", response_model=List[TTSResponse])
async def batch_text_to_speech(
    request: BatchTTSRequest,
    token: str = Depends(verify_internal_token)
):
    """Convert multiple texts to speech"""
    if not tts_manager.is_loaded:
        raise HTTPException(status_code=503, detail="TTS model not loaded yet")
    
    if len(request.texts) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 texts per batch")
    
    # Generate TTS for each text
    tasks = []
    for text in request.texts:
        tts_request = TTSRequest(
            text=text,
            voice_id=request.voice_id,
            speed=request.speed
        )
        tasks.append(generate_speech(tts_request))
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle exceptions
    responses = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Failed to process text {i}", error=str(result))
            raise HTTPException(status_code=500, detail=f"Failed to process text {i}: {str(result)}")
        responses.append(result)
    
    return responses

@app.get("/audio/{filename}")
async def get_audio_file(filename: str):
    """Serve audio files"""
    file_path = Path(config.CACHE_DIR) / filename
    
    if not file_path.exists():
        file_path = Path(config.OUTPUT_DIR) / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        filename=filename
    )

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    return {
        "model_loaded": tts_manager.is_loaded,
        "device": config.DEVICE,
        "available_voices": len(tts_manager.available_voices),
        "uptime": time.time() - (tts_manager.load_time or time.time()),
        "cache_files": len(list(Path(config.CACHE_DIR).glob("*.wav"))),
        "output_files": len(list(Path(config.OUTPUT_DIR).glob("*.wav")))
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8002")),
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info")
    )