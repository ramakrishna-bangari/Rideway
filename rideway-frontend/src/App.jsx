import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import RiderDashboard from './pages/RiderDashboard';
import BookRide from './pages/BookRide';
import DriverDashboard from './pages/DriverDashboard';
import AdminDashboard from './pages/AdminDashboard';
import RideDetails from './pages/RideDetails';
import Activity from './pages/Activity';
import Account from './pages/Account';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, role, loading } = useAuth();
  const cachedRole = typeof window !== 'undefined' ? localStorage.getItem('rideway_user_role') : null;
  const effectiveRole = role || cachedRole;

  if (loading && !effectiveRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xs font-semibold text-gray-500 animate-pulse">
          Authenticating secure session...
        </div>
      </div>
    );
  }

  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && effectiveRole && !allowedRoles.includes(effectiveRole)) {
    if (effectiveRole === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (effectiveRole === 'DRIVER') return <Navigate to="/driver/dashboard" replace />;
    return <Navigate to="/rider/dashboard" replace />;
  }

  return children;
};

export function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <div className="w-full min-h-screen flex flex-col bg-[#f8f9fa] text-gray-950 antialiased selection:bg-black selection:text-white overflow-x-hidden">
          <Navbar />
          <main className="flex-1">
            <Routes>

              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route
                path="/rider/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['RIDER', 'ADMIN']}>
                    <RiderDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/activity"
                element={
                  <ProtectedRoute allowedRoles={['RIDER', 'ADMIN']}>
                    <Activity />
                  </ProtectedRoute>
                }
              />
              <Route path="/rider/activity" element={<Navigate to="/activity" replace />} />
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <Account />
                  </ProtectedRoute>
                }
              />
              <Route path="/rider/account" element={<Navigate to="/account" replace />} />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/book"
                element={
                  <ProtectedRoute allowedRoles={['RIDER', 'ADMIN']}>
                    <BookRide />
                  </ProtectedRoute>
                }
              />
              <Route path="/rides" element={<Navigate to="/activity" replace />} />
              <Route
                path="/rides/:id"
                element={
                  <ProtectedRoute>
                    <RideDetails />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/driver/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['DRIVER', 'ADMIN']}>
                    <DriverDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
