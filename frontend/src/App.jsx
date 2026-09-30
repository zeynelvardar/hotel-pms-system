/**
 * App.jsx: Merkezi kimlik yönetimi (auth), oturum durumu, JWT token, kullanıcı rolü,
 * login-logout işlemlerini yürütür.
 * (SPA Navigation Mantığı),
 * Public rota ve korumalı rota olarak ayrımı yapar. (login=public)
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/routes/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import RoomRack from './pages/RoomRack'
import Dashboard from './pages/Dashboard';


function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes (Main Layout içindekiler) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rack" element={<RoomRack />} />
              <Route
                path="/guests"
                element={<div className="bg-white p-6 rounded-lg border border-slate-200">Misafir Yönetimi</div>}
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;