# AutoNews Backend & Orchestration Service

The backend service is the core orchestration layer for the AutoNews system, built with Node.js 20 and Express.js. It manages the entire news generation pipeline, from fetching trending news to coordinating with microservices for summarization, TTS, and video generation.

## 🏗️ Architecture

```
Backend Service
├── API Layer (Express.js)
├── Orchestration (Node-Cron)
├── External Integrations (GNews, YouTube)
├── Internal Service Communication
└── Job Management & Queue
```

## 🔧 Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Cron Jobs**: Node-Cron
- **Validation**: Zod
- **Authentication**: JWT
- **Logging**: Pino
- **Database**: SQLite (development), PostgreSQL (production)
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js 20 or higher
- npm or yarn
- Environment variables configured (see `.env.example`)

## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access API documentation**
   - Open http://localhost:3001/api-docs

## 🔑 Environment Configuration

### Required Variables
```bash
# API Keys
GNEWS_API_KEY=your-gnews-api-key
JWT_SECRET=your-super-secret-jwt-key

# Service URLs
NLP_SERVICE_URL=http://localhost:8001
TTS_SERVICE_URL=http://localhost:8002
VIDEO_SERVICE_URL=http://localhost:8003
```

### Optional Variables
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_PATH=./data/autonews.db

# Cron Configuration
ENABLE_CRON=true
NEWS_FETCH_CRON=0 */2 * * *
```

## 📊 API Endpoints

### Core Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/health` | Health check | No |
| GET | `/api/v1/metrics` | Application metrics | No |
| POST | `/api/v1/auth/login` | User authentication | No |
| GET | `/api/v1/jobs` | List jobs | Yes |
| POST | `/api/v1/jobs` | Create new job | Yes |
| GET | `/api/v1/jobs/:id` | Get job details | Yes |
| POST | `/api/v1/jobs/:id/publish` | Publish to YouTube | Yes |

### API Documentation
- **Swagger UI**: http://localhost:3001/api-docs
- **OpenAPI Spec**: http://localhost:3001/api-docs.json

## 🔄 Job Workflow

The backend orchestrates a 5-step pipeline for each news generation job:

1. **Fetch News** - Retrieve articles from GNews API
2. **Summarize** - Generate summary via NLP service
3. **Generate Audio** - Create speech via TTS service
4. **Create Video** - Compose video via Video service
5. **Publish** - Upload to YouTube (optional)

### Job States
- `queued` - Job created, waiting for processing
- `running` - Job currently being processed
- `completed` - Job finished successfully
- `failed` - Job encountered an error

## 🔐 Authentication

The API uses JWT-based authentication:

```bash
# Login to get token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/v1/jobs
```

### Default Credentials
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: `admin`

## 📈 Monitoring & Observability

### Health Checks
- **Liveness**: `GET /api/v1/health/live`
- **Readiness**: `GET /api/v1/health/ready`
- **Full Health**: `GET /api/v1/health`

### Metrics
- **JSON Format**: `GET /api/v1/metrics`
- **Prometheus Format**: `GET /api/v1/metrics/prometheus`

### Logging
- Structured JSON logging with Pino
- Request tracing with unique request IDs
- Different log levels for development/production

## ⏰ Cron Jobs

### News Fetching
- **Schedule**: Every 2 hours (configurable)
- **Purpose**: Fetch trending news from GNews API
- **Auto-processing**: Creates jobs for popular articles

### Cleanup
- **Schedule**: Daily at midnight
- **Purpose**: Remove old files, logs, and temporary data
- **Retention**: 30 days (configurable)

### Health Monitoring
- **Schedule**: Every 30 seconds
- **Purpose**: Check external service health
- **Alerts**: Log warnings for service degradation

## 🔌 External Integrations

### GNews API
- Fetch trending news by category/country
- Search news by topic/keyword
- Rate limiting and error handling
- Content deduplication

### YouTube Data API v3
- Upload videos with metadata
- Set privacy settings and thumbnails
- Manage playlists and descriptions
- Handle quota limits gracefully

### Internal Services
- **NLP Service**: Article summarization
- **TTS Service**: Text-to-speech conversion
- **Video Service**: Video composition and rendering

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure
- Unit tests for services and utilities
- Integration tests for API endpoints
- Contract tests for external APIs

## 📝 Development

### Code Style
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Migrations
```bash
# Run migrations
npm run migrate

# Seed test data
npm run seed
```

## 🚀 Deployment

### Railway/Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically on push to main

### Environment Variables for Production
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
GNEWS_API_KEY=your-production-key
JWT_SECRET=secure-production-secret
```

### Health Checks
Configure your deployment platform to use:
- **Health Check URL**: `/api/v1/health`
- **Port**: `process.env.PORT` (auto-detected)

## 🔍 Troubleshooting

### Common Issues

**1. GNews API Errors**
```bash
# Check API key validity
curl "https://gnews.io/api/v4/top-headlines?apikey=YOUR_KEY&max=1"
```

**2. Service Communication Errors**
```bash
# Verify service URLs are accessible
curl http://localhost:8001/health  # NLP Service
curl http://localhost:8002/health  # TTS Service
curl http://localhost:8003/health  # Video Service
```

**3. Database Connection Issues**
```bash
# Check database file permissions
ls -la ./data/autonews.db

# Reset database (development only)
rm ./data/autonews.db && npm run migrate
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Enable specific debug modules
DEBUG=autonews:* npm run dev
```

## 📊 Performance

### Benchmarks
- API latency: < 300ms (P95)
- Job processing: 2-5 minutes per article
- Concurrent jobs: Up to 5 simultaneously
- Memory usage: ~100MB base + 50MB per active job

### Optimization
- Response caching for static data
- Rate limiting to prevent abuse
- Graceful degradation for service outages
- Automatic retry with exponential backoff

## 🤝 Contributing

1. Follow the established code style
2. Add tests for new functionality
3. Update API documentation
4. Ensure all health checks pass

### Code Organization
```
src/
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── routes/          # API route definitions
├── services/        # Business logic
├── utils/           # Helper functions
├── models/          # Data models
├── cron/           # Scheduled jobs
└── database/       # Database setup/migrations
```

---

## 📞 Support

For issues and questions:
- Check the [API documentation](http://localhost:3001/api-docs)
- Review logs in `./logs/app.log`
- Monitor health at `/api/v1/health`