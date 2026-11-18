import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ridesApi } from '../api/rides';
import {
  Clock,
  ArrowRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  KeyRound,
} from 'lucide-react';

export const Activity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rides, setRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchRiderActivity = async () => {
    const riderId = user?.id;
    if (!riderId) return;

    try {
      const history = await ridesApi.getRiderHistory(riderId);
      if (Array.isArray(history)) {

        const unique = Array.from(new Map(history.map((r) => [r.id, r])).values());
        setRides(unique);
        const ongoing = unique.find((r) =>
          ['REQUESTED', 'ACCEPTED', 'STARTED'].includes(r.status)
        );
        setActiveRide(ongoing || null);
      }
    } catch (err) {
      console.warn('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiderActivity();
    const interval = setInterval(fetchRiderActivity, 6000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCancelRide = async (e, rideId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;

    setCancellingId(rideId);
    setActionMessage(null);
    try {
      await ridesApi.cancelRide(rideId);
      setActionMessage('Ride cancelled.');
      await fetchRiderActivity();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel ride');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredRides = rides.filter((ride) => {
    if (filter === 'ALL') return true;
    return ride.status === filter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRides.length / itemsPerPage));
  const paginatedRides = filteredRides.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" />
            Cancelled
          </span>
        );
      case 'STARTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            Trip in progress
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Driver arriving
          </span>
        );
      case 'REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Finding driver
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
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-gray-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950">
              Activity
            </h1>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="w-10 h-10 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 hover:text-black transition shadow-xs"
              title="Filter"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl py-2 z-20 text-xs text-gray-700 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    setFilter('ALL');
                    setShowFilterMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 font-bold ${
                    filter === 'ALL' ? 'text-black bg-gray-100' : 'text-gray-700'
                  }`}
                >
                  All Rides
                </button>
                <button
                  onClick={() => {
                    setFilter('COMPLETED');
                    setShowFilterMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 font-bold ${
                    filter === 'COMPLETED' ? 'text-black bg-gray-100' : 'text-gray-700'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => {
                    setFilter('CANCELLED');
                    setShowFilterMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 font-bold ${
                    filter === 'CANCELLED' ? 'text-black bg-gray-100' : 'text-gray-700'
                  }`}
                >
                  Cancelled
                </button>
              </div>
            )}
          </div>
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-800">
              Dismiss
            </button>
          </div>
        )}

        {activeRide && (
          <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl flex-shrink-0">
                  {getVehicleMeta(activeRide.vehicleType).icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Active Ride #{String(activeRide.id).slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      {getVehicleMeta(activeRide.vehicleType).name}
                    </span>
                  </div>
                  <div className="mt-1">{getStatusBadge(activeRide.status)}</div>
                </div>
              </div>

              {['ACCEPTED', 'STARTED'].includes(activeRide.status) && activeRide.startOtp && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-bold text-gray-500">PIN:</span>
                  <span className="font-mono text-sm font-black text-gray-950">{activeRide.startOtp}</span>
                </div>
              )}

              <div className="flex items-center gap-2 self-end sm:self-center">
                {activeRide.status === 'REQUESTED' && (
                  <button
                    onClick={(e) => handleCancelRide(e, activeRide.id)}
                    disabled={cancellingId === activeRide.id}
                    className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {cancellingId === activeRide.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Cancelling...</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Ride</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => navigate(`/rides/${activeRide.id}`)}
                  className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Track Live</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-700 space-y-1.5 pt-3 border-t border-gray-100">
              <p className="truncate">
                <strong className="text-gray-950 font-bold">Pickup:</strong>{' '}
                {activeRide.pickupLocation?.address || 'Pickup point'}
              </p>
              <p className="truncate">
                <strong className="text-gray-950 font-bold">Destination:</strong>{' '}
                {activeRide.destination?.address || 'Destination point'}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-950">Past Trips</h2>
          <span className="text-xs text-gray-500 font-semibold">
            {filteredRides.length} {filteredRides.length === 1 ? 'trip' : 'trips'}
          </span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin text-black" />
            <span className="text-xs font-semibold">Loading activity...</span>
          </div>
        ) : filteredRides.length === 0 ? (
          <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-gray-200/90 p-8 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto text-xl">
              🛺
            </div>
            <p className="text-base font-bold text-gray-950">
              No recent activity
            </p>
            <div>
              <button
                onClick={() => navigate('/book')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-black text-white font-bold text-xs hover:bg-neutral-800 transition shadow-md"
              >
                <span>Request a Ride</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedRides.map((ride) => {
              const vehicleMeta = getVehicleMeta(ride.vehicleType);
              return (
                <div
                  key={ride.id}
                  onClick={() => navigate(`/rides/${ride.id}`)}
                  className="p-4 sm:p-5 rounded-3xl bg-white hover:bg-gray-50 border border-gray-200/90 hover:border-gray-300 shadow-sm transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform border border-gray-200">
                      {vehicleMeta.icon}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-950">
                          {ride.createdAt
                            ? new Date(ride.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Trip'}
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {vehicleMeta.name}
                        </span>
                        {getStatusBadge(ride.status)}
                      </div>

                      <div className="text-xs text-gray-500 space-y-0.5 truncate">
                        <p className="truncate text-gray-800 font-medium">
                          {ride.pickupLocation?.address || 'Pickup point'}
                        </p>
                        <p className="truncate text-gray-500">
                          → {ride.destination?.address || 'Destination point'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0 gap-2">
                    <span className="text-base font-black text-gray-950">
                      {ride.price ? `₹${Math.round(ride.price)}` : '—'}
                    </span>

                    <div className="flex items-center gap-2">
                      {['REQUESTED', 'ACCEPTED'].includes(ride.status) && (
                        <button
                          type="button"
                          onClick={(e) => handleCancelRide(e, ride.id)}
                          disabled={cancellingId === ride.id}
                          className="px-3 py-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold border border-red-200 transition flex items-center gap-1 disabled:opacity-50"
                        >
                          {cancellingId === ride.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Cancelling...</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Cancel</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200/90 text-xs shadow-xs">
                <span className="text-gray-500 font-medium">
                  Page <strong className="text-gray-900 font-bold">{currentPage}</strong> of <strong className="text-gray-900 font-bold">{totalPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Activity;
