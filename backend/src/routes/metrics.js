import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Simple in-memory metrics store (in production, use Redis or a proper metrics store)
const metrics = {
  requests: {
    total: 0,
    success: 0,
    errors: 0,
    byEndpoint: {}
  },
  jobs: {
    created: 0,
    completed: 0,
    failed: 0,
    inProgress: 0
  },
  external_apis: {
    gnews: {
      requests: 0,
      errors: 0,
      lastError: null
    },
    youtube: {
      uploads: 0,
      errors: 0,
      lastError: null
    }
  },
  services: {
    nlp: {
      requests: 0,
      errors: 0,
      avgLatency: 0
    },
    tts: {
      requests: 0,
      errors: 0,
      avgLatency: 0
    },
    video: {
      requests: 0,
      errors: 0,
      avgLatency: 0
    }
  },
  system: {
    startTime: Date.now(),
    lastUpdate: Date.now()
  }
};

/**
 * @swagger
 * /api/v1/metrics:
 *   get:
 *     summary: Get application metrics
 *     description: Returns Prometheus-style metrics for monitoring
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Metrics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/', (req, res) => {
  try {
    const currentTime = Date.now();
    const uptime = Math.floor((currentTime - metrics.system.startTime) / 1000);
    
    const response = {
      ...metrics,
      system: {
        ...metrics.system,
        uptime,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        lastUpdate: currentTime
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching metrics', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * @swagger
 * /api/v1/metrics/prometheus:
 *   get:
 *     summary: Get metrics in Prometheus format
 *     description: Returns metrics in Prometheus exposition format
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Prometheus metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/prometheus', (req, res) => {
  try {
    const currentTime = Date.now();
    const uptime = Math.floor((currentTime - metrics.system.startTime) / 1000);
    
    let prometheusMetrics = '';
    
    // HTTP metrics
    prometheusMetrics += `# HELP http_requests_total Total number of HTTP requests\n`;
    prometheusMetrics += `# TYPE http_requests_total counter\n`;
    prometheusMetrics += `http_requests_total ${metrics.requests.total}\n\n`;
    
    prometheusMetrics += `# HELP http_requests_success_total Total number of successful HTTP requests\n`;
    prometheusMetrics += `# TYPE http_requests_success_total counter\n`;
    prometheusMetrics += `http_requests_success_total ${metrics.requests.success}\n\n`;
    
    prometheusMetrics += `# HELP http_requests_error_total Total number of HTTP request errors\n`;
    prometheusMetrics += `# TYPE http_requests_error_total counter\n`;
    prometheusMetrics += `http_requests_error_total ${metrics.requests.errors}\n\n`;
    
    // Job metrics
    prometheusMetrics += `# HELP jobs_created_total Total number of jobs created\n`;
    prometheusMetrics += `# TYPE jobs_created_total counter\n`;
    prometheusMetrics += `jobs_created_total ${metrics.jobs.created}\n\n`;
    
    prometheusMetrics += `# HELP jobs_completed_total Total number of jobs completed\n`;
    prometheusMetrics += `# TYPE jobs_completed_total counter\n`;
    prometheusMetrics += `jobs_completed_total ${metrics.jobs.completed}\n\n`;
    
    prometheusMetrics += `# HELP jobs_failed_total Total number of jobs failed\n`;
    prometheusMetrics += `# TYPE jobs_failed_total counter\n`;
    prometheusMetrics += `jobs_failed_total ${metrics.jobs.failed}\n\n`;
    
    prometheusMetrics += `# HELP jobs_in_progress Current number of jobs in progress\n`;
    prometheusMetrics += `# TYPE jobs_in_progress gauge\n`;
    prometheusMetrics += `jobs_in_progress ${metrics.jobs.inProgress}\n\n`;
    
    // System metrics
    prometheusMetrics += `# HELP process_uptime_seconds Process uptime in seconds\n`;
    prometheusMetrics += `# TYPE process_uptime_seconds counter\n`;
    prometheusMetrics += `process_uptime_seconds ${uptime}\n\n`;
    
    const memUsage = process.memoryUsage();
    prometheusMetrics += `# HELP process_memory_usage_bytes Process memory usage in bytes\n`;
    prometheusMetrics += `# TYPE process_memory_usage_bytes gauge\n`;
    prometheusMetrics += `process_memory_usage_bytes{type="rss"} ${memUsage.rss}\n`;
    prometheusMetrics += `process_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}\n`;
    prometheusMetrics += `process_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}\n`;
    prometheusMetrics += `process_memory_usage_bytes{type="external"} ${memUsage.external}\n\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error('Error generating Prometheus metrics', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

// Utility functions to update metrics (exported for use in other modules)
export const incrementRequestMetric = (endpoint, success = true) => {
  metrics.requests.total++;
  if (success) {
    metrics.requests.success++;
  } else {
    metrics.requests.errors++;
  }
  
  if (!metrics.requests.byEndpoint[endpoint]) {
    metrics.requests.byEndpoint[endpoint] = { total: 0, success: 0, errors: 0 };
  }
  
  metrics.requests.byEndpoint[endpoint].total++;
  if (success) {
    metrics.requests.byEndpoint[endpoint].success++;
  } else {
    metrics.requests.byEndpoint[endpoint].errors++;
  }
  
  metrics.system.lastUpdate = Date.now();
};

export const incrementJobMetric = (type) => {
  if (metrics.jobs[type] !== undefined) {
    metrics.jobs[type]++;
    metrics.system.lastUpdate = Date.now();
  }
};

export const updateJobInProgress = (count) => {
  metrics.jobs.inProgress = count;
  metrics.system.lastUpdate = Date.now();
};

export const incrementExternalApiMetric = (service, success = true, error = null) => {
  if (metrics.external_apis[service]) {
    metrics.external_apis[service].requests++;
    if (!success) {
      metrics.external_apis[service].errors++;
      if (error) {
        metrics.external_apis[service].lastError = {
          message: error.message,
          timestamp: Date.now()
        };
      }
    }
    metrics.system.lastUpdate = Date.now();
  }
};

export const updateServiceMetric = (service, latency, success = true) => {
  if (metrics.services[service]) {
    metrics.services[service].requests++;
    if (!success) {
      metrics.services[service].errors++;
    }
    
    // Update average latency
    const current = metrics.services[service];
    current.avgLatency = ((current.avgLatency * (current.requests - 1)) + latency) / current.requests;
    
    metrics.system.lastUpdate = Date.now();
  }
};

export default router;