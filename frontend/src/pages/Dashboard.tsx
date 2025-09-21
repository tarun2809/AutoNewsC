import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface Job {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  videoUrl?: string;
  publishedAt?: string;
}

interface Stats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
}

const Dashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    processingJobs: 0,
  });
  const [loading, setLoading] = useState(true);

  // Mock data for development
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockJobs: Job[] = [
        {
          id: '1',
          title: 'AI Breakthrough in Climate Science',
          status: 'completed',
          createdAt: '2024-01-20T10:00:00Z',
          completedAt: '2024-01-20T10:15:00Z',
          videoUrl: 'https://example.com/video1.mp4',
          publishedAt: '2024-01-20T10:20:00Z',
        },
        {
          id: '2',
          title: 'Tech Giants Announce Quantum Computing Partnership',
          status: 'processing',
          createdAt: '2024-01-20T11:00:00Z',
        },
        {
          id: '3',
          title: 'Global Market Update: Cryptocurrency Surge',
          status: 'pending',
          createdAt: '2024-01-20T12:00:00Z',
        },
        {
          id: '4',
          title: 'Space Exploration Milestone Reached',
          status: 'failed',
          createdAt: '2024-01-20T09:00:00Z',
        },
      ];

      setJobs(mockJobs);
      setStats({
        totalJobs: mockJobs.length,
        completedJobs: mockJobs.filter(j => j.status === 'completed').length,
        failedJobs: mockJobs.filter(j => j.status === 'failed').length,
        processingJobs: mockJobs.filter(j => j.status === 'processing').length,
      });
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusIcon = (status: Job['status']) => {
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

  const getStatusColor = (status: Job['status']) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Monitor your automated news generation pipeline
          </p>
        </div>
        <Link
          to="/jobs/new"
          className="btn btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Create Job</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completedJobs}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-gray-900">{stats.processingJobs}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failedJobs}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Jobs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Jobs</h2>
          <Link
            to="/jobs"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View all
          </Link>
        </div>

        <div className="space-y-4">
          {jobs.slice(0, 5).map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-4">
                {getStatusIcon(job.status)}
                <div>
                  <h3 className="font-medium text-gray-900">{job.title}</h3>
                  <p className="text-sm text-gray-500">
                    Created {format(new Date(job.createdAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                    job.status
                  )}`}
                >
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>

                <div className="flex space-x-2">
                  {job.videoUrl && (
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <PlayIcon className="h-4 w-4" />
                    </button>
                  )}
                  <Link
                    to={`/jobs/${job.id}`}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-8">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first automated news job.
            </p>
            <div className="mt-6">
              <Link to="/jobs/new" className="btn btn-primary">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Job
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;