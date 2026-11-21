// Desk ekibinin göreceği ana iskelet, yönetim kabuğudur.

import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Users, BedDouble, BarChart3, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// DRY Prensibi: Sidebar menüsü ve üst sayfa başlığı tek merkezden yönetilir
const NAV_ITEMS = [
  { to: '/', label: 'Front Desk', title: 'Operasyon Ekranı', icon: LayoutDashboard, end: true },
  { to: '/rack', label: 'Room Rack', title: 'Oda Durum Panosu (Room Rack)', icon: BedDouble },
  { to: '/forecast', label: 'Forecast', title: 'Doluluk Tahmini (Forecast)', icon: BarChart3 },
  { to: '/guests', label: 'Misafirler', title: 'Misafir Yönetimi', icon: Users },
];

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentNavItem = NAV_ITEMS.find((item) => item.to === location.pathname);
  const pageTitle = currentNavItem?.title || 'Operasyon Ekranı';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">HOTEL PMS CORE</h1>
        </div>
        <nav className="flex-1 px-4 space-y-1.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{pageTitle}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <p className="font-semibold text-slate-700">{user?.username}</p>
              <p className="text-slate-400 uppercase tracking-wider">{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Çıkış Yap"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
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