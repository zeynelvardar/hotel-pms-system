/**Tüm API isteklerini yöneten, isteklerin başına otomatik 
 * Access Token ekleyen ve token süresi 
 * dolduğunda (401 hatası) Refresh Token ile
 * sessizce yenileme yapan merkezi Axios istemcisidir. */

import axios from 'axios';
import { tokenStorage } from './tokenStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refresh = tokenStorage.getRefreshToken();
        if (!refresh) {
          throw new Error('Refresh token bulunamadı');
        }

        const res = await axios.post('http://localhost:8000/api/token/refresh/', {
          refresh,
        });

        if (res.status === 200) {
          tokenStorage.setTokens(res.data.access, null);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        tokenStorage.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;