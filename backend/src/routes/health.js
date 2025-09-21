import express from 'express';
import { logger } from '../utils/logger.js';

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
      // TODO: Add actual database health check
      // await db.raw('SELECT 1');
      healthCheck.services.database = {
        status: 'healthy',
        latency: Date.now() - dbStart
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
      // TODO: Add actual NLP service health check
      // const response = await axios.get(`${process.env.NLP_SERVICE_URL}/health`);
      healthCheck.services.nlp_service = {
        status: 'healthy',
        latency: Date.now() - nlpStart
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
      // TODO: Add actual TTS service health check
      // const response = await axios.get(`${process.env.TTS_SERVICE_URL}/health`);
      healthCheck.services.tts_service = {
        status: 'healthy',
        latency: Date.now() - ttsStart
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
      // TODO: Add actual Video service health check
      // const response = await axios.get(`${process.env.VIDEO_SERVICE_URL}/health`);
      healthCheck.services.video_service = {
        status: 'healthy',
        latency: Date.now() - videoStart
      };
    } catch (error) {
      healthCheck.services.video_service = {
        status: 'unhealthy',
        error: error.message
      };
      healthCheck.status = 'degraded';
    }

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