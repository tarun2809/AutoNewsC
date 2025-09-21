import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || './data/autonews.db';

export const initializeDatabase = () => {
  try {
    logger.info('Initializing database', { path: DB_PATH });
    
    // Create database connection
    const db = new Database(DB_PATH);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Read and execute schema
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schemaSQL);
    
    logger.info('Database schema created successfully');
    
    return db;
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw error;
  }
};

export const getDatabase = () => {
  return new Database(DB_PATH);
};

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    initializeDatabase();
    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', error);
    process.exit(1);
  }
}