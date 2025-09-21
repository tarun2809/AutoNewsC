import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const logsDir = join(__dirname, '../../logs');
try {
  mkdirSync(logsDir, { recursive: true });
} catch (error) {
  // Directory might already exist
}

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

// Base logger configuration
const baseConfig = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
};

// Development logger with pretty printing
const developmentLogger = pino({
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{requestId} {msg}'
    }
  }
});

// Production logger with file output
const productionLogger = pino({
  ...baseConfig,
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: join(logsDir, 'app.log') }
      },
      {
        target: 'pino-pretty',
        options: {
          colorize: false,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    ]
  }
});

export const logger = isDevelopment ? developmentLogger : productionLogger;

// Helper functions for different log levels
export const logInfo = (message, data = {}) => {
  logger.info(data, message);
};

export const logError = (message, error = null, data = {}) => {
  const errorData = error ? {
    ...data,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  } : data;
  
  logger.error(errorData, message);
};

export const logWarn = (message, data = {}) => {
  logger.warn(data, message);
};

export const logDebug = (message, data = {}) => {
  logger.debug(data, message);
};

// Request logger middleware helper
export const createRequestLogger = (req) => {
  return logger.child({
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
};