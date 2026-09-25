/**
 * Tarayıcının local hafızasını yoklamak, 
 * tarayıcının belleğinden tokenleri okumak,
 * okuduğu tokeni belleğe yazma, yenileme ve temizleme işlerini yapar.
 * 
 * Tamamen tarayıcının hafızasında döner.
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenStorage = {
    getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),  // tarayıcının belleğindeki token'leri okur
    getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY), // tarayıcının belleğindeki token'leri okur
    setTokens: (access, refresh) => {
        if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
        if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    },
    clearTokens: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    },
};