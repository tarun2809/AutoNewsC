# AutoNews Deployment Guide

## Overview

AutoNews is a microservices-based application with four main components:
1. **Backend & Orchestration** (Node.js) - Railway/Render
2. **NLP Summarizer** (Python FastAPI) - Hugging Face Spaces/Render  
3. **TTS Service** (Python FastAPI) - Render
4. **Video Pipeline** (Python FastAPI) - Render
5. **Frontend** (React) - Vercel

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Git
- API Keys: GNews, YouTube Data API v3

## Local Development Setup

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd AutoNewsC
cp .env.example .env
# Edit .env with your API keys
```

### 2. Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services will be available at:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Summarizer: http://localhost:8001
- TTS Service: http://localhost:8002
- Video Pipeline: http://localhost:8003
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 3. Manual Setup (Alternative)

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### NLP Services
```bash
# Summarizer
cd nlp-audio/summarizer
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# TTS Service
cd nlp-audio/tts-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

#### Video Pipeline
```bash
cd video-pipeline
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8003
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## Production Deployment

### 1. Setup GitHub Secrets

Go to your GitHub repository settings and add these secrets:

```
# Railway (Backend)
RAILWAY_TOKEN

# Render (Python Services)
RENDER_API_KEY
RENDER_TTS_SERVICE_ID
RENDER_VIDEO_SERVICE_ID

# Vercel (Frontend)
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Hugging Face (Optional - Summarizer)
HF_USERNAME
HF_TOKEN

# Application Secrets
DATABASE_URL
JWT_SECRET
GNEWS_API_KEY
YOUTUBE_API_KEY
INTERNAL_API_SECRET
```

### 2. Backend Deployment (Railway)

1. Create Railway account: https://railway.app
2. Create new project from GitHub repo
3. Select backend folder as root
4. Add environment variables:
   ```
   NODE_ENV=production
   PORT=8000
   DATABASE_URL=(Railway will provide)
   JWT_SECRET=your-secret
   GNEWS_API_KEY=your-key
   YOUTUBE_API_KEY=your-key
   SUMMARIZER_SERVICE_URL=https://your-summarizer.onrender.com
   TTS_SERVICE_URL=https://your-tts.onrender.com
   VIDEO_SERVICE_URL=https://your-video.onrender.com
   INTERNAL_API_SECRET=your-secret
   ```

### 3. Python Services Deployment (Render)

#### Summarizer Service
1. Create Render account: https://render.com
2. Create new Web Service
3. Connect GitHub repo
4. Root directory: `nlp-audio/summarizer`
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
7. Environment variables:
   ```
   INTERNAL_API_SECRET=your-secret
   MODEL_CACHE_DIR=/tmp/models
   HUGGINGFACE_CACHE_DIR=/tmp/hf_cache
   ```

#### TTS Service
1. Create new Web Service on Render
2. Root directory: `nlp-audio/tts-service`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Same environment variables as summarizer

#### Video Pipeline Service
1. Create new Web Service on Render
2. Root directory: `video-pipeline`
3. Build command: `apt-get update && apt-get install -y ffmpeg && pip install -r requirements.txt`
4. Start command: `uvicorn src.main:app --host 0.0.0.0 --port $PORT`
5. Environment variables:
   ```
   INTERNAL_API_SECRET=your-secret
   TEMP_DIR=/tmp/video_processing
   FFMPEG_PATH=/usr/bin/ffmpeg
   ```

### 4. Frontend Deployment (Vercel)

1. Create Vercel account: https://vercel.com
2. Import GitHub repository
3. Root directory: `frontend`
4. Environment variables:
   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   REACT_APP_ENV=production
   ```

### 5. Alternative: Hugging Face Spaces (Summarizer)

1. Create HF account: https://huggingface.co
2. Create new Space with Gradio SDK
3. Upload files from `nlp-audio/summarizer/`
4. The `app.py` file provides both Gradio UI and FastAPI backend

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) automatically:

1. **Tests** all services on push/PR
2. **Deploys** to production on main branch
3. **Runs integration tests** after deployment

### Triggering Deployments

- Push to `main` branch triggers production deployment
- Push to `develop` branch runs tests only
- Pull requests run full test suite

## Monitoring & Health Checks

Each service includes health check endpoints:
- Backend: `GET /api/health`
- Summarizer: `GET /health`
- TTS: `GET /health`
- Video: `GET /health`

### Metrics Endpoints
- Backend: `GET /api/metrics`
- All services include: response times, error rates, resource usage

## Database Setup

### PostgreSQL Schema
```sql
-- Auto-created by backend on first run
-- See backend/src/database/schema.sql for full schema
```

### Migrations
```bash
cd backend
npm run migrate
```

## API Documentation

- **Backend API**: https://your-backend.railway.app/api/docs
- **Summarizer**: https://your-summarizer.onrender.com/docs
- **TTS Service**: https://your-tts.onrender.com/docs
- **Video Pipeline**: https://your-video.onrender.com/docs

## Troubleshooting

### Common Issues

1. **Service Communication Errors**
   - Check `INTERNAL_API_SECRET` is same across all services
   - Verify service URLs in backend environment

2. **Model Loading Timeouts**
   - Increase health check timeout for Python services
   - Use persistent storage for model cache

3. **Video Processing Failures**
   - Ensure FFmpeg is installed in deployment environment
   - Check disk space for temporary files

4. **Database Connection Issues**
   - Verify `DATABASE_URL` format
   - Check database service is running

### Logs and Debugging

```bash
# Docker Compose logs
docker-compose logs -f [service-name]

# Railway logs
railway logs

# Render logs
Check Render dashboard for each service

# Vercel logs
Check Vercel dashboard deployment logs
```

## Scaling Considerations

1. **Backend**: Horizontal scaling via Railway
2. **Python Services**: Vertical scaling on Render
3. **Database**: PostgreSQL connection pooling
4. **File Storage**: Use S3/CloudFlare for video outputs
5. **CDN**: Vercel provides CDN for frontend

## Security Checklist

- [ ] All API keys stored as secrets
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] JWT secrets are secure
- [ ] Internal API authentication
- [ ] HTTPS enforced in production
- [ ] Database credentials secured

## Cost Optimization

- **Railway**: $5/month for backend
- **Render**: $7/month per Python service
- **Vercel**: Free tier for frontend
- **HF Spaces**: Free for public spaces
- **Total**: ~$26/month for full deployment

## Support

For deployment issues:
1. Check service health endpoints
2. Review application logs
3. Verify environment variables
4. Test API endpoints manually
5. Create GitHub issue with logs