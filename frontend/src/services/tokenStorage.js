/**
 * JWT Token depolama (cache'e) ve yardımcı fonksiyonları
 */
const ACCESS_TOKEN_KEY = 'pms_access_token'; // 'access' doğru yazımına kavuştu
const REFRESH_TOKEN_KEY = 'pms_refresh_token';
const USER_KEY = 'pms_user_info';

export const tokenStorage = {
    getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
    getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
    getUser: () => {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    },
    setTokens: (accessToken, refreshToken) => {
        if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    },
    setUser: (user) => {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clearAuth: () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },
};