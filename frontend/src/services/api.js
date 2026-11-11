/**
 * Merkezi Axios İstemcisi
 * - İsteklerin başına dinamik olarak Bearer Access Token ekler.
 * - Yetki süresi dolduğunda (401) sessizce Refresh Token ile yeniler.
 * - Login isteklerini interceptor'dan muaf tutarak hata akışını form katmanına devreder.
 */

import axios from 'axios';
import { tokenStorage } from './tokenStorage';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Her isteğe Access Token enjekte eder
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

// Response Interceptor: 401 yetki hatalarını ve token tazeleme sürecini yönetir
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1. Login veya Refresh isteği 401 döndüyse araya girme, hatayı doğrudan Login bileşenine fırlat
    const isAuthEndpoint = originalRequest?.url?.includes('token/');
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // 2. Normal operasyonel isteklerde 401 alındıysa Token Refresh döngüsünü başlat
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refresh = tokenStorage.getRefreshToken();
        if (!refresh) {
          throw new Error('Refresh token bulunamadı');
        }

        // Hardcoded URL yerine yapılandırılmış baseURL kullanımı
        const normalizedBaseURL = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
        const res = await axios.post(`${normalizedBaseURL}token/refresh/`, {
          refresh,
        });

        if (res.status === 200) {
          tokenStorage.setTokens(res.data.access, null);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        tokenStorage.clearTokens();

        // Eğer kullanıcı zaten login ekranında değilse yönlendir
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;