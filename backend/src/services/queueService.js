import { logger } from '../utils/logger.js';
import { newsService } from './newsService.js';
import { incrementJobMetric } from '../routes/metrics.js';

// Simple in-memory queue (replace with Redis or proper queue in production)
const newsQueue = [];
const processingJobs = new Set();

export const processNewsQueue = async () => {
  try {
    if (newsQueue.length === 0) {
      logger.debug('News queue is empty');
      return;
    }

    logger.info('Processing news queue', { queueLength: newsQueue.length });

    // Process up to 5 jobs concurrently
    const maxConcurrent = 5;
    const currentProcessing = Array.from(processingJobs).length;
    const availableSlots = maxConcurrent - currentProcessing;

    if (availableSlots <= 0) {
      logger.debug('Maximum concurrent jobs reached, skipping queue processing');
      return;
    }

    const jobsToProcess = newsQueue.splice(0, availableSlots);
    
    const processingPromises = jobsToProcess.map(async (queueItem) => {
      const { type, data } = queueItem;
      
      try {
        processingJobs.add(queueItem.id);
        
        switch (type) {
          case 'fetch_trending':
            await processTrendingNews(data);
            break;
          case 'process_article':
            await processArticle(data);
            break;
          case 'generate_video':
            await generateVideo(data);
            break;
          default:
            logger.warn('Unknown queue item type', { type });
        }
        
        logger.info('Queue item processed successfully', { 
          id: queueItem.id, 
          type: queueItem.type 
        });
        
      } catch (error) {
        logger.error('Error processing queue item', error, {
          id: queueItem.id,
          type: queueItem.type
        });
        
        // Re-queue failed items with retry count
        if ((queueItem.retryCount || 0) < 3) {
          queueItem.retryCount = (queueItem.retryCount || 0) + 1;
          queueItem.lastError = error.message;
          newsQueue.push(queueItem);
          
          logger.info('Re-queued failed item', {
            id: queueItem.id,
            retryCount: queueItem.retryCount
          });
        } else {
          logger.error('Max retries reached for queue item', {
            id: queueItem.id,
            finalError: error.message
          });
          incrementJobMetric('failed');
        }
      } finally {
        processingJobs.delete(queueItem.id);
      }
    });

    await Promise.allSettled(processingPromises);
    
  } catch (error) {
    logger.error('Error in queue processing', error);
  }
};

const processTrendingNews = async (data) => {
  logger.info('Processing trending news fetch', data);
  
  const result = await newsService.fetchTrendingNews(data.params);
  
  // Queue individual articles for processing
  result.articles.forEach(article => {
    queueArticleProcessing(article, data.jobConfig);
  });
  
  logger.info('Trending news processed', {
    articlesFound: result.articles.length
  });
};

const processArticle = async (data) => {
  const { article, jobConfig } = data;
  
  logger.info('Processing article', {
    title: article.title,
    source: article.source?.name
  });

  // TODO: Implement full article processing pipeline
  // 1. Generate summary via NLP service
  // 2. Generate audio via TTS service
  // 3. Create video via video service
  // 4. Optionally publish to YouTube
  
  // For now, just log the processing
  logger.info('Article processing completed', {
    title: article.title
  });
  
  incrementJobMetric('completed');
};

const generateVideo = async (data) => {
  const { jobId, summary, audioUrl } = data;
  
  logger.info('Generating video', { jobId });
  
  // TODO: Call video service to generate video
  // const videoResult = await videoService.createVideo({
  //   summary,
  //   audioUrl,
  //   theme: data.theme || 'modern'
  // });
  
  logger.info('Video generation completed', { jobId });
};

export const queueTrendingNewsFetch = (params = {}, jobConfig = {}) => {
  const queueItem = {
    id: `trending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'fetch_trending',
    data: { params, jobConfig },
    createdAt: new Date().toISOString(),
    retryCount: 0
  };
  
  newsQueue.push(queueItem);
  
  logger.info('Queued trending news fetch', {
    id: queueItem.id,
    queueLength: newsQueue.length
  });
  
  return queueItem.id;
};

export const queueArticleProcessing = (article, jobConfig = {}) => {
  const queueItem = {
    id: `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'process_article',
    data: { article, jobConfig },
    createdAt: new Date().toISOString(),
    retryCount: 0
  };
  
  newsQueue.push(queueItem);
  
  logger.debug('Queued article processing', {
    id: queueItem.id,
    title: article.title
  });
  
  return queueItem.id;
};

export const queueVideoGeneration = (jobId, summary, audioUrl, config = {}) => {
  const queueItem = {
    id: `video_${jobId}_${Date.now()}`,
    type: 'generate_video',
    data: { jobId, summary, audioUrl, ...config },
    createdAt: new Date().toISOString(),
    retryCount: 0
  };
  
  newsQueue.push(queueItem);
  
  logger.info('Queued video generation', {
    id: queueItem.id,
    jobId
  });
  
  return queueItem.id;
};

export const getQueueStatus = () => {
  return {
    queueLength: newsQueue.length,
    processing: Array.from(processingJobs).length,
    items: newsQueue.map(item => ({
      id: item.id,
      type: item.type,
      createdAt: item.createdAt,
      retryCount: item.retryCount,
      lastError: item.lastError
    }))
  };
};

export const clearQueue = () => {
  const clearedCount = newsQueue.length;
  newsQueue.length = 0;
  
  logger.info('Queue cleared', { clearedCount });
  
  return clearedCount;
};