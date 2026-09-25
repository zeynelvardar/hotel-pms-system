/** Uygulamanın tamamında kimlik doğrulama ve Authentication State'i 
 * tek bir merkezden yönetir.
 * 
 * Context API kullanarak prop drilling'i önler.
 */

import { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { tokenStorage } from '../services/tokenStorage';
import { authService } from '../services/authService';

const AuthContext = createContext(); // uygulamaya veri dağıtan kanalı oluşturur

export const AuthProvider = ({ children }) => {  //children ile bu kodun içine html veya başka react fonksiyonları ekleyebiliyoruz.
    const [user, setUser] = useState(null); // kim giriş yaptı durum(state) kutusu oluştur, kutuyu güncelleme fonkisyonu ver.
    const [loading, setLoading] = useState(true); // arka planda token doğrulama yapılırken işlemin devam edişiini takip eden durum kutusu (state).


useEffect(() => {  // senkonizasyonu yapar, ilk yüklenmede veri çeker, sayfa kapanırken verileri temizler (side-effects yönetir)
    // Sayfa yenilendiğinde veya doğrudan URL girişi olduğunda tokenStorage'dan oku
    const token = tokenStorage.getAccessToken();
    if (token) {
        try {
            const decodedUser = jwtDecode(token);
            setUser(decodedUser); // state kutusunu günceller.
        } catch (error) {
            console.error('Geçersiz token:', error);
            tokenStorage.clearTokens();
            setUser(null);
        }
    }
    setLoading(false); //kontrol bitti, yükleme tamamlandı
}, []);

const login = async (username, password) => {
    const data = await authService.login(username, password);
    const decoded = jwtDecode(data.access);
    setUser(decoded); //state kutusu güncellenir (kimin giriş yaptığını tutan)
    return decoded; // login form bileşenine döner
};

const logout = () => {
    authService.logout();
    setUser(null); // state kutusu güncellenir. 
};

// Yükleme bitene kadar çocuk bileşenleri render etme (Erken yönlendirmeyi önler.)
if (loading) {
    return (
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white font-semibold">
          Oturum kontrol ediliyor...
        </div>
    );
}

return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
        {!loading && children}
    </AuthContext.Provider>
);
};

export const useAuth = () => useContext(AuthContext) // oturum verilerine herhangi bir bileşenden erişim sağlar.


