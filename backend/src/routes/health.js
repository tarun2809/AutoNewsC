import express from 'express';
import { logger } from '../utils/logger.js';
import { databaseService } from '../services/databaseService.js';
import { gnewsService } from '../services/gnewsService.js';
import { youtubeService } from '../services/youtubeService.js';
import axios from 'axios';

const router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server and connected services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         latency:
 *                           type: number
 *                     nlp_service:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         latency:
 *                           type: number
 *                     tts_service:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         latency:
 *                           type: number
 *                     video_service:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         latency:
 *                           type: number
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {}
    };

    // Check database health
    try {
      const dbStart = Date.now();
      const stats = await databaseService.getJobStats();
      healthCheck.services.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
        totalJobs: stats.total
      };
    } catch (error) {
      healthCheck.services.database = {
        status: 'unhealthy',
        error: error.message
      };
      healthCheck.status = 'degraded';
    }

    // Check NLP service health
    try {
      const nlpStart = Date.now();
      const response = await axios.get(`${process.env.NLP_SERVICE_URL}/health`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_SECRET}`
        }
      });
      healthCheck.services.nlp_service = {
        status: response.data.status === 'healthy' ? 'healthy' : 'degraded',
        latency: Date.now() - nlpStart,
        model_loaded: response.data.model_loaded
      };
    } catch (error) {
      healthCheck.services.nlp_service = {
        status: 'unhealthy',
        error: error.message
      };
      healthCheck.status = 'degraded';
    }

    // Check TTS service health
    try {
      const ttsStart = Date.now();
      const response = await axios.get(`${process.env.TTS_SERVICE_URL}/health`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_SECRET}`
        }
      });
      healthCheck.services.tts_service = {
        status: response.data.status === 'healthy' ? 'healthy' : 'degraded',
        latency: Date.now() - ttsStart,
        model_loaded: response.data.model_loaded
      };
    } catch (error) {
      healthCheck.services.tts_service = {
        status: 'unhealthy',
        error: error.message
      };
      healthCheck.status = 'degraded';
    }

    // Check Video service health
    try {
      const videoStart = Date.now();
      const response = await axios.get(`${process.env.VIDEO_SERVICE_URL}/health`, {
        timeout: 5000,
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_SECRET}`
        }
      });
      healthCheck.services.video_service = {
        status: response.data.status === 'healthy' ? 'healthy' : 'degraded',
        latency: Date.now() - videoStart,
        ffmpeg_available: response.data.ffmpeg_available
      };
    } catch (error) {
      healthCheck.services.video_service = {
        status: 'unhealthy',
        error: error.message
      };
      healthCheck.status = 'degraded';
    }

    // Check external API health
    try {
      const gnewsValid = await gnewsService.validateApiKey();
      healthCheck.services.gnews_api = {
        status: gnewsValid ? 'healthy' : 'unhealthy',
        configured: Boolean(process.env.GNEWS_API_KEY)
      };
    } catch (error) {
      healthCheck.services.gnews_api = {
        status: 'unhealthy',
        error: error.message
      };
    }

    healthCheck.services.youtube_api = {
      status: youtubeService.isConfigured() ? 'healthy' : 'not_configured',
      configured: youtubeService.isConfigured()
    };

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Readiness check endpoint
 *     description: Returns whether the service is ready to accept traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if all critical services are available
    const checks = [
      // TODO: Add readiness checks for critical dependencies
      // checkDatabaseConnection(),
      // checkRequiredEnvironmentVariables()
    ];

    await Promise.all(checks);
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Liveness check endpoint
 *     description: Returns whether the service is alive
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;