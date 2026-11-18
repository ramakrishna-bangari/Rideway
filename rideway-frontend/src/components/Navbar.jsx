import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../api/notifications';
import {
  Menu,
  X,
  LogOut,
  ShieldCheck,
  User,
  Bell,
  Clock,
  Car,
} from 'lucide-react';

export const Navbar = () => {
  const { user, role, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const loadNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const data = await notificationsApi.getNotifications();
      const list = Array.isArray(data) ? data : data?.content || data?.data || [];
      setNotifications(list);
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => { });
      }

      const pollUnread = () => {
        notificationsApi.getUnreadCount().then((count) => {
          setUnreadCount(typeof count === 'number' ? count : (count?.unreadCount || 0));
        }).catch(() => { });
      };

      pollUnread();
      const interval = setInterval(pollUnread, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const handleNotificationClick = async (notif) => {
    try {
      if (notif.id) await notificationsApi.markAsRead(notif.id);
    } catch { }

    setShowNotifications(false);
    setUnreadCount((prev) => Math.max(0, prev - 1));

    if (notif.rideId) {
      navigate(`/rides/${notif.rideId}`);
    } else if (role === 'DRIVER') {
      navigate('/driver/dashboard');
    } else {
      navigate('/activity');
    }
  };

  const handleDirectSignOut = async () => {
    const confirmLogout = window.confirm('Are you sure you want to sign out of RideWay?');
    if (!confirmLogout) {
      return;
    }

    try {
      setShowNotifications(false);
      setMobileMenuOpen(false);
      await logout();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { }
      navigate('/', { replace: true });
    }
  };

  const isActive = (path) => {
    if (path === '/activity' && (location.pathname === '/activity' || location.pathname === '/rider/dashboard')) {
      return true;
    }
    return location.pathname === path;
  };

  const getLogoPath = () => {
    if (!isAuthenticated) return '/';
    if (role === 'DRIVER') return '/driver/dashboard';
    if (role === 'ADMIN') return '/admin/dashboard';
    return '/book';
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs">
        <div className="w-full px-4 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to={getLogoPath()} className="flex items-center gap-2.5 flex-shrink-0 group">
                <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white font-black text-lg shadow-sm transition-transform group-hover:scale-105">
                  R
                </div>
                <span className="text-xl font-black tracking-tight text-gray-950">
                  Ride<span className="text-emerald-600 font-extrabold">Way</span>
                </span>
              </Link>

              {isAuthenticated && (
                <nav className="hidden md:flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  {role === 'RIDER' && (
                    <>
                      <Link
                        to="/book"
                        className={`px-3.5 py-1.5 rounded-xl transition ${isActive('/book')
                            ? 'bg-gray-100 text-black font-black'
                            : 'hover:text-black hover:bg-gray-50'
                          }`}
                      >
                        Ride
                      </Link>
                      <Link
                        to="/activity"
                        className={`px-3.5 py-1.5 rounded-xl transition ${isActive('/activity')
                            ? 'bg-gray-100 text-black font-black'
                            : 'hover:text-black hover:bg-gray-50'
                          }`}
                      >
                        Activity
                      </Link>
                    </>
                  )}

                  {role === 'DRIVER' && (
                    <Link
                      to="/driver/dashboard"
                      className={`px-3.5 py-1.5 rounded-xl transition ${isActive('/driver/dashboard')
                          ? 'bg-gray-100 text-black font-black'
                          : 'hover:text-black hover:bg-gray-50'
                        }`}
                    >
                      Driver Dashboard
                    </Link>
                  )}

                  {role === 'ADMIN' && (
                    <Link
                      to="/admin/dashboard"
                      className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${isActive('/admin/dashboard')
                          ? 'bg-gray-100 text-black font-black'
                          : 'hover:text-black hover:bg-gray-50'
                        }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Admin Dashboard</span>
                    </Link>
                  )}
                </nav>
              )}
            </div>

            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (!showNotifications) loadNotifications();
                      }}
                      className="p-2.5 rounded-2xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 hover:text-black transition relative shadow-xs"
                      title="Notifications"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-3xl shadow-2xl p-4 z-50 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <span className="text-xs font-black uppercase tracking-wider text-gray-950">
                            Notifications {unreadCount > 0 && `(${unreadCount} new)`}
                          </span>
                          <button
                            onClick={() => setShowNotifications(false)}
                            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-black"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {loadingNotifications ? (
                          <div className="py-8 text-center text-xs text-gray-400 font-semibold">
                            Loading notifications...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="py-8 text-center text-xs text-gray-400 space-y-2">
                            <Bell className="w-6 h-6 mx-auto text-gray-300" />
                            <p>No new notifications</p>
                          </div>
                        ) : (
                          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 space-y-1">
                            {notifications.map((item) => (
                              <div
                                key={item.id || item.notificationId || Math.random()}
                                onClick={() => handleNotificationClick(item)}
                                className={`p-3 rounded-2xl cursor-pointer transition text-left space-y-1 ${!item.read ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-gray-50'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-950 truncate max-w-[200px]">
                                    {item.title || item.eventType || 'Ride Notification'}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-semibold">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-2">
                                  {item.message || item.content || 'Tap to view trip details.'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await notificationsApi.markAllAsRead();
                                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                                setUnreadCount(0);
                              } catch { }
                            }}
                            className="text-[11px] font-bold text-gray-500 hover:text-black"
                          >
                            Mark all read
                          </button>
                          <Link
                            to="/notifications"
                            onClick={() => setShowNotifications(false)}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            View all →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    to="/account"
                    className="flex items-center gap-3 p-1.5 pr-3 rounded-2xl border border-gray-200/90 hover:border-gray-300 bg-gray-50/80 hover:bg-gray-100 transition group"
                  >
                    {user?.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt="Avatar"
                        className="w-8 h-8 rounded-xl object-cover border border-gray-200 group-hover:border-gray-400 transition"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center text-xs font-bold">
                        {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
                      </div>
                    )}

                    <div className="text-left">
                      <p className="text-xs font-bold text-gray-950 leading-tight truncate max-w-[140px]">
                        {user?.fullName || user?.email?.split('@')[0]}
                      </p>
                      <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                        {role}
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={handleDirectSignOut}
                    className="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition rounded-xl border border-red-200 flex items-center gap-1.5 cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/book"
                    className="text-xs font-bold text-gray-700 hover:text-black px-3 py-2 transition"
                  >
                    Book a Ride
                  </Link>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-xs font-bold text-gray-900 hover:text-black transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 transition shadow-sm"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/notifications"
                    className="p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition relative"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="p-2 rounded-xl text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-900 border border-gray-200 hover:bg-gray-50 transition"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-black hover:bg-neutral-800 transition shadow-xs"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 transition-opacity duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed top-0 right-0 bottom-0 z-50 h-full w-[82%] max-w-[320px] bg-white text-gray-900 shadow-2xl flex flex-col justify-between p-5 overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm">
                    R
                  </div>
                  <span className="text-lg font-black tracking-tight text-gray-950">
                    Ride<span className="text-emerald-600 font-extrabold">Way</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-black hover:bg-gray-100 transition cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isAuthenticated && (
                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
                  {user?.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt="Avatar"
                      className="w-11 h-11 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center text-sm font-black shadow-xs">
                      {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-gray-950">
                      {user?.fullName || user?.email?.split('@')[0]}
                    </p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                      {role}
                    </span>
                  </div>
                </div>
              )}

              <nav className="space-y-1">
                {role === 'RIDER' && (
                  <>
                    <Link
                      to="/book"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/book')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <Car className="w-4 h-4 text-gray-500" />
                      <span>Ride</span>
                    </Link>
                    <Link
                      to="/activity"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/activity')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>Activity</span>
                    </Link>
                    <Link
                      to="/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/notifications')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-gray-500" />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/account')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <User className="w-4 h-4 text-gray-500" />
                      <span>Account</span>
                    </Link>
                  </>
                )}

                {role === 'DRIVER' && (
                  <>
                    <Link
                      to="/driver/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/driver/dashboard')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <Car className="w-4 h-4 text-gray-500" />
                      <span>Driver Dashboard</span>
                    </Link>
                    <Link
                      to="/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/notifications')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-gray-500" />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/account')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <User className="w-4 h-4 text-gray-500" />
                      <span>Account</span>
                    </Link>
                  </>
                )}

                {role === 'ADMIN' && (
                  <>
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/admin/dashboard')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Admin Dashboard</span>
                    </Link>
                    <Link
                      to="/book"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/book')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <Car className="w-4 h-4 text-gray-500" />
                      <span>Book a Ride</span>
                    </Link>
                    <Link
                      to="/activity"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/activity')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>Activity</span>
                    </Link>
                    <Link
                      to="/notifications"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/notifications')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-gray-500" />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 py-3 px-3.5 rounded-xl text-sm font-bold transition ${
                        isActive('/account')
                          ? 'bg-gray-100 text-black font-black'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                      }`}
                    >
                      <User className="w-4 h-4 text-gray-500" />
                      <span>Account</span>
                    </Link>
                  </>
                )}
              </nav>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleDirectSignOut}
                className="w-full py-3 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center gap-2 border border-red-200 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
