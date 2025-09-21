import { getDatabase } from '../database/migrate.js';
import { logger } from '../utils/logger.js';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  initialize() {
    if (!this.db) {
      this.db = getDatabase();
      this.db.pragma('foreign_keys = ON');
    }
    return this.db;
  }

  // User operations
  async createUser(userData) {
    const db = this.initialize();
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    
    try {
      const result = stmt.run(userData.username, userData.email, userData.password_hash, userData.role);
      return { id: result.lastInsertRowid, ...userData };
    } catch (error) {
      logger.error('Failed to create user', error);
      throw error;
    }
  }

  async getUserByUsername(username) {
    const db = this.initialize();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1');
    return stmt.get(username);
  }

  async getUserById(id) {
    const db = this.initialize();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1');
    return stmt.get(id);
  }

  async updateUserLastLogin(id) {
    const db = this.initialize();
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  }

  // Job operations
  async createJob(jobData) {
    const db = this.initialize();
    const stmt = db.prepare(`
      INSERT INTO jobs (
        id, title, topic, keywords, language, length, voice_id, video_theme,
        publish_to_youtube, scheduled_at, status, steps, artifacts, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        jobData.id,
        jobData.title,
        jobData.topic,
        JSON.stringify(jobData.keywords || []),
        jobData.language || 'en',
        jobData.length || 120,
        jobData.voice_id || 'default',
        jobData.video_theme || 'modern',
        jobData.publish_to_youtube ? 1 : 0,
        jobData.scheduled_at,
        jobData.status || 'queued',
        JSON.stringify(jobData.steps || []),
        JSON.stringify(jobData.artifacts || {}),
        jobData.created_by
      );
      
      return this.getJobById(jobData.id);
    } catch (error) {
      logger.error('Failed to create job', error);
      throw error;
    }
  }

  async getJobById(id) {
    const db = this.initialize();
    const stmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
    const job = stmt.get(id);
    
    if (job) {
      // Parse JSON fields
      job.keywords = JSON.parse(job.keywords || '[]');
      job.steps = JSON.parse(job.steps || '[]');
      job.artifacts = JSON.parse(job.artifacts || '{}');
      job.publish_to_youtube = Boolean(job.publish_to_youtube);
    }
    
    return job;
  }

  async getJobs(filters = {}) {
    const db = this.initialize();
    let query = 'SELECT * FROM jobs';
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.created_by) {
      conditions.push('created_by = ?');
      params.push(filters.created_by);
    }

    if (filters.topic) {
      conditions.push('topic LIKE ?');
      params.push(`%${filters.topic}%`);
    }

    if (filters.date_from) {
      conditions.push('created_at >= ?');
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push('created_at <= ?');
      params.push(filters.date_to);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = db.prepare(query);
    const jobs = stmt.all(...params);

    // Parse JSON fields for each job
    return jobs.map(job => ({
      ...job,
      keywords: JSON.parse(job.keywords || '[]'),
      steps: JSON.parse(job.steps || '[]'),
      artifacts: JSON.parse(job.artifacts || '{}'),
      publish_to_youtube: Boolean(job.publish_to_youtube)
    }));
  }

  async updateJob(id, updates) {
    const db = this.initialize();
    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'keywords' || key === 'steps' || key === 'artifacts') {
        fields.push(`${key} = ?`);
        params.push(JSON.stringify(value));
      } else if (key === 'publish_to_youtube') {
        fields.push(`${key} = ?`);
        params.push(value ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) {
      return this.getJobById(id);
    }

    params.push(id);
    const query = `UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(query);
    
    try {
      stmt.run(...params);
      return this.getJobById(id);
    } catch (error) {
      logger.error('Failed to update job', error);
      throw error;
    }
  }

  async deleteJob(id) {
    const db = this.initialize();
    const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Article operations
  async createArticle(articleData) {
    const db = this.initialize();
    const stmt = db.prepare(`
      INSERT INTO articles (
        job_id, title, description, content, url, image_url,
        published_at, source_name, source_url, content_hash, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      const result = stmt.run(
        articleData.job_id,
        articleData.title,
        articleData.description,
        articleData.content,
        articleData.url,
        articleData.image_url,
        articleData.published_at,
        articleData.source_name,
        articleData.source_url,
        articleData.content_hash,
        articleData.language || 'en'
      );
      
      return { id: result.lastInsertRowid, ...articleData };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        logger.info('Duplicate article detected, skipping', { content_hash: articleData.content_hash });
        return null; // Article already exists
      }
      logger.error('Failed to create article', error);
      throw error;
    }
  }

  async getArticlesByJobId(jobId) {
    const db = this.initialize();
    const stmt = db.prepare('SELECT * FROM articles WHERE job_id = ? ORDER BY created_at');
    return stmt.all(jobId);
  }

  // Metrics operations
  async recordJobMetric(jobId, metricName, metricValue, metricUnit = null) {
    const db = this.initialize();
    const stmt = db.prepare(`
      INSERT INTO job_metrics (job_id, metric_name, metric_value, metric_unit)
      VALUES (?, ?, ?, ?)
    `);
    
    try {
      stmt.run(jobId, metricName, metricValue, metricUnit);
    } catch (error) {
      logger.error('Failed to record job metric', error);
    }
  }

  async recordApiUsage(serviceName, endpoint, method, statusCode, responseTime, errorMessage = null) {
    const db = this.initialize();
    const stmt = db.prepare(`
      INSERT INTO api_usage (service_name, endpoint, method, status_code, response_time, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(serviceName, endpoint, method, statusCode, responseTime, errorMessage);
    } catch (error) {
      logger.error('Failed to record API usage', error);
    }
  }

  // Settings operations
  async getSetting(key) {
    const db = this.initialize();
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }

  async setSetting(key, value, description = null) {
    const db = this.initialize();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, description)
      VALUES (?, ?, ?)
    `);
    
    try {
      stmt.run(key, value, description);
    } catch (error) {
      logger.error('Failed to set setting', error);
      throw error;
    }
  }

  // Analytics and reporting
  async getJobStats() {
    const db = this.initialize();
    const stmt = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(processing_time) as avg_processing_time
      FROM jobs 
      GROUP BY status
    `);
    
    const results = stmt.all();
    const stats = {
      total: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      avg_processing_time: 0
    };

    results.forEach(row => {
      stats.total += row.count;
      stats[row.status] = row.count;
      if (row.status === 'completed' && row.avg_processing_time) {
        stats.avg_processing_time = row.avg_processing_time;
      }
    });

    return stats;
  }

  async getApiUsageStats(hours = 24) {
    const db = this.initialize();
    const stmt = db.prepare(`
      SELECT 
        service_name,
        COUNT(*) as total_requests,
        AVG(response_time) as avg_response_time,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
      FROM api_usage 
      WHERE created_at >= datetime('now', '-${hours} hours')
      GROUP BY service_name
    `);
    
    return stmt.all();
  }

  // Cleanup operations
  async cleanupOldJobs(retentionDays = 30) {
    const db = this.initialize();
    const stmt = db.prepare(`
      DELETE FROM jobs 
      WHERE status IN ('completed', 'failed') 
      AND created_at < datetime('now', '-${retentionDays} days')
    `);
    
    const result = stmt.run();
    logger.info('Cleaned up old jobs', { deleted: result.changes });
    return result.changes;
  }

  async cleanupOldApiUsage(retentionDays = 7) {
    const db = this.initialize();
    const stmt = db.prepare(`
      DELETE FROM api_usage 
      WHERE created_at < datetime('now', '-${retentionDays} days')
    `);
    
    const result = stmt.run();
    logger.info('Cleaned up old API usage records', { deleted: result.changes });
    return result.changes;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const databaseService = new DatabaseService();