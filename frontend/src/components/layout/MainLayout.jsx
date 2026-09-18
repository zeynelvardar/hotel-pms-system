// Desk ekibinin göreceği ana iskelet, yönetim kabuğudur.

import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Users, BedDouble, LogOut } from 'lucide-react' //ikonlar
import { Toaster } from 'react-hot-toast' // bildirim pencere kütüphanesi

const MainLayout = () => {
    const { user, logout } = useAuth(); //kulanıcı kim?, log out butonunu çalıştıran fonksiyon
    const navigate = useNavigate(); //sayfalar arası ışınlanma kutusu değişkene atanır

    const handleOut = () => { //oturum kapama
        logout();
        navigate('/login');
    };

    return (
    <div className="flex h-screen bg-slate-50">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">HOTEL PMS CORE</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1.5">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
            <LayoutDashboard size={18} /> Front Desk
          </Link>
          <Link to="/rack" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
            <BedDouble size={18} /> Room Rack
          </Link>
          <Link to="/guests" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition">
            <Users size={18} /> Misafirler
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-slate-800">Operasyon Ekranı</h2>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <p className="font-semibold text-slate-700">{user?.username}</p>
              <p className="text-slate-400 uppercase tracking-wider">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;