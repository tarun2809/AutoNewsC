// API Base Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.authToken = localStorage.getItem('authToken');
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.message || 'API request failed',
          response.status,
          error
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Network error occurred', 0, { originalError: error });
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // Jobs endpoints
  async getJobs(params?: {
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    
    const endpoint = `/jobs${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.request<{
      jobs: Job[];
      total: number;
      limit: number;
      offset: number;
    }>(endpoint);
  }

  async getJob(id: string) {
    return this.request<Job>(`/jobs/${id}`);
  }

  async createJob(jobData: CreateJobRequest) {
    return this.request<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  async deleteJob(id: string) {
    return this.request(`/jobs/${id}`, { method: 'DELETE' });
  }

  async publishJob(id: string) {
    return this.request<{ success: boolean; youtubeUrl?: string }>(
      `/jobs/${id}/publish`,
      { method: 'POST' }
    );
  }

  // Health endpoint
  async getHealth() {
    return this.request<{
      status: string;
      timestamp: string;
      services: Record<string, any>;
    }>('/health');
  }

  // Metrics endpoint
  async getMetrics() {
    return this.request<{
      jobs: {
        total: number;
        completed: number;
        failed: number;
        processing: number;
      };
      performance: {
        averageProcessingTime: number;
        successRate: number;
      };
    }>('/metrics');
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Types
export interface Job {
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

export interface CreateJobRequest {
  title: string;
  topic: string;
  keywords?: string[];
  duration?: number;
  voiceType?: string;
  publishToYoutube?: boolean;
  scheduledAt?: string;
}