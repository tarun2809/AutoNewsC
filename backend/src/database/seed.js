import bcrypt from 'bcryptjs';
import { getDatabase } from './migrate.js';
import { logger } from '../utils/logger.js';

export const seedDatabase = async () => {
  const db = getDatabase();
  
  try {
    logger.info('Seeding database with initial data');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    
    insertUser.run('admin', 'admin@autonews.com', adminPassword, 'admin');
    
    // Create operator user
    const operatorPassword = await bcrypt.hash('operator123', 10);
    insertUser.run('operator', 'operator@autonews.com', operatorPassword, 'operator');
    
    // Insert default settings
    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, description)
      VALUES (?, ?, ?)
    `);
    
    const defaultSettings = [
      ['default_video_length', '180', 'Default video duration in seconds'],
      ['default_voice_id', 'default', 'Default TTS voice identifier'],
      ['default_video_theme', 'modern', 'Default video theme'],
      ['max_concurrent_jobs', '5', 'Maximum concurrent job processing'],
      ['cleanup_retention_days', '30', 'Days to retain completed jobs'],
      ['enable_auto_publish', 'false', 'Auto-publish videos to YouTube'],
      ['gnews_fetch_interval', '7200', 'GNews fetch interval in seconds (2 hours)'],
      ['max_articles_per_job', '5', 'Maximum articles to process per job']
    ];
    
    for (const [key, value, description] of defaultSettings) {
      insertSetting.run(key, value, description);
    }
    
    logger.info('Database seeded successfully');
    
  } catch (error) {
    logger.error('Failed to seed database', error);
    throw error;
  } finally {
    db.close();
  }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await seedDatabase();
    logger.info('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed', error);
    process.exit(1);
  }
}