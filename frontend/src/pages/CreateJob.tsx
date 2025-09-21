import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PlusIcon,
  InformationCircleIcon,
  ClockIcon,
  PlayIcon,
  SpeakerWaveIcon,
  VideoCameraIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

interface JobFormData {
  title: string;
  topic: string;
  keywords: string[];
  duration: number;
  voiceType: string;
  publishToYoutube: boolean;
  scheduledAt?: string;
}

const CreateJob: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<JobFormData>({
    title: '',
    topic: '',
    keywords: [],
    duration: 180,
    voiceType: 'female',
    publishToYoutube: false,
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topics = [
    'Technology',
    'Science',
    'Healthcare',
    'Finance',
    'Environment',
    'Politics',
    'Sports',
    'Entertainment',
    'Business',
    'Education',
  ];

  const voiceTypes = [
    { value: 'female', label: 'Female Voice (Sarah)' },
    { value: 'male', label: 'Male Voice (David)' },
    { value: 'british-female', label: 'British Female (Emma)' },
    { value: 'british-male', label: 'British Male (Oliver)' },
  ];

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, newKeyword.trim()],
      });
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter(k => k !== keyword),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate to jobs page
      navigate('/jobs');
    } catch (error) {
      console.error('Failed to create job:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Job</h1>
          <p className="mt-2 text-gray-600">
            Set up an automated news generation and publishing job
          </p>
        </div>
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Basic Information */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-6">
            <InformationCircleIcon className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Daily Tech News Summary"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic Category *
              </label>
              <select
                required
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="input"
              >
                <option value="">Select a topic</option>
                {topics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Keywords */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keywords (Optional)
            </label>
            <div className="flex space-x-2 mb-3">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
                placeholder="Add relevant keywords..."
                className="flex-1 input"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="btn btn-secondary flex items-center space-x-1"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.keywords.map(keyword => (
                <span
                  key={keyword}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="ml-2 text-primary-600 hover:text-primary-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Video Configuration */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-6">
            <VideoCameraIcon className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Video Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Duration (seconds)
              </label>
              <input
                type="number"
                min="60"
                max="600"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500">
                Recommended: 180-300 seconds for optimal engagement
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice Type
              </label>
              <select
                value={formData.voiceType}
                onChange={(e) => setFormData({ ...formData, voiceType: e.target.value })}
                className="input"
              >
                {voiceTypes.map(voice => (
                  <option key={voice.value} value={voice.value}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Publishing Options */}
        <div className="card">
          <div className="flex items-center space-x-2 mb-6">
            <GlobeAltIcon className="h-6 w-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900">Publishing Options</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="publishToYoutube"
                checked={formData.publishToYoutube}
                onChange={(e) => setFormData({ ...formData, publishToYoutube: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="publishToYoutube" className="ml-2 text-sm text-gray-700">
                Automatically publish to YouTube
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt || ''}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className="input max-w-xs"
              />
              <p className="mt-1 text-sm text-gray-500">
                Leave empty to start immediately
              </p>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="card bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-center space-x-2 mb-4">
            <PlayIcon className="h-6 w-6 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Job Preview</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <ClockIcon className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{formData.duration}s</span>
            </div>
            <div className="flex items-center space-x-2">
              <SpeakerWaveIcon className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Voice:</span>
              <span className="font-medium">
                {voiceTypes.find(v => v.value === formData.voiceType)?.label || 'Default'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <GlobeAltIcon className="h-4 w-4 text-gray-500" />
              <span className="text-gray-600">Publish:</span>
              <span className="font-medium">
                {formData.publishToYoutube ? 'YouTube' : 'Local only'}
              </span>
            </div>
          </div>

          {formData.keywords.length > 0 && (
            <div className="mt-4">
              <span className="text-sm text-gray-600">Keywords:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {formData.keywords.map(keyword => (
                  <span
                    key={keyword}
                    className="px-2 py-1 text-xs bg-primary-200 text-primary-800 rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.topic}
            className="btn btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Creating Job...</span>
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                <span>Create Job</span>
              </>
            )}
          </button>
        </div>
      </motion.form>
    </div>
  );
};

export default CreateJob;