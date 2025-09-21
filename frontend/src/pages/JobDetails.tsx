import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PlayIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CalendarDaysIcon,
  TagIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface JobDetails {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  videoUrl?: string;
  audioUrl?: string;
  publishedAt?: string;
  topic: string;
  keywords: string[];
  duration: number;
  voiceType: string;
  articleSummary?: string;
  originalArticles?: Array<{
    title: string;
    url: string;
    source: string;
  }>;
  processingSteps?: Array<{
    step: string;
    status: 'completed' | 'processing' | 'pending' | 'failed';
    timestamp?: string;
    message?: string;
  }>;
  youtubeUrl?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
}

const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'processing' | 'content'>('overview');

  useEffect(() => {
    // Mock API call
    setTimeout(() => {
      const mockJob: JobDetails = {
        id: id || '1',
        title: 'AI Breakthrough in Climate Science',
        status: 'completed',
        createdAt: '2024-01-20T10:00:00Z',
        completedAt: '2024-01-20T10:15:00Z',
        videoUrl: 'https://example.com/video1.mp4',
        audioUrl: 'https://example.com/audio1.mp3',
        publishedAt: '2024-01-20T10:20:00Z',
        topic: 'Technology',
        keywords: ['AI', 'Climate', 'Research', 'Innovation'],
        duration: 180,
        voiceType: 'female',
        articleSummary: 'Scientists at MIT have developed a revolutionary AI system that can predict climate change patterns with unprecedented accuracy. The system, called ClimateAI, uses deep learning algorithms to analyze vast amounts of environmental data.',
        originalArticles: [
          {
            title: 'MIT Scientists Develop AI for Climate Prediction',
            url: 'https://example.com/article1',
            source: 'Tech News Daily'
          },
          {
            title: 'ClimateAI: Revolutionary Weather Forecasting',
            url: 'https://example.com/article2',
            source: 'Science Journal'
          }
        ],
        processingSteps: [
          {
            step: 'Article Collection',
            status: 'completed',
            timestamp: '2024-01-20T10:01:00Z',
            message: 'Found 5 relevant articles'
          },
          {
            step: 'Content Summarization',
            status: 'completed',
            timestamp: '2024-01-20T10:03:00Z',
            message: 'Summary generated successfully'
          },
          {
            step: 'Audio Generation',
            status: 'completed',
            timestamp: '2024-01-20T10:08:00Z',
            message: 'High-quality audio generated'
          },
          {
            step: 'Video Creation',
            status: 'completed',
            timestamp: '2024-01-20T10:12:00Z',
            message: 'Video rendered in 1080p'
          },
          {
            step: 'YouTube Upload',
            status: 'completed',
            timestamp: '2024-01-20T10:15:00Z',
            message: 'Published successfully'
          }
        ],
        youtubeUrl: 'https://youtube.com/watch?v=example',
        metrics: {
          views: 1250,
          likes: 89,
          comments: 23
        }
      };
      setJob(mockJob);
      setLoading(false);
    }, 800);
  }, [id]);

  const getStatusIcon = (status: JobDetails['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-8 w-8 text-green-500" />;
      case 'processing':
        return <ClockIcon className="h-8 w-8 text-yellow-500 animate-spin" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />;
      default:
        return <ClockIcon className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusColor = (status: JobDetails['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'failed':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Job not found</h3>
        <p className="mt-1 text-gray-500">The requested job could not be found.</p>
        <button
          onClick={() => navigate('/jobs')}
          className="mt-6 btn btn-primary"
        >
          Back to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-start space-x-4">
            {getStatusIcon(job.status)}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
              <div className="flex items-center space-x-4 mt-2">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(job.status)}`}
                >
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
                <span className="text-gray-500">Job ID: {job.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {job.status === 'completed' && (
          <div className="flex space-x-2">
            {job.videoUrl && (
              <button className="btn btn-secondary flex items-center space-x-2">
                <PlayIcon className="h-4 w-4" />
                <span>Play Video</span>
              </button>
            )}
            {job.youtubeUrl && (
              <a
                href={job.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary flex items-center space-x-2"
              >
                <EyeIcon className="h-4 w-4" />
                <span>View on YouTube</span>
              </a>
            )}
            <button className="btn btn-secondary flex items-center space-x-2">
              <ShareIcon className="h-4 w-4" />
              <span>Share</span>
            </button>
            <button className="btn btn-secondary flex items-center space-x-2">
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'processing', 'content'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Details */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Created:</span>
                    <span>{format(new Date(job.createdAt), 'MMM d, yyyy HH:mm')}</span>
                  </div>
                  {job.completedAt && (
                    <div className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Completed:</span>
                      <span>{format(new Date(job.completedAt), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <TagIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Topic:</span>
                    <span>{job.topic}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <VideoCameraIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Duration:</span>
                    <span>{job.duration}s</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <SpeakerWaveIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Voice:</span>
                    <span>{job.voiceType}</span>
                  </div>
                </div>

                {job.keywords.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm text-gray-600 block mb-2">Keywords:</span>
                    <div className="flex flex-wrap gap-2">
                      {job.keywords.map(keyword => (
                        <span
                          key={keyword}
                          className="px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Video Player */}
              {job.videoUrl && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Video</h3>
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                    <div className="text-center text-white">
                      <PlayIcon className="h-16 w-16 mx-auto mb-4 opacity-70" />
                      <p className="text-lg">Video Player</p>
                      <p className="text-sm opacity-70">Click to play video</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* YouTube Metrics */}
              {job.metrics && job.youtubeUrl && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">YouTube Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Views:</span>
                      <span className="font-medium">{job.metrics.views?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Likes:</span>
                      <span className="font-medium">{job.metrics.likes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Comments:</span>
                      <span className="font-medium">{job.metrics.comments}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Source Articles */}
              {job.originalArticles && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Articles</h3>
                  <div className="space-y-3">
                    {job.originalArticles.map((article, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-sm text-gray-900 mb-1">
                          {article.title}
                        </h4>
                        <p className="text-xs text-gray-500 mb-2">{article.source}</p>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          Read Article →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'processing' && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Processing Timeline</h3>
            <div className="space-y-4">
              {job.processingSteps?.map((step, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {getStepIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">{step.step}</h4>
                      {step.timestamp && (
                        <span className="text-xs text-gray-500">
                          {format(new Date(step.timestamp), 'HH:mm:ss')}
                        </span>
                      )}
                    </div>
                    {step.message && (
                      <p className="text-sm text-gray-600 mt-1">{step.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Article Summary */}
            {job.articleSummary && (
              <div className="card">
                <div className="flex items-center space-x-2 mb-4">
                  <DocumentTextIcon className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Article Summary</h3>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed">{job.articleSummary}</p>
                </div>
              </div>
            )}

            {/* Audio File */}
            {job.audioUrl && (
              <div className="card">
                <div className="flex items-center space-x-2 mb-4">
                  <SpeakerWaveIcon className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Generated Audio</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-4">
                    <button className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700">
                      <PlayIcon className="h-4 w-4" />
                    </button>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-primary-600 h-2 rounded-full w-0"></div>
                    </div>
                    <span className="text-sm text-gray-600">0:00 / {Math.floor(job.duration / 60)}:{(job.duration % 60).toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default JobDetails;