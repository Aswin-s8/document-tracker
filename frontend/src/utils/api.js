// Dynamic Backend URL configuration
const getBackendUrl = () => {
  // If running locally, Vite runs on 5173/etc, so send API calls to backend on 5000.
  // In production/hosting, if both are served from the same host, use current origin.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return window.location.origin;
};

export const BACKEND_URL = getBackendUrl();

const getAuthHeaders = () => {
  const token = localStorage.getItem('admin_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  // Check if token exists
  isAuthenticated() {
    return !!localStorage.getItem('admin_token');
  },

  // Log in to admin panel
  async login(password) {
    const response = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    if (data.token) {
      localStorage.setItem('admin_token', data.token);
    }
    return data;
  },

  // Log out admin
  logout() {
    localStorage.removeItem('admin_token');
  },

  // Fetch all logs
  async fetchLogs() {
    const response = await fetch(`${BACKEND_URL}/api/logs`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (response.status === 401 || response.status === 403) {
      this.logout();
      window.dispatchEvent(new Event('auth-expired'));
      throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch logs');
    }
    return data;
  },

  // Clear all logs
  async clearLogs() {
    const response = await fetch(`${BACKEND_URL}/api/logs`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    if (response.status === 401 || response.status === 403) {
      this.logout();
      window.dispatchEvent(new Event('auth-expired'));
      throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to clear logs');
    }
    return data;
  }
};
