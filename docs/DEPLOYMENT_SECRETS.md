# GitHub Secrets Configuration Template

## Required Secrets for AutoNews CI/CD Pipeline

### Backend Deployment (Railway)
```
RAILWAY_TOKEN=your_railway_api_token
```

### NLP Services Deployment
```
# Hugging Face Spaces (for summarizer)
HF_USERNAME=your_huggingface_username
HF_TOKEN=your_huggingface_api_token

# Render (for TTS service)
RENDER_TTS_SERVICE_ID=your_render_tts_service_id
RENDER_API_KEY=your_render_api_key
```

### Video Pipeline Deployment (Render)
```
RENDER_VIDEO_SERVICE_ID=your_render_video_service_id
RENDER_API_KEY=your_render_api_key  # Same as above if using same account
```

### Frontend Deployment (Vercel)
```
VERCEL_TOKEN=your_vercel_api_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
```

### Additional Secrets for Services
```
# Database
DATABASE_URL=your_production_database_url

# External APIs
GNEWS_API_KEY=your_gnews_api_key
YOUTUBE_API_KEY=your_youtube_api_key

# JWT
JWT_SECRET=your_jwt_secret_key

# Service Communication
INTERNAL_API_SECRET=your_internal_api_secret
```

## Setup Instructions

1. Go to your GitHub repository
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret" for each secret above
4. Add the secret name (left column) and value

## Service Configuration

### Railway (Backend)
1. Create Railway account and project
2. Get API token from Railway dashboard
3. Connect your GitHub repository
4. Set environment variables in Railway dashboard

### Render (NLP & Video Services)
1. Create Render account
2. Create web services for TTS and Video Pipeline
3. Get service IDs from service URLs
4. Generate API key from account settings

### Vercel (Frontend)
1. Create Vercel account
2. Import your GitHub repository
3. Get org ID and project ID from project settings
4. Generate API token from account settings

### Hugging Face Spaces (Optional - Summarizer)
1. Create Hugging Face account
2. Create a Space for the summarizer service
3. Get username and API token
4. Alternative: Deploy summarizer to Render instead

## Environment Variables per Service

### Backend (.env)
```
NODE_ENV=production
PORT=8000
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
GNEWS_API_KEY=${GNEWS_API_KEY}
YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
SUMMARIZER_SERVICE_URL=https://your-summarizer-service.com
TTS_SERVICE_URL=https://your-tts-service.com
VIDEO_SERVICE_URL=https://your-video-service.com
INTERNAL_API_SECRET=${INTERNAL_API_SECRET}
```

### NLP Services (.env)
```
INTERNAL_API_SECRET=${INTERNAL_API_SECRET}
MODEL_CACHE_DIR=/tmp/models
HUGGINGFACE_CACHE_DIR=/tmp/hf_cache
```

### Video Pipeline (.env)
```
INTERNAL_API_SECRET=${INTERNAL_API_SECRET}
TEMP_DIR=/tmp/video_processing
FFMPEG_PATH=/usr/bin/ffmpeg
```

### Frontend (.env)
```
REACT_APP_API_URL=https://your-backend-service.com
REACT_APP_ENV=production
```