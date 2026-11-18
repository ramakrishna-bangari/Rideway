import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ridesApi } from '../api/rides';
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  Phone,
} from 'lucide-react';

export const RiderDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeRide, setActiveRide] = useState(null);
  const [pastRides, setPastRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingRideId, setCancellingRideId] = useState(null);

  const fetchRiderData = async () => {
    const riderId = user?.id;
    if (!riderId) return;

    try {
      const history = await ridesApi.getRiderHistory(riderId);
      if (Array.isArray(history)) {
        setPastRides(history);
        const ongoing = history.find((r) =>
          ['REQUESTED', 'ACCEPTED', 'STARTED'].includes(r.status)
        );
        setActiveRide(ongoing || null);
      }
    } catch (err) {
      console.warn('Error loading rider dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderData();
    const interval = setInterval(fetchRiderData, 6000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCancelRide = async (rideId) => {
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    setCancellingRideId(rideId);
    try {
      await ridesApi.cancelRide(rideId);
      await fetchRiderData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel ride');
    } finally {
      setCancellingRideId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Finding Driver
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Driver Confirmed
          </span>
        );
      case 'STARTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            Trip in Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getVehicleMeta = (vehicleType) => {
    const type = (vehicleType || '').toUpperCase();
    if (type.includes('MOTO') || type.includes('BIKE')) {
      return { icon: '🏍️', name: 'Bike' };
    }
    if (type.includes('CAB') || type.includes('CAR')) {
      return { icon: '🚗', name: 'Cab' };
    }
    return { icon: '🛺', name: 'Auto' };
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-gray-950 py-8 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="w-full max-w-[1600px] mx-auto space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-gray-200/90 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-950">
              Welcome back, {user?.fullName || 'Rider'}!
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/activity"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-gray-100 text-gray-900 font-bold text-xs hover:bg-gray-200 transition shadow-xs whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Activity</span>
            </Link>

            <Link
              to="/book"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-black text-white font-black text-xs hover:bg-neutral-800 transition shadow-md whitespace-nowrap"
            >
              <span>Book a Ride</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {activeRide && (
          <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">
                  Active Ride
                </span>
                {getStatusBadge(activeRide.status)}
              </div>

              {['ACCEPTED', 'STARTED'].includes(activeRide.status) && activeRide.startOtp && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-bold text-gray-500">PIN:</span>
                  <span className="font-mono text-sm font-black text-gray-950">{activeRide.startOtp}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/rides/${activeRide.id}`)}
                  className="px-4 py-2 bg-black text-white text-xs font-black rounded-xl hover:bg-neutral-800 transition"
                >
                  Track Live
                </button>
                {activeRide.status === 'REQUESTED' && (
                  <button
                    onClick={() => handleCancelRide(activeRide.id)}
                    disabled={cancellingRideId === activeRide.id}
                    className="px-3 py-2 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-xl transition"
                  >
                    {cancellingRideId === activeRide.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Pickup</span>
                <p className="font-semibold text-gray-900 truncate">
                  {activeRide.pickupLocation?.address || 'Pickup point'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400">Destination</span>
                <p className="font-semibold text-gray-900 truncate">
                  {activeRide.destination?.address || 'Destination point'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="w-full">
          <div className="w-full bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-950">Ride History</h2>
              <span className="text-xs text-gray-500 font-medium">
                {pastRides.length} {pastRides.length === 1 ? 'ride' : 'rides'}
              </span>
            </div>

            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-black" />
                <span className="text-xs font-medium">Loading rides...</span>
              </div>
            ) : pastRides.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto text-xl">
                  🛺
                </div>
                <h3 className="text-sm font-bold text-gray-900">No rides yet</h3>
                <div>
                  <Link
                    to="/book"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black text-white text-xs font-black hover:bg-neutral-800 transition"
                  >
                    <span>Request a Ride</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pastRides.map((ride) => {
                  const vehicleMeta = getVehicleMeta(ride.vehicleType);
                  return (
                    <div
                      key={ride.id}
                      onClick={() => navigate(`/rides/${ride.id}`)}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 -mx-3 px-3 rounded-2xl transition cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0 border border-gray-200">
                          {vehicleMeta.icon}
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(ride.status)}
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {vehicleMeta.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {ride.createdAt
                                ? new Date(ride.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                                : 'Recent trip'}
                            </span>
                          </div>

                          <div className="space-y-0.5 text-xs">
                            <div className="flex items-center gap-1.5 text-gray-900 font-semibold truncate">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span className="truncate">{ride.pickupLocation?.address || 'Pickup'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-600 truncate">
                              <span className="w-2 h-2 rounded-none bg-black flex-shrink-0" />
                              <span className="truncate">{ride.destination?.address || 'Dropoff'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                        <span className="text-sm font-black text-gray-900">
                          {ride.price ? `₹${Math.round(ride.price)}` : '—'}
                        </span>
                        {ride.distanceKm && (
                          <span className="text-[11px] text-gray-400">
                            {ride.distanceKm} km
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;
