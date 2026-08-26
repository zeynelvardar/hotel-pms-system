/**
 * Kullanıcının giriş yapmasını, oturumunu kapatmasını ve güncel profil bilgilerini
 * çekmesini sağlayan merkezi kimlik doğrulama servisidir.
 */

import { api } from './api';
import { tokenStorage } from './tokenStorage';

export const authService = {
  /**
   * Kullanıcı girişi yapar ve token'ları kaydeder.
   */
  async login(username, password) {
    const response = await api.post('/auth/token/', { username, password });
    const { access, refresh, user } = response.data;
    tokenStorage.setTokens(access, refresh);
    tokenStorage.setUser(user);
    return response.data;
  },

  /**
   * Oturumu kapatır ve yerel verileri temizler.
   */
  logout() {
    tokenStorage.clearAuth();
    window.location.href = '/login';
  },

  /**
   * Giriş yapmış kullanıcının güncel verisini çeker.
   */
  async getCurrentUser() {
    const response = await api.get('/auth/me/');
    tokenStorage.setUser(response.data);
    return response.data;
  },
};