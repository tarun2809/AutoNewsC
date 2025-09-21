import express from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { incrementJobMetric } from './metrics.js';
import { databaseService } from '../services/databaseService.js';
import { gnewsService } from '../services/gnewsService.js';
import { youtubeService } from '../services/youtubeService.js';

const router = express.Router();

// Validation schemas
const createJobSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(100, 'Topic too long'),
  language: z.string().length(2, 'Language must be 2 characters').optional().default('en'),
  length: z.number().min(30).max(300).optional().default(120),
  publish: z.boolean().optional().default(false),
  category: z.string().optional().default('general'),
  country: z.string().length(2).optional().default('us'),
  voice_id: z.string().optional().default('default'),
  video_theme: z.string().optional().default('modern')
});

const jobFiltersSchema = z.object({
  status: z.enum(['queued', 'running', 'completed', 'failed']).optional(),
  topic: z.string().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20)
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Job:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         topic:
 *           type: string
 *         language:
 *           type: string
 *         length:
 *           type: number
 *         publish:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [queued, running, completed, failed]
 *         steps:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *               error:
 *                 type: string
 *         artifacts:
 *           type: object
 *           properties:
 *             summary:
 *               type: object
 *             audio:
 *               type: object
 *             video:
 *               type: object
 *         error:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateJobRequest:
 *       type: object
 *       required:
 *         - topic
 *       properties:
 *         topic:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         language:
 *           type: string
 *           length: 2
 *           default: en
 *         length:
 *           type: number
 *           minimum: 30
 *           maximum: 300
 *           default: 120
 *         publish:
 *           type: boolean
 *           default: false
 *         category:
 *           type: string
 *           default: general
 *         country:
 *           type: string
 *           length: 2
 *           default: us
 *         voice_id:
 *           type: string
 *           default: default
 *         video_theme:
 *           type: string
 *           default: modern
 */

/**
 * @swagger
 * /api/v1/jobs:
 *   post:
 *     summary: Create a new job
 *     description: Create a news generation job with specified parameters
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateJobRequest'
 *     responses:
 *       201:
 *         description: Job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', async (req, res, next) => {
  try {
    // Validate request body
    const validationResult = createJobSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid request data', {
        errors: validationResult.error.issues
      });
    }

    const jobData = validationResult.data;
    const jobId = uuidv4();
    const now = new Date().toISOString();

    const job = {
      id: jobId,
      ...jobData,
      status: 'queued',
      steps: [
        { name: 'fetch_news', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'summarize', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'generate_audio', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'create_video', status: 'pending', startedAt: null, completedAt: null, error: null },
        { name: 'publish', status: 'pending', startedAt: null, completedAt: null, error: null }
      ],
      artifacts: {
        summary: null,
        audio: null,
        video: null,
        thumbnail: null
      },
      error: null,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.id
    };

    // Save job to database
    const savedJob = await databaseService.createJob(job);
    incrementJobMetric('created');

    logger.info('Job created', {
      jobId: savedJob.id,
      topic: savedJob.topic,
      userId: req.user.id
    });

    // Start job processing in background
    processJobAsync(savedJob).catch(error => {
      logger.error('Job processing failed', { jobId: savedJob.id, error: error.message });
    });

    res.status(201).json(savedJob);

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/jobs:
 *   get:
 *     summary: Get jobs list
 *     description: Retrieve paginated list of jobs with optional filters
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [queued, running, completed, failed]
 *         description: Filter by job status
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *         description: Filter by topic
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter jobs created after this date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter jobs created before this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Job'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', async (req, res, next) => {
  try {
    // Validate query parameters
    const validationResult = jobFiltersSchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError('Invalid query parameters', {
        errors: validationResult.error.issues
      });
    }

    const filters = validationResult.data;
    
    // Get jobs from database
    const dbFilters = {
      status: filters.status,
      topic: filters.topic,
      date_from: filters.date_from,
      date_to: filters.date_to,
      limit: filters.limit,
      offset: (filters.page - 1) * filters.limit
    };
    
    const jobs = await databaseService.getJobs(dbFilters);
    const totalJobs = await databaseService.getJobs({ ...dbFilters, limit: null, offset: null });
    const total = totalJobs.length;
    const totalPages = Math.ceil(total / filters.limit);

    res.json({
      jobs,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/jobs/{id}:
 *   get:
 *     summary: Get job by ID
 *     description: Retrieve a specific job by its ID
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const job = await databaseService.getJobById(jobId);

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // Get associated articles
    const articles = await databaseService.getArticlesByJobId(jobId);
    job.articles = articles;

    res.json(job);

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/jobs/{id}/publish:
 *   post:
 *     summary: Publish job to YouTube
 *     description: Publish a completed job's video to YouTube
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job published successfully
 *       404:
 *         description: Job not found
 *       400:
 *         description: Job not ready for publishing
 */
router.post('/:id/publish', async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const job = await databaseService.getJobById(jobId);

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: {
          message: 'Job must be completed before publishing',
          status: 400
        }
      });
    }

    if (!job.artifacts || !job.artifacts.video) {
      return res.status(400).json({
        error: {
          message: 'No video available for publishing',
          status: 400
        }
      });
    }

    // Publish to YouTube
    const publishResult = await youtubeService.publishJobVideo(
      job,
      job.artifacts.video,
      job.artifacts.thumbnail
    );

    // Update job with publish step
    const updatedSteps = job.steps.map(step => {
      if (step.name === 'publish') {
        return {
          ...step,
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        };
      }
      return step;
    });

    await databaseService.updateJob(jobId, {
      steps: updatedSteps,
      youtube_url: publishResult.videoUrl,
      youtube_video_id: publishResult.videoId
    });

    logger.info('Job published to YouTube', {
      jobId: job.id,
      videoUrl: publishResult.videoUrl,
      userId: req.user.id
    });

    res.json({
      message: 'Job published successfully',
      videoUrl: publishResult.videoUrl,
      videoId: publishResult.videoId
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/jobs/{id}:
 *   delete:
 *     summary: Delete job
 *     description: Delete a job and its associated artifacts
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       204:
 *         description: Job deleted successfully
 *       404:
 *         description: Job not found
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const job = await databaseService.getJobById(jobId);

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    // TODO: Clean up artifacts (files, etc.)
    // await cleanupJobArtifacts(job);

    const deleted = await databaseService.deleteJob(jobId);
    
    if (!deleted) {
      throw new Error('Failed to delete job');
    }

    logger.info('Job deleted', {
      jobId: job.id,
      userId: req.user.id
    });

    res.status(204).send();

  } catch (error) {
    next(error);
  }
});

// Background job processing function
async function processJobAsync(job) {
  try {
    logger.info('Starting job processing', { jobId: job.id });
    
    // Update job status to running
    await databaseService.updateJob(job.id, {
      status: 'running',
      started_at: new Date().toISOString()
    });

    // Step 1: Fetch news articles
    await updateJobStep(job.id, 'fetch_news', 'running');
    const articles = await gnewsService.fetchArticlesForJob(job);
    await updateJobStep(job.id, 'fetch_news', 'completed');

    if (articles.length === 0) {
      throw new Error('No articles found for the specified topic/keywords');
    }

    // Step 2: Summarize content (call NLP service)
    await updateJobStep(job.id, 'summarize', 'running');
    // TODO: Call summarization service
    await updateJobStep(job.id, 'summarize', 'completed');

    // Step 3: Generate audio (call TTS service)
    await updateJobStep(job.id, 'generate_audio', 'running');
    // TODO: Call TTS service
    await updateJobStep(job.id, 'generate_audio', 'completed');

    // Step 4: Create video (call Video service)
    await updateJobStep(job.id, 'create_video', 'running');
    // TODO: Call video generation service
    await updateJobStep(job.id, 'create_video', 'completed');

    // Update job as completed
    await databaseService.updateJob(job.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      processing_time: (Date.now() - new Date(job.created_at).getTime()) / 1000
    });

    incrementJobMetric('completed');
    logger.info('Job processing completed successfully', { jobId: job.id });

  } catch (error) {
    logger.error('Job processing failed', { jobId: job.id, error: error.message });
    
    await databaseService.updateJob(job.id, {
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    });

    incrementJobMetric('failed');
  }
}

async function updateJobStep(jobId, stepName, status) {
  const job = await databaseService.getJobById(jobId);
  const updatedSteps = job.steps.map(step => {
    if (step.name === stepName) {
      const now = new Date().toISOString();
      return {
        ...step,
        status,
        startedAt: status === 'running' ? now : step.startedAt,
        completedAt: status === 'completed' ? now : step.completedAt
      };
    }
    return step;
  });

  await databaseService.updateJob(jobId, { steps: updatedSteps });
}

export default router;