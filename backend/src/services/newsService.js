import axios from 'axios';
import { logger } from '../utils/logger.js';
import { incrementExternalApiMetric } from '../routes/metrics.js';

const GNEWS_BASE_URL = 'https://gnews.io/api/v4';

class NewsService {
  constructor() {
    this.apiKey = process.env.GNEWS_API_KEY;
    this.defaultParams = {
      category: process.env.DEFAULT_NEWS_CATEGORY || 'general',
      lang: process.env.DEFAULT_NEWS_LANGUAGE || 'en',
      country: process.env.DEFAULT_NEWS_COUNTRY || 'us',
      max: parseInt(process.env.MAX_ARTICLES_PER_FETCH) || 10
    };
  }

  async fetchTrendingNews(params = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('GNews API key not configured');
      }

      const requestParams = {
        ...this.defaultParams,
        ...params,
        apikey: this.apiKey
      };

      logger.info('Fetching trending news from GNews', { params: requestParams });

      const response = await axios.get(`${GNEWS_BASE_URL}/top-headlines`, {
        params: requestParams,
        timeout: 10000
      });

      const articles = response.data.articles || [];
      
      logger.info('Successfully fetched news articles', {
        count: articles.length,
        totalResults: response.data.totalArticles
      });

      incrementExternalApiMetric('gnews', true);
      
      return {
        articles: articles.map(this.normalizeArticle),
        totalResults: response.data.totalArticles,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error fetching news from GNews', error, {
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      incrementExternalApiMetric('gnews', false, error);
      throw error;
    }
  }

  async searchNews(query, params = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('GNews API key not configured');
      }

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

      logger.info('Searching news from GNews', { query, params: requestParams });

      const response = await axios.get(`${GNEWS_BASE_URL}/search`, {
        params: requestParams,
        timeout: 10000
      });

      const articles = response.data.articles || [];
      
      logger.info('Successfully searched news articles', {
        query,
        count: articles.length,
        totalResults: response.data.totalArticles
      });

      incrementExternalApiMetric('gnews', true);
      
      return {
        articles: articles.map(this.normalizeArticle),
        totalResults: response.data.totalArticles,
        query,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error searching news from GNews', error, {
        query,
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      incrementExternalApiMetric('gnews', false, error);
      throw error;
    }
  }

  normalizeArticle(article) {
    return {
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      image: article.image,
      publishedAt: article.publishedAt,
      source: {
        name: article.source?.name,
        url: article.source?.url
      },
      // Generate a content hash for deduplication
      contentHash: this.generateContentHash(article.title + article.description)
    };
  }

  generateContentHash(content) {
    // Simple hash function for content deduplication
    let hash = 0;
    if (content.length === 0) return hash;
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  async getTopicNews(topic, params = {}) {
    try {
      // Use search API for topic-specific news
      return await this.searchNews(topic, {
        ...params,
        sortby: 'relevance'
      });
    } catch (error) {
      logger.error('Error fetching topic news', error, { topic });
      throw error;
    }
  }

  async validateApiKey() {
    try {
      const response = await axios.get(`${GNEWS_BASE_URL}/top-headlines`, {
        params: {
          apikey: this.apiKey,
          max: 1
        },
        timeout: 5000
      });

      return response.status === 200;
    } catch (error) {
      logger.error('GNews API key validation failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const newsService = new NewsService();

// Export the main functions for use in cron jobs
export const fetchTrendingNews = async (params) => {
  return await newsService.fetchTrendingNews(params);
};

export const searchNews = async (query, params) => {
  return await newsService.searchNews(query, params);
};

export const getTopicNews = async (topic, params) => {
  return await newsService.getTopicNews(topic, params);
};