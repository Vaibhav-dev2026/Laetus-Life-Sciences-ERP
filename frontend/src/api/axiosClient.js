import axios from 'axios';

// Central Axios instance. All real (non-demo) API calls should go through this
// so auth headers, base URL and error handling stay in one place.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

axiosClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('laetus_token') || localStorage.getItem('laetus_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      sessionStorage.removeItem('laetus_token');
      sessionStorage.removeItem('laetus_user');
      localStorage.removeItem('laetus_token');
      localStorage.removeItem('laetus_user');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=true';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
