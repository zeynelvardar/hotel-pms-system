/**
 * JWT Token depolama (cache'e) ve yardımcı fonksiyonları
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenStorage = {
    getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
    getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
    setTokens: (access, refresh) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, access);
        if (refresh) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
        }
    },
    clearTokens: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
}