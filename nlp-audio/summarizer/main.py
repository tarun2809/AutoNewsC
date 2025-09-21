from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
import uvicorn
import os
import hashlib
import json
import time
from datetime import datetime
import logging
import asyncio
from pathlib import Path

# Import ML libraries
from transformers import pipeline, AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from rouge_score import rouge_scorer
import nltk
from textstat import flesch_reading_ease, flesch_kincaid_grade
from langdetect import detect
import re

# Import utilities
from dotenv import load_dotenv
import structlog

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

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except:
    pass

app = FastAPI(
    title="AutoNews Summarization Service",
    description="AI-powered news summarization using Hugging Face transformers",
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
    MODEL_NAME = os.getenv("SUMMARIZER_MODEL", "facebook/bart-large-cnn")
    FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "t5-small")
    MAX_LENGTH = int(os.getenv("MAX_SUMMARY_LENGTH", "150"))
    MIN_LENGTH = int(os.getenv("MIN_SUMMARY_LENGTH", "30"))
    CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
    INTERNAL_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "dev-secret")
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1"))

config = Config()

# Pydantic models
class SummarizeRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Article title")
    content: str = Field(..., min_length=100, max_length=10000, description="Article content")
    length_hint: Optional[int] = Field(120, ge=30, le=300, description="Desired summary length in words")
    language: Optional[str] = Field("en", min_length=2, max_length=2, description="Language code (ISO 639-1)")
    style: Optional[str] = Field("news", description="Summary style: news, casual, formal")
    
    @validator('content')
    def validate_content(cls, v):
        if len(v.split()) < 20:
            raise ValueError('Content must have at least 20 words')
        return v

class SummarizeResponse(BaseModel):
    summary: str
    length: int
    reading_level: Dict[str, float]
    quality_score: float
    processing_time: float
    model_used: str
    language_detected: str
    key_points: List[str]
    metadata: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    memory_usage: Dict[str, float]
    uptime: float

class BatchSummarizeRequest(BaseModel):
    articles: List[SummarizeRequest] = Field(..., max_items=10)

# Global model storage
class ModelManager:
    def __init__(self):
        self.summarizer = None
        self.tokenizer = None
        self.model = None
        self.fallback_summarizer = None
        self.is_loaded = False
        self.load_time = None
        
    async def load_models(self):
        """Load the summarization models"""
        try:
            logger.info("Loading summarization models", model=config.MODEL_NAME, device=config.DEVICE)
            start_time = time.time()
            
            # Primary model
            self.tokenizer = AutoTokenizer.from_pretrained(config.MODEL_NAME)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(config.MODEL_NAME)
            self.model.to(config.DEVICE)
            
            self.summarizer = pipeline(
                "summarization",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if config.DEVICE == "cuda" else -1,
                framework="pt"
            )
            
            # Fallback model for error cases
            self.fallback_summarizer = pipeline(
                "summarization",
                model=config.FALLBACK_MODEL,
                device=0 if config.DEVICE == "cuda" else -1,
                framework="pt"
            )
            
            self.load_time = time.time() - start_time
            self.is_loaded = True
            
            logger.info("Models loaded successfully", 
                       load_time=self.load_time, 
                       device=config.DEVICE,
                       model=config.MODEL_NAME)
                       
        except Exception as e:
            logger.error("Failed to load models", error=str(e))
            raise HTTPException(status_code=500, detail=f"Failed to load models: {str(e)}")

model_manager = ModelManager()

# Authentication
async def verify_internal_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != config.INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return credentials.credentials

# Utility functions
def calculate_content_hash(content: str) -> str:
    """Generate hash for content caching"""
    return hashlib.md5(content.encode()).hexdigest()

def preprocess_text(text: str) -> str:
    """Clean and preprocess text for summarization"""
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Remove special characters but keep punctuation
    text = re.sub(r'[^\w\s\.\,\!\?\;\:\-\(\)\"\']+', '', text)
    
    # Remove URLs
    text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
    
    return text

def extract_key_points(text: str, num_points: int = 3) -> List[str]:
    """Extract key points from text using simple sentence ranking"""
    sentences = nltk.sent_tokenize(text)
    
    # Simple scoring based on sentence length and position
    scored_sentences = []
    for i, sentence in enumerate(sentences):
        if len(sentence.split()) >= 5:  # Minimum sentence length
            # Score based on position (earlier sentences get higher scores)
            position_score = 1.0 - (i / len(sentences)) * 0.3
            length_score = min(len(sentence.split()) / 20, 1.0)  # Optimal length around 20 words
            total_score = position_score * 0.7 + length_score * 0.3
            scored_sentences.append((sentence, total_score))
    
    # Sort by score and return top sentences
    scored_sentences.sort(key=lambda x: x[1], reverse=True)
    return [sent[0] for sent in scored_sentences[:num_points]]

def calculate_quality_score(original: str, summary: str) -> float:
    """Calculate summary quality score using ROUGE and other metrics"""
    try:
        scorer = rouge_scorer.RougeScorer(['rouge1', 'rougeL'], use_stemmer=True)
        scores = scorer.score(original, summary)
        
        # Combine ROUGE scores
        rouge_score = (scores['rouge1'].fmeasure + scores['rougeL'].fmeasure) / 2
        
        # Length ratio score (penalize too short or too long summaries)
        length_ratio = len(summary.split()) / len(original.split())
        length_score = 1.0 - abs(length_ratio - 0.1) * 2  # Target ~10% of original length
        length_score = max(0, min(1, length_score))
        
        # Final quality score
        quality_score = rouge_score * 0.7 + length_score * 0.3
        return min(1.0, max(0.0, quality_score))
        
    except Exception as e:
        logger.warning("Failed to calculate quality score", error=str(e))
        return 0.5  # Default score

async def generate_summary(request: SummarizeRequest) -> SummarizeResponse:
    """Generate summary for a single article"""
    start_time = time.time()
    
    try:
        # Preprocess content
        clean_content = preprocess_text(request.content)
        full_text = f"{request.title}. {clean_content}"
        
        # Detect language
        try:
            detected_lang = detect(full_text)
        except:
            detected_lang = "unknown"
        
        # Calculate target length based on hint and content
        content_words = len(clean_content.split())
        target_length = min(request.length_hint, max(30, content_words // 10))
        
        # Generate summary
        try:
            summary_result = model_manager.summarizer(
                full_text,
                max_length=min(target_length + 50, config.MAX_LENGTH),
                min_length=max(target_length - 20, config.MIN_LENGTH),
                do_sample=False,
                truncation=True
            )
            summary_text = summary_result[0]['summary_text']
            model_used = config.MODEL_NAME
            
        except Exception as e:
            logger.warning("Primary model failed, using fallback", error=str(e))
            # Fallback to simpler model
            summary_result = model_manager.fallback_summarizer(
                full_text,
                max_length=target_length + 30,
                min_length=max(target_length - 10, 20),
                do_sample=False,
                truncation=True
            )
            summary_text = summary_result[0]['summary_text']
            model_used = config.FALLBACK_MODEL
        
        # Post-process summary
        summary_text = summary_text.strip()
        if not summary_text.endswith('.'):
            summary_text += '.'
        
        # Calculate metrics
        processing_time = time.time() - start_time
        quality_score = calculate_quality_score(clean_content, summary_text)
        
        # Reading level analysis
        reading_level = {
            "flesch_ease": flesch_reading_ease(summary_text),
            "flesch_kincaid": flesch_kincaid_grade(summary_text)
        }
        
        # Extract key points
        key_points = extract_key_points(clean_content)
        
        # Metadata
        metadata = {
            "original_length": content_words,
            "compression_ratio": len(summary_text.split()) / content_words,
            "title_length": len(request.title.split()),
            "processing_device": config.DEVICE,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info("Summary generated successfully", 
                   processing_time=processing_time,
                   quality_score=quality_score,
                   model_used=model_used,
                   summary_length=len(summary_text.split()))
        
        return SummarizeResponse(
            summary=summary_text,
            length=len(summary_text.split()),
            reading_level=reading_level,
            quality_score=quality_score,
            processing_time=processing_time,
            model_used=model_used,
            language_detected=detected_lang,
            key_points=key_points,
            metadata=metadata
        )
        
    except Exception as e:
        logger.error("Summary generation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")

# API Routes
@app.on_event("startup")
async def startup_event():
    """Load models on startup"""
    await model_manager.load_models()

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "AutoNews Summarization Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    memory_info = {}
    if torch.cuda.is_available():
        memory_info = {
            "gpu_memory_allocated": torch.cuda.memory_allocated() / 1024**3,  # GB
            "gpu_memory_reserved": torch.cuda.memory_reserved() / 1024**3,   # GB
        }
    
    return HealthResponse(
        status="healthy" if model_manager.is_loaded else "loading",
        model_loaded=model_manager.is_loaded,
        device=config.DEVICE,
        memory_usage=memory_info,
        uptime=time.time() - (model_manager.load_time or time.time())
    )

@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_article(
    request: SummarizeRequest,
    token: str = Depends(verify_internal_token)
):
    """Summarize a single article"""
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet")
    
    return await generate_summary(request)

@app.post("/summarize/batch", response_model=List[SummarizeResponse])
async def summarize_batch(
    request: BatchSummarizeRequest,
    background_tasks: BackgroundTasks,
    token: str = Depends(verify_internal_token)
):
    """Summarize multiple articles in batch"""
    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Models not loaded yet")
    
    if len(request.articles) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 articles per batch")
    
    # Process all articles
    tasks = [generate_summary(article) for article in request.articles]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle any exceptions in the results
    responses = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Failed to process article {i}", error=str(result))
            # Create error response
            responses.append(SummarizeResponse(
                summary=f"Error processing article: {str(result)}",
                length=0,
                reading_level={"flesch_ease": 0, "flesch_kincaid": 0},
                quality_score=0.0,
                processing_time=0.0,
                model_used="error",
                language_detected="unknown",
                key_points=[],
                metadata={"error": str(result)}
            ))
        else:
            responses.append(result)
    
    return responses

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    return {
        "model_loaded": model_manager.is_loaded,
        "model_name": config.MODEL_NAME,
        "device": config.DEVICE,
        "uptime": time.time() - (model_manager.load_time or time.time()),
        "memory_usage": torch.cuda.memory_allocated() / 1024**3 if torch.cuda.is_available() else 0
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8001")),
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level=os.getenv("LOG_LEVEL", "info")
    )