/**
 * authService.js Kimlik doğrulama (authentication) işlemlerini tek bir
 * merkezde yöneten Service katmanı modülüdür.
 */

import api from './api';
import { tokenStorage } from './tokenStorage';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('token/', { username, password });
    const { access, refresh } = response.data || {};

    // Beklenmedik payload durumunda storage'a undefined yazılmasını önler
    if (access && refresh) {
      tokenStorage.setTokens(access, refresh);
    }

    return response.data;
  },

  logout: () => {
    tokenStorage.clearTokens();
  },
};