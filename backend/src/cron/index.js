import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { fetchTrendingNews } from '../services/newsService.js';
import { processNewsQueue } from '../services/queueService.js';
import { cleanupOldJobs } from '../services/cleanupService.js';

export const initializeCronJobs = () => {
  if (process.env.ENABLE_CRON !== 'true') {
    logger.info('Cron jobs disabled by configuration');
    return;
  }

  // Fetch trending news every 2 hours
  const newsFetchCron = process.env.NEWS_FETCH_CRON || '0 */2 * * *';
  cron.schedule(newsFetchCron, async () => {
    try {
      logger.info('Starting scheduled news fetch');
      await fetchTrendingNews();
      logger.info('Scheduled news fetch completed');
    } catch (error) {
      logger.error('Error in scheduled news fetch', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Process news queue every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.debug('Processing news queue');
      await processNewsQueue();
    } catch (error) {
      logger.error('Error processing news queue', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Clean up old jobs daily at midnight
  const cleanupCron = process.env.CLEANUP_CRON || '0 0 * * *';
  cron.schedule(cleanupCron, async () => {
    try {
      logger.info('Starting scheduled cleanup');
      await cleanupOldJobs();
      logger.info('Scheduled cleanup completed');
    } catch (error) {
      logger.error('Error in scheduled cleanup', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  // Health check for external services every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      logger.debug('Running health checks');
      // TODO: Implement health checks for external services
      // await healthCheckServices();
    } catch (error) {
      logger.error('Error in health checks', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('Cron jobs initialized', {
    newsFetchCron,
    cleanupCron,
    timezone: 'UTC'
  });
};