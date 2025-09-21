# AutoNews - AI-Powered News Generation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org/)
[![React](https://img.shields.io/badge/React-19.x-blue.svg)](https://reactjs.org/)

AutoNews is a fully autonomous, AI-powered news generation and publishing system that automatically creates professional video content from trending news articles. The platform leverages cutting-edge AI technologies to fetch, summarize, narrate, and produce engaging news videos for YouTube and other platforms.

## 🎯 Project Overview

AutoNews integrates machine learning, deep learning, natural language processing (NLP), and full-stack web development to automatically gather, summarize, vocalize, and publish the latest news in video format - ready for public consumption through platforms like YouTube.

## 🏗️ Architecture

The system consists of four main components:

### 1. Backend & Orchestration (`/backend`)
- **Tech Stack**: Node.js 20, Express.js, Node-Cron
- **Hosting**: Railway/Render
- **Responsibilities**: REST API, pipeline orchestration, external integrations (GNews, YouTube)

### 2. NLP & Audio (`/nlp-audio`) 
- **Tech Stack**: Python FastAPI, Hugging Face Transformers, Coqui TTS
- **Hosting**: Hugging Face Spaces (summarizer), Small VM/Render (TTS)
- **Responsibilities**: News summarization, text-to-speech conversion

### 3. Video/Media Pipeline (`/video-pipeline`)
- **Tech Stack**: Python, MoviePy, FFmpeg
- **Responsibilities**: Video composition, subtitles, thumbnail generation

### 4. Frontend & UX (`/frontend`)
- **Tech Stack**: React 18, Tailwind CSS, ShadCN UI, Framer Motion
- **Hosting**: Vercel
- **Responsibilities**: Dashboard UI, job management, media preview

## 🚀 Features

- **Autonomous News Gathering**: Periodic fetching from GNews API
- **AI Summarization**: Transformer-based models (Flan-T5, DistilBART)
- **Natural TTS**: Coqui TTS for human-like speech
- **Video Generation**: Automated video composition with branding
- **YouTube Publishing**: Direct upload to YouTube via API
- **Real-time Dashboard**: Modern React interface for monitoring
- **CI/CD Pipeline**: GitHub Actions for automated deployment

## 📋 Prerequisites

- Node.js 20+
- Python 3.11+
- FFmpeg
- Git

## 🛠️ Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AutoNewsC
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure environment variables
   npm run dev
   ```

3. **Setup NLP & Audio Services**
   ```bash
   cd nlp-audio
   pip install -r requirements.txt
   cp .env.example .env
   # Configure environment variables
   python main.py
   ```

4. **Setup Video Pipeline**
   ```bash
   cd video-pipeline
   pip install -r requirements.txt
   cp .env.example .env
   # Configure environment variables
   python main.py
   ```

5. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Configure environment variables
   npm run dev
   ```

## 📁 Project Structure

```
AutoNewsC/
├── backend/              # Node.js Express API & Orchestration
├── nlp-audio/           # Python NLP Summarization & TTS
├── video-pipeline/      # Python Video Generation & Rendering
├── frontend/           # React Dashboard & UI
├── .github/workflows/  # CI/CD GitHub Actions
├── docs/              # Documentation & API specs
└── README.md
```

## 🔧 Configuration

Each service has its own environment configuration:

- **Backend**: Database, API keys (GNews, YouTube), JWT secrets
- **NLP & Audio**: Hugging Face tokens, TTS model configs
- **Video Pipeline**: FFmpeg paths, template settings
- **Frontend**: API endpoints, authentication

## 🚀 Deployment

- **Backend**: Railway/Render
- **NLP Services**: Hugging Face Spaces + Small VM
- **Frontend**: Vercel
- **CI/CD**: GitHub Actions

## 📊 Monitoring & Observability

- Health checks for all services
- Prometheus-style metrics
- Structured logging with request tracing
- Job status tracking and retry mechanisms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`feat/feature-name`)
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Backend & Orchestration Engineer**: API, cron, integrations, deployments
- **NLP & Audio Engineer**: Summarization, TTS, text processing  
- **Video/Media Pipeline Engineer**: Video rendering, templates, thumbnails
- **Frontend & UX Engineer**: React dashboard, user experience

## 🎯 Roadmap

- [ ] MVP Release
- [ ] Multi-language support (Hindi, Telugu)
- [ ] A/B template testing
- [ ] Vertical/Shorts auto-generation
- [ ] Editorial rules engine
- [ ] Advanced analytics dashboard

---

Built with ❤️ for VIT Capstone Project