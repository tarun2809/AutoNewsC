from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, validator, HttpUrl
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
import json

# Video Processing
from moviepy.editor import (
    VideoFileClip, AudioFileClip, ImageClip, TextClip, CompositeVideoClip,
    concatenate_videoclips, vfx, afx, ColorClip
)
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import requests
from io import BytesIO

# Subtitle Processing
import pysrt
import ffmpeg

# Utilities
from dotenv import load_dotenv
import structlog
import aiofiles
import httpx

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
    title="AutoNews Video Pipeline Service",
    description="Video generation and rendering service using MoviePy and FFmpeg",
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
    OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./video_output")
    CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
    ASSETS_DIR = os.getenv("ASSETS_DIR", "./assets")
    TEMPLATES_DIR = os.getenv("TEMPLATES_DIR", "./templates")
    INTERNAL_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "dev-secret")
    
    # Video settings
    VIDEO_WIDTH = int(os.getenv("VIDEO_WIDTH", "1920"))
    VIDEO_HEIGHT = int(os.getenv("VIDEO_HEIGHT", "1080"))
    VIDEO_FPS = int(os.getenv("VIDEO_FPS", "30"))
    VIDEO_CODEC = os.getenv("VIDEO_CODEC", "libx264")
    AUDIO_CODEC = os.getenv("AUDIO_CODEC", "aac")
    
    # Template settings
    DEFAULT_THEME = os.getenv("DEFAULT_THEME", "modern")
    FONT_FAMILY = os.getenv("FONT_FAMILY", "Arial-Bold")
    
    # Processing settings
    MAX_VIDEO_LENGTH = int(os.getenv("MAX_VIDEO_LENGTH", "300"))  # 5 minutes
    ENABLE_GPU_ACCELERATION = os.getenv("ENABLE_GPU_ACCELERATION", "false").lower() == "true"

config = Config()

# Ensure directories exist
for directory in [config.OUTPUT_DIR, config.CACHE_DIR, config.ASSETS_DIR, config.TEMPLATES_DIR]:
    os.makedirs(directory, exist_ok=True)

# Pydantic models
class VideoRenderRequest(BaseModel):
    summary_text: str = Field(..., min_length=10, max_length=2000, description="Summary text for the video")
    audio_url: str = Field(..., description="URL to the audio file")
    title: str = Field(..., min_length=5, max_length=100, description="Video title")
    theme: Optional[str] = Field("modern", description="Video theme template")
    duration: Optional[float] = Field(None, ge=5, le=300, description="Video duration in seconds")
    images: Optional[List[str]] = Field([], description="List of image URLs")
    background_music: Optional[str] = Field(None, description="Background music URL")
    logo_url: Optional[str] = Field(None, description="Logo image URL")
    brand_colors: Optional[Dict[str, str]] = Field({}, description="Brand color scheme")
    subtitle_style: Optional[str] = Field("default", description="Subtitle style")
    
    @validator('summary_text')
    def validate_summary(cls, v):
        if len(v.strip()) == 0:
            raise ValueError('Summary text cannot be empty')
        return v.strip()

class ThumbnailRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=100)
    subtitle: Optional[str] = Field(None, max_length=200)
    image_url: Optional[str] = Field(None, description="Background image URL")
    theme: Optional[str] = Field("modern", description="Thumbnail theme")
    layout: Optional[str] = Field("default", description="Thumbnail layout")

class VideoResponse(BaseModel):
    video_url: str
    thumbnail_url: str
    subtitle_url: Optional[str]
    duration: float
    resolution: str
    file_size: int
    processing_time: float
    metadata: Dict[str, Any]

class ThumbnailResponse(BaseModel):
    thumbnail_url: str
    dimensions: Dict[str, int]
    file_size: int
    format: str
    processing_time: float

class HealthResponse(BaseModel):
    status: str
    ffmpeg_available: bool
    gpu_acceleration: bool
    templates_loaded: int
    uptime: float

# Authentication
async def verify_internal_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != config.INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return credentials.credentials

# Utility functions
def generate_cache_key(content: str) -> str:
    """Generate cache key for video content"""
    return hashlib.md5(content.encode()).hexdigest()

async def download_file(url: str, destination: Path) -> Path:
    """Download file from URL to destination"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            async with aiofiles.open(destination, 'wb') as f:
                await f.write(response.content)
                
        return destination
    except Exception as e:
        logger.error("Failed to download file", url=url, error=str(e))
        raise HTTPException(status_code=400, detail=f"Failed to download file: {str(e)}")

def create_title_clip(text: str, duration: float, theme: str = "modern") -> TextClip:
    """Create animated title clip"""
    try:
        # Theme configurations
        themes = {
            "modern": {
                "fontsize": 80,
                "color": "white",
                "font": config.FONT_FAMILY,
                "stroke_color": "black",
                "stroke_width": 2
            },
            "classic": {
                "fontsize": 70,
                "color": "gold",
                "font": config.FONT_FAMILY,
                "stroke_color": "darkblue",
                "stroke_width": 3
            },
            "minimalist": {
                "fontsize": 60,
                "color": "black",
                "font": config.FONT_FAMILY,
                "stroke_color": None,
                "stroke_width": 0
            }
        }
        
        style = themes.get(theme, themes["modern"])
        
        # Create text clip
        title_clip = TextClip(
            text,
            fontsize=style["fontsize"],
            color=style["color"],
            font=style["font"],
            stroke_color=style["stroke_color"],
            stroke_width=style["stroke_width"]
        ).set_duration(duration).set_position('center')
        
        # Add fade in/out animation
        title_clip = title_clip.fadein(0.5).fadeout(0.5)
        
        return title_clip
        
    except Exception as e:
        logger.error("Failed to create title clip", error=str(e))
        # Fallback to simple text
        return TextClip(text, fontsize=60, color='white').set_duration(duration).set_position('center')

def create_subtitle_clips(text: str, audio_duration: float) -> List[TextClip]:
    """Create subtitle clips from text"""
    try:
        # Split text into sentences
        sentences = text.replace('!', '.').replace('?', '.').split('.')
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return []
        
        # Calculate timing for each sentence
        clips = []
        time_per_sentence = audio_duration / len(sentences)
        
        for i, sentence in enumerate(sentences):
            if len(sentence) > 3:  # Skip very short sentences
                start_time = i * time_per_sentence
                end_time = min((i + 1) * time_per_sentence, audio_duration)
                
                subtitle_clip = TextClip(
                    sentence,
                    fontsize=40,
                    color='white',
                    font=config.FONT_FAMILY,
                    stroke_color='black',
                    stroke_width=1,
                    method='caption',
                    size=(config.VIDEO_WIDTH - 200, None)
                ).set_start(start_time).set_duration(end_time - start_time).set_position(('center', 'bottom'))
                
                clips.append(subtitle_clip)
        
        return clips
        
    except Exception as e:
        logger.error("Failed to create subtitle clips", error=str(e))
        return []

def create_background_clip(duration: float, theme: str = "modern") -> ColorClip:
    """Create background color clip"""
    theme_colors = {
        "modern": "#1a1a1a",
        "classic": "#000080",
        "minimalist": "#ffffff",
        "news": "#0066cc"
    }
    
    color = theme_colors.get(theme, "#1a1a1a")
    return ColorClip(
        size=(config.VIDEO_WIDTH, config.VIDEO_HEIGHT),
        color=color,
        duration=duration
    )

async def process_images(image_urls: List[str], video_duration: float) -> List[ImageClip]:
    """Download and process images for video"""
    clips = []
    
    if not image_urls:
        return clips
    
    try:
        # Calculate duration for each image
        image_duration = video_duration / len(image_urls)
        
        for i, url in enumerate(image_urls[:5]):  # Limit to 5 images
            try:
                # Download image
                temp_path = Path(config.CACHE_DIR) / f"temp_image_{i}_{int(time.time())}.jpg"
                await download_file(url, temp_path)
                
                # Create image clip with Ken Burns effect
                img_clip = ImageClip(str(temp_path), duration=image_duration)
                
                # Resize to fit video dimensions
                img_clip = img_clip.resize(height=config.VIDEO_HEIGHT)
                
                # Add Ken Burns effect (zoom and pan)
                img_clip = img_clip.resize(lambda t: 1 + 0.1 * t / image_duration)
                img_clip = img_clip.set_position(lambda t: ('center', 'center'))
                
                # Set timing
                img_clip = img_clip.set_start(i * image_duration)
                
                clips.append(img_clip)
                
                # Clean up temp file
                if temp_path.exists():
                    temp_path.unlink()
                    
            except Exception as e:
                logger.warning("Failed to process image", url=url, error=str(e))
                continue
                
    except Exception as e:
        logger.error("Failed to process images", error=str(e))
    
    return clips

def create_srt_subtitles(text: str, audio_duration: float, output_path: Path):
    """Create SRT subtitle file"""
    try:
        sentences = text.replace('!', '.').replace('?', '.').split('.')
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return
        
        subs = pysrt.SubRipFile()
        time_per_sentence = audio_duration / len(sentences)
        
        for i, sentence in enumerate(sentences):
            if len(sentence) > 3:
                start_time = pysrt.SubRipTime(seconds=i * time_per_sentence)
                end_time = pysrt.SubRipTime(seconds=min((i + 1) * time_per_sentence, audio_duration))
                
                subtitle = pysrt.SubRipItem(
                    index=i + 1,
                    start=start_time,
                    end=end_time,
                    text=sentence
                )
                subs.append(subtitle)
        
        subs.save(str(output_path), encoding='utf-8')
        
    except Exception as e:
        logger.error("Failed to create SRT subtitles", error=str(e))

async def generate_video(request: VideoRenderRequest) -> VideoResponse:
    """Generate video from request parameters"""
    start_time = time.time()
    
    try:
        # Generate cache key
        cache_content = f"{request.summary_text}_{request.audio_url}_{request.theme}"
        cache_key = generate_cache_key(cache_content)
        
        # Define output paths
        video_path = Path(config.OUTPUT_DIR) / f"{cache_key}.mp4"
        thumbnail_path = Path(config.OUTPUT_DIR) / f"{cache_key}_thumb.jpg"
        subtitle_path = Path(config.OUTPUT_DIR) / f"{cache_key}.srt"
        
        # Check if video already exists
        if video_path.exists():
            logger.info("Using cached video", cache_key=cache_key)
            
            # Get video info
            with VideoFileClip(str(video_path)) as clip:
                duration = clip.duration
                file_size = video_path.stat().st_size
            
            return VideoResponse(
                video_url=f"/video/{cache_key}.mp4",
                thumbnail_url=f"/video/{cache_key}_thumb.jpg",
                subtitle_url=f"/video/{cache_key}.srt" if subtitle_path.exists() else None,
                duration=duration,
                resolution=f"{config.VIDEO_WIDTH}x{config.VIDEO_HEIGHT}",
                file_size=file_size,
                processing_time=time.time() - start_time,
                metadata={"cached": True}
            )
        
        logger.info("Generating new video", cache_key=cache_key, theme=request.theme)
        
        # Download audio file
        audio_temp_path = Path(config.CACHE_DIR) / f"audio_{cache_key}.wav"
        await download_file(request.audio_url, audio_temp_path)
        
        # Load audio clip
        audio_clip = AudioFileClip(str(audio_temp_path))
        video_duration = request.duration or audio_clip.duration
        
        # Create background
        background = create_background_clip(video_duration, request.theme)
        
        # Create title clip (first 3 seconds)
        title_clip = create_title_clip(request.title, min(3, video_duration), request.theme)
        
        # Process images
        image_clips = await process_images(request.images, video_duration - 3)
        
        # Create subtitle clips
        subtitle_clips = create_subtitle_clips(request.summary_text, video_duration)
        
        # Compose video
        clips = [background]
        
        # Add title at the beginning
        clips.append(title_clip.set_start(0))
        
        # Add images after title
        if image_clips:
            for clip in image_clips:
                clips.append(clip.set_start(clip.start + 3))  # Start after title
        
        # Add subtitles
        clips.extend(subtitle_clips)
        
        # Create final video
        final_video = CompositeVideoClip(clips, size=(config.VIDEO_WIDTH, config.VIDEO_HEIGHT))
        final_video = final_video.set_audio(audio_clip)
        final_video = final_video.set_duration(video_duration)
        
        # Render video
        logger.info("Rendering video", duration=video_duration, resolution=f"{config.VIDEO_WIDTH}x{config.VIDEO_HEIGHT}")
        
        final_video.write_videofile(
            str(video_path),
            fps=config.VIDEO_FPS,
            codec=config.VIDEO_CODEC,
            audio_codec=config.AUDIO_CODEC,
            temp_audiofile='temp-audio.m4a',
            remove_temp=True,
            verbose=False,
            logger=None
        )
        
        # Generate thumbnail
        thumbnail_frame = final_video.get_frame(video_duration / 2)
        thumbnail_image = Image.fromarray(thumbnail_frame)
        thumbnail_image.save(str(thumbnail_path), "JPEG", quality=85)
        
        # Create SRT subtitles
        create_srt_subtitles(request.summary_text, video_duration, subtitle_path)
        
        # Clean up
        final_video.close()
        audio_clip.close()
        if audio_temp_path.exists():
            audio_temp_path.unlink()
        
        # Get final file info
        file_size = video_path.stat().st_size
        processing_time = time.time() - start_time
        
        logger.info("Video generated successfully",
                   processing_time=processing_time,
                   file_size=file_size,
                   duration=video_duration)
        
        return VideoResponse(
            video_url=f"/video/{cache_key}.mp4",
            thumbnail_url=f"/video/{cache_key}_thumb.jpg",
            subtitle_url=f"/video/{cache_key}.srt",
            duration=video_duration,
            resolution=f"{config.VIDEO_WIDTH}x{config.VIDEO_HEIGHT}",
            file_size=file_size,
            processing_time=processing_time,
            metadata={
                "cached": False,
                "theme": request.theme,
                "images_used": len(image_clips),
                "subtitle_segments": len(subtitle_clips)
            }
        )
        
    except Exception as e:
        logger.error("Video generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

async def generate_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse:
    """Generate thumbnail image"""
    start_time = time.time()
    
    try:
        cache_key = generate_cache_key(f"{request.title}_{request.theme}_{request.layout}")
        thumbnail_path = Path(config.OUTPUT_DIR) / f"thumb_{cache_key}.jpg"
        
        # Create thumbnail image
        img = Image.new('RGB', (1280, 720), color='#1a1a1a')
        draw = ImageDraw.Draw(img)
        
        # Try to load a font
        try:
            font_large = ImageFont.truetype("arial.ttf", 80)
            font_small = ImageFont.truetype("arial.ttf", 40)
        except:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        # Add title text
        bbox = draw.textbbox((0, 0), request.title, font=font_large)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (1280 - text_width) // 2
        y = (720 - text_height) // 2
        
        # Add shadow
        draw.text((x + 3, y + 3), request.title, font=font_large, fill='black')
        # Add main text
        draw.text((x, y), request.title, font=font_large, fill='white')
        
        # Add subtitle if provided
        if request.subtitle:
            bbox = draw.textbbox((0, 0), request.subtitle, font=font_small)
            subtitle_width = bbox[2] - bbox[0]
            subtitle_x = (1280 - subtitle_width) // 2
            subtitle_y = y + text_height + 20
            
            draw.text((subtitle_x + 2, subtitle_y + 2), request.subtitle, font=font_small, fill='black')
            draw.text((subtitle_x, subtitle_y), request.subtitle, font=font_small, fill='gray')
        
        # Save thumbnail
        img.save(str(thumbnail_path), "JPEG", quality=90)
        
        file_size = thumbnail_path.stat().st_size
        processing_time = time.time() - start_time
        
        return ThumbnailResponse(
            thumbnail_url=f"/video/thumb_{cache_key}.jpg",
            dimensions={"width": 1280, "height": 720},
            file_size=file_size,
            format="JPEG",
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error("Thumbnail generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Thumbnail generation failed: {str(e)}")

# API Routes
@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "AutoNews Video Pipeline Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    # Check FFmpeg availability
    ffmpeg_available = shutil.which("ffmpeg") is not None
    
    # Count templates
    templates_count = len(list(Path(config.TEMPLATES_DIR).glob("*.json")))
    
    return HealthResponse(
        status="healthy",
        ffmpeg_available=ffmpeg_available,
        gpu_acceleration=config.ENABLE_GPU_ACCELERATION,
        templates_loaded=templates_count,
        uptime=time.time()
    )

@app.post("/render", response_model=VideoResponse)
async def render_video(
    request: VideoRenderRequest,
    background_tasks: BackgroundTasks,
    token: str = Depends(verify_internal_token)
):
    """Render a video from the provided content"""
    return await generate_video(request)

@app.post("/thumbnail", response_model=ThumbnailResponse)
async def create_thumbnail(
    request: ThumbnailRequest,
    token: str = Depends(verify_internal_token)
):
    """Generate a thumbnail image"""
    return await generate_thumbnail(request)

@app.get("/video/{filename}")
async def get_video_file(filename: str):
    """Serve video files"""
    file_path = Path(config.OUTPUT_DIR) / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    if filename.endswith('.mp4'):
        media_type = "video/mp4"
    elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
        media_type = "image/jpeg"
    elif filename.endswith('.srt'):
        media_type = "text/plain"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename
    )

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    output_files = list(Path(config.OUTPUT_DIR).glob("*"))
    cache_files = list(Path(config.CACHE_DIR).glob("*"))
    
    return {
        "output_files": len(output_files),
        "cache_files": len(cache_files),
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
        "gpu_acceleration": config.ENABLE_GPU_ACCELERATION,
        "video_resolution": f"{config.VIDEO_WIDTH}x{config.VIDEO_HEIGHT}",
        "video_fps": config.VIDEO_FPS
    }

if __name__ == "__main__":
    import httpx  # Import here to avoid issues if not installed globally
    
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8003")),
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info")
    )