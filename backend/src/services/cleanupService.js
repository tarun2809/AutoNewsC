import { logger } from '../utils/logger.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const RETENTION_DAYS = parseInt(process.env.METRICS_RETENTION_DAYS) || 30;
const CLEANUP_BATCH_SIZE = 100;

export const cleanupOldJobs = async () => {
  try {
    logger.info('Starting cleanup of old jobs and artifacts');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // TODO: In a real implementation, this would clean up from database
    // For now, we'll implement file cleanup and logging

    await cleanupOldFiles();
    await cleanupOldLogs();
    await cleanupTempFiles();

    logger.info('Cleanup completed successfully', {
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString()
    });

  } catch (error) {
    logger.error('Error during cleanup process', error);
    throw error;
  }
};

const cleanupOldFiles = async () => {
  try {
    const uploadsDir = process.env.UPLOAD_DIR || './uploads';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    logger.info('Cleaning up old uploaded files', {
      directory: uploadsDir,
      cutoffDate: cutoffDate.toISOString()
    });

    // Check if uploads directory exists
    try {
      await fs.access(uploadsDir);
    } catch {
      logger.debug('Uploads directory does not exist, skipping file cleanup');
      return;
    }

    const files = await fs.readdir(uploadsDir, { withFileTypes: true });
    let deletedCount = 0;
    let totalSize = 0;

    for (const file of files) {
      if (file.isFile()) {
        const filePath = join(uploadsDir, file.name);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          try {
            totalSize += stats.size;
            await fs.unlink(filePath);
            deletedCount++;
            
            logger.debug('Deleted old file', {
              filename: file.name,
              size: stats.size,
              lastModified: stats.mtime
            });
          } catch (error) {
            logger.warn('Failed to delete file', error, {
              filename: file.name
            });
          }
        }
      }
    }

    logger.info('File cleanup completed', {
      deletedFiles: deletedCount,
      totalSizeDeleted: totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
    });

  } catch (error) {
    logger.error('Error cleaning up old files', error);
  }
};

const cleanupOldLogs = async () => {
  try {
    const logsDir = './logs';
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (RETENTION_DAYS * 2)); // Keep logs longer

    logger.info('Cleaning up old log files', {
      directory: logsDir,
      cutoffDate: cutoffDate.toISOString()
    });

    // Check if logs directory exists
    try {
      await fs.access(logsDir);
    } catch {
      logger.debug('Logs directory does not exist, skipping log cleanup');
      return;
    }

    const files = await fs.readdir(logsDir, { withFileTypes: true });
    let deletedCount = 0;

    for (const file of files) {
      if (file.isFile() && file.name.includes('.log')) {
        const filePath = join(logsDir, file.name);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          try {
            await fs.unlink(filePath);
            deletedCount++;
            
            logger.debug('Deleted old log file', {
              filename: file.name,
              lastModified: stats.mtime
            });
          } catch (error) {
            logger.warn('Failed to delete log file', error, {
              filename: file.name
            });
          }
        }
      }
    }

    logger.info('Log cleanup completed', {
      deletedLogFiles: deletedCount
    });

  } catch (error) {
    logger.error('Error cleaning up old logs', error);
  }
};

const cleanupTempFiles = async () => {
  try {
    const tempDirs = ['./temp', './tmp', '/tmp/autonews'];

    for (const tempDir of tempDirs) {
      try {
        await fs.access(tempDir);
        
        const files = await fs.readdir(tempDir, { withFileTypes: true });
        let deletedCount = 0;

        for (const file of files) {
          const filePath = join(tempDir, file.name);
          
          try {
            if (file.isFile()) {
              await fs.unlink(filePath);
            } else if (file.isDirectory()) {
              await fs.rmdir(filePath, { recursive: true });
            }
            deletedCount++;
          } catch (error) {
            logger.warn('Failed to delete temp file/directory', error, {
              path: filePath
            });
          }
        }

        if (deletedCount > 0) {
          logger.info('Temp files cleaned up', {
            directory: tempDir,
            deletedItems: deletedCount
          });
        }

      } catch {
        // Directory doesn't exist, skip
        continue;
      }
    }

  } catch (error) {
    logger.error('Error cleaning up temp files', error);
  }
};

export const getCleanupStats = async () => {
  try {
    const stats = {
      uploadsDir: await getDirStats(process.env.UPLOAD_DIR || './uploads'),
      logsDir: await getDirStats('./logs'),
      tempDirs: []
    };

    const tempDirs = ['./temp', './tmp'];
    for (const dir of tempDirs) {
      const dirStats = await getDirStats(dir);
      if (dirStats) {
        stats.tempDirs.push({ directory: dir, ...dirStats });
      }
    }

    return stats;

  } catch (error) {
    logger.error('Error getting cleanup stats', error);
    return null;
  }
};

const getDirStats = async (directory) => {
  try {
    await fs.access(directory);
    const files = await fs.readdir(directory, { withFileTypes: true });
    
    let totalFiles = 0;
    let totalSize = 0;
    let oldestFile = null;
    let newestFile = null;

    for (const file of files) {
      if (file.isFile()) {
        totalFiles++;
        const filePath = join(directory, file.name);
        const stats = await fs.stat(filePath);
        
        totalSize += stats.size;
        
        if (!oldestFile || stats.mtime < oldestFile) {
          oldestFile = stats.mtime;
        }
        
        if (!newestFile || stats.mtime > newestFile) {
          newestFile = stats.mtime;
        }
      }
    }

    return {
      totalFiles,
      totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      oldestFile,
      newestFile
    };

  } catch {
    return null;
  }
};