/**
 * Login İşlemini Yönetir (Login.jsx'deki formlardan veri buraya gelir.)
 * 
 * authService.js Kimlik doğrulama (authentication) işlemlerini tek bir
 * merkezde yöneten Service katmanı modülüdür.
 * 
 * Ağ trafiğini yönetir: Backend'deki Django API ENDPOINT'lere ağ isteği atar.
 * 
 * Gelen veriyi karşılar ve doğrular. 
 */

import api from './api';
import { tokenStorage } from './tokenStorage';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('token/', { username, password });
    const { access, refresh } = response.data || {};

    // beklenmedik payload durumunda storage'a undefined yazılmasını önler.
    if (access && refresh) {
      tokenStorage.setTokens(access, refresh);
    }

    return response.data;
  },

  logout: () => {
    tokenStorage.clearTokens();
  },
};