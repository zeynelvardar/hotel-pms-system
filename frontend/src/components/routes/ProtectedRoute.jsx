/**
 * Route Guard yapılan dosyadır.
 * Kullanıcı giriş yapmış mı?, admin mi?, misafir mi? bakarak
 * yetkili sayfaya girebilir mi giremez gibi gibi korumaları yapar.
 * Koruma kalkanıdır. 
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'


const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />; // replace logine geri attırıyor.
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet/>;
};

export default ProtectedRoute;