import axios from 'axios';
import { logger } from '../utils/logger.js';
import { databaseService } from './databaseService.js';

class GNewsService {
  constructor() {
    this.apiKey = process.env.GNEWS_API_KEY;
    this.baseUrl = 'https://gnews.io/api/v4';
    this.defaultParams = {
      lang: 'en',
      country: 'us',
      max: 10
    };
  }

  async fetchTopHeadlines(params = {}) {
    if (!this.apiKey) {
      throw new Error('GNews API key not configured');
    }

    const startTime = Date.now();
    const requestParams = {
      ...this.defaultParams,
      ...params,
      apikey: this.apiKey
    };

    try {
      logger.info('Fetching top headlines from GNews', { params: requestParams });

      const response = await axios.get(`${this.baseUrl}/top-headlines`, {
        params: requestParams,
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;
      
      // Record API usage
      await databaseService.recordApiUsage(
        'gnews',
        '/top-headlines',
        'GET',
        response.status,
        responseTime
      );

      const articles = response.data.articles || [];
      
      logger.info('Successfully fetched articles from GNews', {
        count: articles.length,
        totalResults: response.data.totalArticles,
        responseTime
      });

      return {
        articles: articles.map(this.normalizeArticle),
        totalResults: response.data.totalArticles,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record API error
      await databaseService.recordApiUsage(
        'gnews',
        '/top-headlines',
        'GET',
        error.response?.status || 0,
        responseTime,
        error.message
      );

      logger.error('Failed to fetch articles from GNews', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      throw error;
    }
  }

  async searchArticles(query, params = {}) {
    if (!this.apiKey) {
      throw new Error('GNews API key not configured');
    }

    const startTime = Date.now();
    const requestParams = {
      q: query,
      lang: params.lang || this.defaultParams.lang,
      country: params.country || this.defaultParams.country,
      max: params.max || this.defaultParams.max,
      sortby: params.sortby || 'relevance',
      from: params.from,
      to: params.to,
      apikey: this.apiKey
    };

    // Remove undefined values
    Object.keys(requestParams).forEach(key => {
      if (requestParams[key] === undefined) {
        delete requestParams[key];
      }
    });

    try {
      logger.info('Searching articles from GNews', { query, params: requestParams });

      const response = await axios.get(`${this.baseUrl}/search`, {
        params: requestParams,
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;
      
      // Record API usage
      await databaseService.recordApiUsage(
        'gnews',
        '/search',
        'GET',
        response.status,
        responseTime
      );

      const articles = response.data.articles || [];
      
      logger.info('Successfully searched articles from GNews', {
        query,
        count: articles.length,
        totalResults: response.data.totalArticles,
        responseTime
      });

      return {
        articles: articles.map(this.normalizeArticle),
        totalResults: response.data.totalArticles,
        query,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record API error
      await databaseService.recordApiUsage(
        'gnews',
        '/search',
        'GET',
        error.response?.status || 0,
        responseTime,
        error.message
      );

      logger.error('Failed to search articles from GNews', {
        query,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      throw error;
    }
  }

  normalizeArticle(article) {
    // Generate content hash for deduplication
    const contentHash = this.generateContentHash(article.title + (article.description || ''));
    
    return {
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      image_url: article.image,
      published_at: article.publishedAt,
      source_name: article.source?.name,
      source_url: article.source?.url,
      content_hash: contentHash,
      language: 'en' // GNews doesn't provide language in response
    };
  }

  generateContentHash(content) {
    // Simple hash function for content deduplication
    let hash = 0;
    if (content.length === 0) return hash.toString();
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString();
  }

  async validateApiKey() {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/top-headlines`, {
        params: {
          apikey: this.apiKey,
          max: 1
        },
        timeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      logger.error('GNews API key validation failed', { error: error.message });
      return false;
    }
  }

  async fetchArticlesForJob(jobData) {
    try {
      let articles;
      
      if (jobData.keywords && jobData.keywords.length > 0) {
        // Search for articles using keywords
        const query = jobData.keywords.join(' OR ');
        const result = await this.searchArticles(query, {
          max: 5,
          sortby: 'relevance'
        });
        articles = result.articles;
      } else {
        // Fetch top headlines for the topic
        const result = await this.fetchTopHeadlines({
          category: jobData.topic.toLowerCase(),
          max: 5
        });
        articles = result.articles;
      }

      // Store articles in database
      const savedArticles = [];
      for (const article of articles) {
        try {
          const savedArticle = await databaseService.createArticle({
            ...article,
            job_id: jobData.id
          });
          
          if (savedArticle) {
            savedArticles.push(savedArticle);
          }
        } catch (error) {
          logger.warning('Failed to save article', { 
            title: article.title, 
            error: error.message 
          });
        }
      }

      logger.info('Articles fetched and stored for job', {
        jobId: jobData.id,
        totalFetched: articles.length,
        totalSaved: savedArticles.length
      });

      return savedArticles;

    } catch (error) {
      logger.error('Failed to fetch articles for job', {
        jobId: jobData.id,
        error: error.message
      });
      throw error;
    }
  }
}

export const gnewsService = new GNewsService();