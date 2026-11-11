/**
 * Login Sayfası
 * Kullanıcı giriş formunu, form doğrulamasını ve HTTP hata geri bildirimlerini yönetir.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, Hotel, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanUsername = username.trim();
        const cleanPassword = password.trim();

        if (!cleanUsername || !cleanPassword) {
            toast.error('Lütfen tüm alanları doldurun.');
            return;
        }

        setIsSubmitting(true);

        try {
            await login(cleanUsername, cleanPassword);
            toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');
            setTimeout(() => {
                navigate('/rack');
            }, 600);
        } catch (err) {
            // Hata Analizi ve Mesaj Formatlama:
            // 1. HTTP 401 Unauthorized (Yanlış kullanıcı adı veya şifre)
            // 2. DRF custom detail mesajı
            // 3. Genel ağ veya sunucu hatası
            let errorMsg = 'Kullanıcı adı veya şifre hatalı!';

            if (err.response?.status === 401) {
                errorMsg = 'Kullanıcı adı veya şifre hatalı!';
            } else if (err.response?.data?.detail) {
                // Eğer backend'den gelen mesaj İngilizce default SimpleJWT mesajıysa Türkçeleştir
                if (err.response.data.detail.includes('No active account')) {
                    errorMsg = 'Kullanıcı adı veya şifre hatalı!';
                } else {
                    errorMsg = err.response.data.detail;
                }
            } else if (Array.isArray(err.response?.data?.non_field_errors)) {
                errorMsg = err.response.data.non_field_errors[0];
            } else if (err.message && !err.response) {
                errorMsg = 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.';
            }

            toast.error(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-900 px-4">
            <Toaster 
                position="top-right" 
                toastOptions={{
                    duration: 3500,
                    style: {
                        borderRadius: '10px',
                        background: '#334155',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: '600'
                    }
                }} 
            />

            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-slate-100">
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-3 rounded-full bg-blue-50 p-3 text-blue-600 shadow-inner">
                        <Hotel size={32} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                        Hotel PMS Core
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Lütfen yetkili kullanıcı bilgilerinizle giriş yapın.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                            Kullanıcı Adı
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <User size={18} />
                            </span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="örn: admin veya recep"
                                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                                disabled={isSubmitting}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                            Şifre
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                <KeyRound size={18} />
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Doğrulanıyor...
                            </>
                        ) : (
                            'Sisteme Giriş Yap'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;