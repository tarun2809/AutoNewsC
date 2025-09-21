import { logger } from '../utils/logger.js';

export const errorHandler = (error, req, res, next) => {
  // Log the error
  logger.error('Error occurred', error, {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = {};

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = error.details || {};
  } else if (error.name === 'UnauthorizedError' || error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  } else if (error.name === 'TooManyRequestsError') {
    statusCode = 429;
    message = 'Too Many Requests';
  } else if (error.statusCode || error.status) {
    statusCode = error.statusCode || error.status;
    message = error.message || message;
  }

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development') {
    details.stack = error.stack;
  }

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      requestId: req.id,
      timestamp: new Date().toISOString(),
      ...details
    }
  });
};

// Custom error classes
export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends Error {
  constructor(message = 'Too Many Requests') {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}