# AutoNews NLP & Audio Services

This directory contains two microservices for natural language processing and audio generation:

1. **Summarizer Service** - News article summarization using Hugging Face transformers
2. **TTS Service** - Text-to-speech conversion using Coqui TTS

## 🏗️ Architecture

```
NLP & Audio Services
├── Summarizer (Port 8001)
│   ├── BART/T5 Models
│   ├── Quality Assessment
│   └── Batch Processing
└── TTS Service (Port 8002)
    ├── Coqui TTS Models
    ├── Audio Post-processing
    └── Voice Management
```

## 🔧 Tech Stack

### Summarizer Service
- **Framework**: FastAPI
- **ML Models**: Hugging Face Transformers (BART, T5)
- **Quality Metrics**: ROUGE, Reading Level Analysis
- **Text Processing**: NLTK, spaCy

### TTS Service
- **Framework**: FastAPI
- **TTS Engine**: Coqui TTS
- **Audio Processing**: librosa, pydub, soundfile
- **Voice Synthesis**: Tacotron2, HiFiGAN

## 📋 Prerequisites

- Python 3.11+
- PyTorch (with CUDA support recommended)
- FFmpeg (for audio processing)
- 4GB+ RAM (8GB+ recommended with GPU)

## 🚀 Quick Start

### Summarizer Service

1. **Setup environment**
   ```bash
   cd summarizer
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start service**
   ```bash
   python main.py
   ```

4. **Test the service**
   ```bash
   curl -X POST "http://localhost:8001/summarize" \
     -H "Authorization: Bearer your-secret" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Breaking News Title",
       "content": "Your news article content here...",
       "length_hint": 120
     }'
   ```

### TTS Service

1. **Setup environment**
   ```bash
   cd tts-service
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start service**
   ```bash
   python main.py
   ```

4. **Test the service**
   ```bash
   curl -X POST "http://localhost:8002/tts" \
     -H "Authorization: Bearer your-secret" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "This is a test of the text to speech system.",
       "voice_id": "default",
       "speed": 1.0
     }'
   ```

## 📊 API Documentation

### Summarizer Service (Port 8001)

#### Endpoints
- `POST /summarize` - Summarize a single article
- `POST /summarize/batch` - Summarize multiple articles
- `GET /health` - Health check
- `GET /metrics` - Service metrics

#### Summarize Request
```json
{
  "title": "Article Title",
  "content": "Article content (min 100 chars)",
  "length_hint": 120,
  "language": "en",
  "style": "news"
}
```

#### Summarize Response
```json
{
  "summary": "Generated summary text",
  "length": 45,
  "reading_level": {
    "flesch_ease": 65.2,
    "flesch_kincaid": 8.1
  },
  "quality_score": 0.85,
  "processing_time": 2.3,
  "model_used": "facebook/bart-large-cnn",
  "language_detected": "en",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "metadata": {
    "original_length": 450,
    "compression_ratio": 0.1
  }
}
```

### TTS Service (Port 8002)

#### Endpoints
- `POST /tts` - Convert text to speech
- `POST /tts/batch` - Convert multiple texts
- `GET /voices` - List available voices
- `GET /audio/{filename}` - Download audio file
- `GET /health` - Health check
- `GET /metrics` - Service metrics

#### TTS Request
```json
{
  "text": "Text to convert to speech",
  "voice_id": "default",
  "speed": 1.0,
  "pitch": 1.0,
  "volume": 1.0,
  "sample_rate": 22050,
  "format": "wav"
}
```

#### TTS Response
```json
{
  "audio_url": "/audio/abc123.wav",
  "duration": 5.2,
  "sample_rate": 22050,
  "format": "wav",
  "file_size": 230400,
  "processing_time": 1.8,
  "voice_used": "default",
  "metadata": {
    "cached": false,
    "text_length": 45,
    "post_processed": true
  }
}
```

## 🧠 Model Configuration

### Summarizer Models

**Primary Model: BART-Large-CNN**
- Best for news summarization
- Higher quality but slower
- Requires ~2GB GPU memory

**Fallback Model: T5-Small**
- Faster processing
- Lower memory requirements
- Good quality for shorter texts

### TTS Models

**Default: Tacotron2 + HiFiGAN**
- High-quality speech synthesis
- English language optimized
- ~1GB model size

**Available Voices:**
- `default` - Female English voice
- `male` - Male English voice
- More voices can be added via configuration

## 🔧 Configuration

### Summarizer Environment Variables

```bash
# Model Configuration
SUMMARIZER_MODEL=facebook/bart-large-cnn
FALLBACK_MODEL=t5-small
MAX_SUMMARY_LENGTH=150
MIN_SUMMARY_LENGTH=30

# Server
HOST=0.0.0.0
PORT=8001

# Authentication
INTERNAL_SERVICE_SECRET=your-secret

# Processing
BATCH_SIZE=1
USE_GPU=true
```

### TTS Environment Variables

```bash
# Model Configuration
TTS_MODEL=tts_models/en/ljspeech/tacotron2-DDC
VOCODER_MODEL=vocoder_models/en/ljspeech/hifigan_v2
USE_GPU=true

# Server
HOST=0.0.0.0
PORT=8002

# Audio Settings
SAMPLE_RATE=22050
AUDIO_FORMAT=wav
MAX_TEXT_LENGTH=1000

# Processing
ENABLE_PREPROCESSING=true
ENABLE_POSTPROCESSING=true
```

## 📈 Performance Optimization

### GPU Acceleration

Both services support CUDA acceleration:

```bash
# Check GPU availability
python -c "import torch; print(torch.cuda.is_available())"

# Monitor GPU usage
nvidia-smi
```

### Memory Management

**Summarizer Service:**
- Model loading: ~2GB GPU memory
- Per request: ~500MB additional
- Batch processing: Memory scales linearly

**TTS Service:**
- Model loading: ~1GB GPU memory
- Per request: ~200MB additional
- Audio caching reduces repeated processing

### Caching Strategy

Both services implement intelligent caching:

**Summarizer:**
- Content-based hashing
- ROUGE score validation
- Configurable cache expiry

**TTS:**
- Text + voice + speed hashing
- Audio file caching
- Automatic cleanup

## 🔍 Quality Assessment

### Summarization Quality

**Automatic Metrics:**
- ROUGE-1 and ROUGE-L scores
- Compression ratio analysis
- Reading level assessment
- Language detection

**Quality Thresholds:**
- ROUGE-L > 0.3 (good)
- Compression ratio: 0.05-0.15
- Flesch reading ease: 40-70

### TTS Quality

**Audio Quality Metrics:**
- Signal-to-noise ratio
- Dynamic range compression
- Loudness normalization
- Duration accuracy

**Post-processing Steps:**
- Noise reduction
- Volume normalization
- Dynamic range compression
- Format optimization

## 🧪 Testing

### Unit Tests

```bash
# Summarizer tests
cd summarizer
pytest tests/ -v --cov=main

# TTS tests
cd tts-service
pytest tests/ -v --cov=main
```

### Integration Tests

```bash
# Test summarizer API
python test_summarizer_integration.py

# Test TTS API
python test_tts_integration.py

# Test full pipeline
python test_nlp_audio_pipeline.py
```

### Load Testing

```bash
# Install locust
pip install locust

# Run load tests
locust -f load_test.py --host=http://localhost:8001
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build images
docker build -t autonews-summarizer ./summarizer
docker build -t autonews-tts ./tts-service

# Run services
docker run -p 8001:8001 autonews-summarizer
docker run -p 8002:8002 autonews-tts
```

### Production Considerations

**Resource Requirements:**
- CPU: 4+ cores
- RAM: 8GB+ (16GB with GPU)
- GPU: 6GB+ VRAM (optional but recommended)
- Storage: 10GB+ for models and cache

**Scaling:**
- Use load balancers for multiple instances
- Implement request queuing for high load
- Monitor GPU memory usage
- Set up health checks and auto-restart

### Environment-specific Configs

**Development:**
```bash
USE_GPU=false
BATCH_SIZE=1
CACHE_DIR=./dev_cache
LOG_LEVEL=debug
```

**Production:**
```bash
USE_GPU=true
BATCH_SIZE=4
CACHE_DIR=/app/cache
LOG_LEVEL=info
ENABLE_METRICS=true
```

## 🔧 Monitoring

### Health Checks

Both services provide comprehensive health endpoints:

```bash
# Check service health
curl http://localhost:8001/health
curl http://localhost:8002/health

# Get metrics
curl http://localhost:8001/metrics
curl http://localhost:8002/metrics
```

### Logging

Structured JSON logging with:
- Request tracing
- Performance metrics
- Error tracking
- Model usage statistics

### Alerts

Set up monitoring for:
- Service availability
- Response time > 10s
- GPU memory usage > 90%
- Cache hit rate < 50%
- Error rate > 5%

## 🔍 Troubleshooting

### Common Issues

**1. CUDA Out of Memory**
```bash
# Reduce batch size
export BATCH_SIZE=1

# Monitor GPU memory
nvidia-smi -l 1
```

**2. Model Loading Failures**
```bash
# Clear model cache
rm -rf ~/.cache/huggingface/
rm -rf ~/.local/share/tts/

# Download models manually
python -c "from transformers import AutoModel; AutoModel.from_pretrained('facebook/bart-large-cnn')"
```

**3. Audio Quality Issues**
```bash
# Check FFmpeg installation
ffmpeg -version

# Verify audio file
ffprobe output.wav

# Test with different sample rates
export SAMPLE_RATE=16000
```

**4. Performance Issues**
```bash
# Profile service
python -m cProfile main.py

# Monitor resource usage
htop
iostat -x 1
```

### Debug Mode

Enable detailed logging:

```bash
export LOG_LEVEL=debug
export TRANSFORMERS_VERBOSITY=debug
export TTS_VERBOSITY=debug
```

## 📞 Support

### API Documentation
- Summarizer: http://localhost:8001/docs
- TTS: http://localhost:8002/docs

### Logs
- Service logs: `./logs/`
- Error tracking in structured JSON format
- Performance metrics for optimization

---

For more information, check the individual service README files and API documentation.