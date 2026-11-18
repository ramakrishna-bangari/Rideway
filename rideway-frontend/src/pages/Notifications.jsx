import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { useAuth } from '../context/AuthContext';
import notificationWs from '../utils/websocket';
import {
  Bell,
  CheckCheck,
  Trash2,
  RefreshCw,
  ArrowRight,
  Clock,
  Car,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Inbox,
  Loader2,
} from 'lucide-react';

export const Notifications = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  const fetchList = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await notificationsApi.getNotifications({ page: 0, size: 50 });
      const list = Array.isArray(data) ? data : data?.content || data?.data || [];
      setNotifications(list);
    } catch (err) {
      console.warn('Could not fetch notifications:', err?.message);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchList();
    const timer = setInterval(() => fetchList(false), 5000);
    const unsubscribe = notificationWs.subscribe(() => {
      fetchList(false);
    });
    return () => {
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setActionNotice('All notifications marked as read.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;
    try {
      await notificationsApi.clearAll();
      setNotifications([]);
      setActionNotice('All notifications cleared.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      setNotifications([]);
    }
  };

  const handleMarkSingleRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const handleDeleteSingle = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  const handleItemClick = (item) => {
    if (!item.read) {
      handleMarkSingleRead(item.id, { stopPropagation: () => { } });
    }
    if (item.rideId) {
      navigate(`/rides/${item.rideId}`);
    } else if (role === 'DRIVER') {
      navigate('/driver/dashboard');
    } else {
      navigate('/activity');
    }
  };

  const getEventBadge = (eventType) => {
    switch (eventType) {
      case 'NEW_RIDE_OFFER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            Incoming Request
          </span>
        );
      case 'RIDE_ASSIGNED':
      case 'RIDE_ASSIGNMENT_CONFIRMED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200">
            Driver Confirmed
          </span>
        );
      case 'RIDE_STARTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
            Trip Started
          </span>
        );
      case 'RIDE_COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
            Completed
          </span>
        );
      case 'RIDE_CANCELLED':
      case 'RIDE_OFFER_CANCELLED':
      case 'NO_DRIVER_AVAILABLE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
            Notification
          </span>
        );
    }
  };

  const filteredList = notifications.filter((item) => {
    if (filter === 'UNREAD') return !item.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-gray-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/90 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-xs">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-950">Notifications</h1>
                <p className="text-xs text-gray-500 font-medium">
                  Live updates for ride bookings, driver offers, and trip alerts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => fetchList(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition shadow-xs"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-800 transition shadow-xs disabled:opacity-40 flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mark All Read</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              disabled={notifications.length === 0}
              className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 transition shadow-xs disabled:opacity-40 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${filter === 'ALL'
                ? 'bg-black text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-black'
              }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNREAD')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 ${filter === 'UNREAD'
                ? 'bg-black text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-black'
              }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-3xl p-12 border border-gray-200/90 text-center space-y-3 shadow-sm">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-black" />
              <p className="text-xs font-bold text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-gray-200/90 text-center space-y-3 shadow-sm">
              <Inbox className="w-10 h-10 mx-auto text-gray-300" />
              <h3 className="text-base font-bold text-gray-900">
                {filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {filter === 'UNREAD'
                  ? 'You are all caught up! Switch to All to see past alerts.'
                  : 'Trip alerts, ride confirmations, and booking status updates will show up here.'}
              </p>
            </div>
          ) : (
            filteredList.map((item) => {
              const itemId = item.id || item.notificationId;
              const isUnread = !item.read;

              return (
                <div
                  key={itemId || Math.random()}
                  onClick={() => handleItemClick(item)}
                  className={`bg-white rounded-3xl p-5 border transition shadow-xs cursor-pointer group hover:border-gray-400 ${isUnread
                      ? 'border-emerald-300 bg-emerald-50/20 shadow-sm'
                      : 'border-gray-200/90'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${isUnread
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                          }`}
                      >
                        <Car className="w-4 h-4" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getEventBadge(item.eventType)}
                          <span className="text-xs font-black text-gray-950">
                            {item.title || item.eventType || 'Ride Update'}
                          </span>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                          )}
                        </div>

                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                          {item.message || item.content || 'Tap to view details.'}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold pt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString([], {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                              : 'Recent'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkSingleRead(itemId, e)}
                          className="p-2 rounded-xl text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          title="Mark as read"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDeleteSingle(itemId, e)}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-700 hover:bg-red-50 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {item.rideId && (
                        <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-gray-800 group-hover:text-black pl-2">
                          <span>View Ride</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
