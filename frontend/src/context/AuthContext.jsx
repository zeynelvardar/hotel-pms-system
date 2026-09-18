/** .jsx dosyası, React dünyasında kullanıcı oturum yönetimini 
 * (kimlik doğrulama) merkezi olarak yönettiğin kalbin olduğu yerdir. */

import { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { tokenStorage } from '../services/tokenStorage';
import { authService } from '../services/authService'

const AuthContext = createContext(); // uygulamaya veri dağıtan kanalı oluşturur

export const AuthProvider = ({ children }) => {  //children ile bu kodun içine html veya başka react fonksiyonları ekleyebiliyoruz.
    const [user, setUser] = useState(null); // kim giriş yaptı durum(state) kutusu oluştur, kutuyu güncelleme fonkisyonu ver.
    const [loading, setLoading] = useState(null); // arka planda token doğrulama yapılırken işlemin devam edişiini takip eden durum kutusu (state).


useEffect(() => {  // senkonizasyonu yapar, ilk yüklenmede veri çeker, sayfa kapanırken verileri temizler (side-effects yönetir)
    const token = tokenStorage.getAccessToken();
    if (token) {
        try {
            const decodedUser = jwtDecode(token);
            setUser(decodedUser) // state kutusunu günceller.
        } catch (error) {
            tokenStorage.clearTokens();
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

return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
        {!loading && children}
    </AuthContext.Provider>
);
};

export const useAuth = () => useContext(AuthContext) // oturum verilerine herhangi bir bileşenden erişim sağlar.


