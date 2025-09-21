import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { validateAuth } from './middleware/auth.js';
import { initializeDatabase } from './database/migrate.js';
import { databaseService } from './services/databaseService.js';

// Import routes
import jobsRouter from './routes/jobs.js';
import healthRouter from './routes/health.js';
import metricsRouter from './routes/metrics.js';
import authRouter from './routes/auth.js';

// Import cron jobs
import { initializeCronJobs } from './cron/index.js';

// Load environment variables
dotenv.config();

// Initialize database
try {
  initializeDatabase();
  databaseService.initialize();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize database', error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AutoNews API',
      version: '1.0.0',
      description: 'Backend API for AutoNews - AI-powered news generation system',
      contact: {
        name: 'AutoNews Team',
        email: 'support@autonews.com'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(limiter);
app.use(requestId);
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/metrics', metricsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/jobs', validateAuth, jobsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AutoNews API Server',
    version: '1.0.0',
    docs: '/api-docs',
    health: '/api/v1/health'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 AutoNews API Server running on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
  
  // Initialize cron jobs after server starts
  if (process.env.NODE_ENV !== 'test') {
    initializeCronJobs();
    logger.info('📅 Cron jobs initialized');
  }
});

export default app;