/**
 * AuthContext
 * Uygulamanın tamamında kimlik doğrulama (Authentication) durumunu yönetir.
 * Token çözümleme, oturum açma/kapatma ve yetkilendirme state'ini tek merkezde toplar.
 */

import { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { tokenStorage } from '../services/tokenStorage';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Uygulama ilk açıldığında veya sayfa yenilendiğinde mevcut token'ı doğrula
    useEffect(() => {
        const token = tokenStorage.getAccessToken();
        if (token) {
            try {
                const decodedUser = jwtDecode(token);
                // Token süresi dolmuş mu kontrolü (exp saniye cinsindendir)
                if (decodedUser.exp && decodedUser.exp * 1000 < Date.now()) {
                    tokenStorage.clearTokens();
                    setUser(null);
                } else {
                    setUser(decodedUser);
                }
            } catch (error) {
                console.error('Geçersiz veya bozuk oturum belirteci:', error);
                tokenStorage.clearTokens();
                setUser(null);
            }
        }
        setLoading(false);
    }, []);

    /**
     * Kullanıcı girişi yapar.
     * Hata durumunda state'i sıfırlar ve hatayı Login bileşenine fırlatır (throw).
     */
    const login = async (username, password) => {
        try {
            const data = await authService.login(username, password);

            if (!data?.access) {
                throw new Error('Sunucudan geçerli bir oturum anahtarı alınamadı.');
            }

            const decoded = jwtDecode(data.access);
            setUser(decoded);
            return decoded;
        } catch (error) {
            setUser(null);
            // Login bileşenindeki catch bloğunun hatayı yakalayıp toast gösterebilmesi için fırlatıyoruz
            throw error;
        }
    };

    /**
     * Oturumu güvenli şekilde sonlandırır.
     */
    const logout = () => {
        try {
            authService.logout();
        } finally {
            tokenStorage.clearTokens();
            setUser(null);
        }
    };

    // İlk oturum kontrolü bitene kadar çocuk bileşenlerin render edilmesini engelle
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 text-white font-semibold">
                Oturum kontrol ediliyor...
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth hook, AuthProvider sarmalı içerisinde kullanılmalıdır.');
    }
    return context;
};