const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

let authContext = null;

// Initialize the API service with auth context
export const initializeApi = (context) => {
  authContext = context;
};

// Helper to get auth headers
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (authContext?.accessToken) {
    headers['Authorization'] = `Bearer ${authContext.accessToken}`;
  }
  
  return headers;
};

// Helper to get auth headers for multipart/form-data
const getAuthHeadersMultipart = () => {
  const headers = {};
  
  if (authContext?.accessToken) {
    headers['Authorization'] = `Bearer ${authContext.accessToken}`;
  }
  
  return headers;
};

// Helper to handle token refresh
const refreshAccessToken = async () => {
  if (!authContext?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: authContext.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  authContext.updateTokens(data);
  
  return data.access_token;
};

// Helper to handle API requests with automatic token refresh
const apiRequest = async (url, options = {}) => {
  let response = await fetch(url, options);

  // If unauthorized, try to refresh token
  if (response.status === 401 && authContext?.refreshToken) {
    try {
      await refreshAccessToken();
      
      // Retry the original request with new token
      const newHeaders = options.body instanceof FormData 
        ? getAuthHeadersMultipart() 
        : getAuthHeaders();
      
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...newHeaders,
        },
      });
    } catch (error) {
      // If refresh fails, logout user
      authContext?.logout();
      throw new Error('Session expired. Please login again.');
    }
  }

  return response;
};

// Auth API
export const authApi = {
  async register(userData) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
  },

  async login(credentials) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },

  async logout() {
    if (!authContext?.refreshToken) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        refresh_token: authContext.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Logout failed on server');
    }

    return response.json();
  },

  async getCurrentUser() {
    const response = await apiRequest(`${API_BASE_URL}/auth/users/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return response.json();
  },
};

// Audio API
export const audioApi = {
  async transcribeAudio(file, title) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const response = await apiRequest(`${API_BASE_URL}/audios/transcribe`, {
      method: 'POST',
      headers: getAuthHeadersMultipart(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Transcription failed');
    }

    return response.json();
  },

  /**
   * Automated workflow: Upload → Transcribe → Translate → Analyze
   * This chains all three API calls automatically
   */
  async processAudioComplete(file, title, generateMarkdown = true) {
    console.log('Starting automated workflow: Transcribe → Translate → Analyze');
    
    // Step 1: Transcribe
    console.log('Step 1: Transcribing audio...');
    const transcription = await this.transcribeAudio(file, title);
    console.log('Transcription completed:', transcription.id);
    
    // Step 2: Translate
    console.log('Step 2: Translating to English...');
    const translation = await translationApi.translateToEnglish({
      audio_transcription_id: transcription.id,
      source_text: transcription.transcription_text
    });
    console.log('Translation completed:', translation.id);
    
    // Step 3: Analyze
    console.log('Step 3: Generating meeting analysis...');
    const analysis = await this.createAnalysis({
      audio_translation_id: translation.id,
      generate_markdown: generateMarkdown
    });
    console.log('Analysis completed:', analysis.id);
    
    // Return all results
    return {
      transcription,
      translation,
      analysis
    };
  },

  async getTranscriptions(skip = 0, limit = 100) {
    const response = await apiRequest(
      `${API_BASE_URL}/audios/transcriptions?skip=${skip}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch transcriptions');
    }

    return response.json();
  },

  async getTranscriptionById(id) {
    const response = await apiRequest(`${API_BASE_URL}/audios/transcriptions/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch transcription');
    }

    return response.json();
  },

  async createAnalysis(analysisData) {
    const response = await apiRequest(`${API_BASE_URL}/audios/analyses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(analysisData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create analysis');
    }

    return response.json();
  },

  async getAnalyses(skip = 0, limit = 100) {
    const response = await apiRequest(
      `${API_BASE_URL}/audios/analyses?skip=${skip}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch analyses');
    }

    return response.json();
  },

  async getAnalysisById(id) {
    const response = await apiRequest(`${API_BASE_URL}/audios/analyses/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch analysis');
    }

    return response.json();
  },
};

// Translation API
export const translationApi = {
  async translateToEnglish(translationData) {
    const response = await apiRequest(`${API_BASE_URL}/translations/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(translationData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Translation failed');
    }

    return response.json();
  },

  async getTranslations(skip = 0, limit = 100) {
    const response = await apiRequest(
      `${API_BASE_URL}/translations/?skip=${skip}&limit=${limit}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch translations');
    }

    return response.json();
  },

  async getTranslationById(id) {
    const response = await apiRequest(`${API_BASE_URL}/translations/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch translation');
    }

    return response.json();
  },
};
