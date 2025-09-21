import jwt from 'jsonwebtoken';
import { UnauthorizedError } from './errorHandler.js';

export const validateAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    next();
  }
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    if (req.user.role !== role && req.user.role !== 'admin') {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};

export const requireAnyRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};

// Internal service authentication
export const validateInternalService = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Internal service authentication required');
    }

    const token = authHeader.substring(7);
    
    if (token !== expectedSecret) {
      throw new UnauthorizedError('Invalid internal service token');
    }
    
    req.isInternalService = true;
    next();
  } catch (error) {
    next(error);
  }
};