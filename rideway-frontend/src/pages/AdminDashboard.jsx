import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/admin';
import {
  Users,
  Car,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Power,
  ChevronRight,
  TrendingUp,
  Loader2,
} from 'lucide-react';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('drivers');
  const [driverFilter, setDriverFilter] = useState('ALL');

  const [analytics, setAnalytics] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [rides, setRides] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [driverPage, setDriverPage] = useState(1);
  const [riderPage, setRiderPage] = useState(1);
  const [ridePage, setRidePage] = useState(1);
  const adminPageSize = 8;

  const getVehicleIcon = (vehicleType) => {
    const type = (vehicleType || '').toUpperCase();
    if (type.includes('MOTO') || type.includes('BIKE')) return '🏍️';
    if (type.includes('CAB') || type.includes('CAR')) return '🚗';
    return '🛺';
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, driversRes, ridersRes, ridesRes] = await Promise.allSettled([
        adminApi.getAnalytics(),
        adminApi.getDrivers(),
        adminApi.getRiders(),
        adminApi.getRides(),
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value);
      }
      if (driversRes.status === 'fulfilled' && driversRes.value) {
        const raw = Array.isArray(driversRes.value) ? driversRes.value : driversRes.value?.content || [];
        setDrivers(Array.from(new Map(raw.map((d) => [d.id, d])).values()));
      }
      if (ridersRes.status === 'fulfilled' && ridersRes.value) {
        const raw = Array.isArray(ridersRes.value) ? ridersRes.value : ridersRes.value?.content || [];
        setRiders(Array.from(new Map(raw.map((r) => [r.id, r])).values()));
      }
      if (ridesRes.status === 'fulfilled' && ridesRes.value) {
        const raw = Array.isArray(ridesRes.value) ? ridesRes.value : ridesRes.value?.content || [];
        setRides(Array.from(new Map(raw.map((r) => [r.id || r.rideId, r])).values()));
      }
    } catch (err) {
      console.warn('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyDriver = async (driverId, status) => {
    setActionLoadingId(driverId);
    try {
      await adminApi.updateDriverVerification(driverId, status);
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, verificationStatus: status } : d))
      );

      const updatedAnalytics = await adminApi.getAnalytics();
      setAnalytics(updatedAnalytics);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update driver verification');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleRiderActive = async (riderId, currentActive) => {
    setActionLoadingId(riderId);
    try {
      await adminApi.updateRiderStatus(riderId, !currentActive);
      setRiders((prev) =>
        prev.map((r) => (r.id === riderId ? { ...r, active: !currentActive } : r))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle rider status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleDriverActive = async (driverId, currentActive) => {
    setActionLoadingId(driverId);
    try {
      await adminApi.updateDriverStatus(driverId, !currentActive);
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId ? { ...d, active: !currentActive } : d))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle driver status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const matchesFilter = driverFilter === 'ALL' || d.verificationStatus === driverFilter;
    const matchesSearch =
      searchTerm === '' ||
      d.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone?.includes(searchTerm) ||
      d.licenseNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalDriverPages = Math.max(1, Math.ceil(filteredDrivers.length / adminPageSize));
  const paginatedDrivers = filteredDrivers.slice((driverPage - 1) * adminPageSize, driverPage * adminPageSize);

  const totalRiderPages = Math.max(1, Math.ceil(riders.length / adminPageSize));
  const paginatedRiders = riders.slice((riderPage - 1) * adminPageSize, riderPage * adminPageSize);

  const totalRidePages = Math.max(1, Math.ceil(rides.length / adminPageSize));
  const paginatedRides = rides.slice((ridePage - 1) * adminPageSize, ridePage * adminPageSize);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-white transition-colors pb-16">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
              Manage drivers, riders, and platform rides.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-[#1e1e1e] text-sm font-semibold hover:bg-gray-50 dark:hover:bg-neutral-800 transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Passengers</span>
              <Users className="w-5 h-5" />
            </div>
            <p className="text-3xl sm:text-4xl font-black">{analytics?.totalRiders ?? riders.length}</p>
            <span className="text-xs text-emerald-500 font-semibold">Registered riders</span>
          </div>

          <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Drivers</span>
              <Car className="w-5 h-5" />
            </div>
            <p className="text-3xl sm:text-4xl font-black">{analytics?.totalDrivers ?? drivers.length}</p>
            <span className="text-xs text-blue-500 font-semibold">
              {analytics?.activeDrivers ?? 0} currently online
            </span>
          </div>

          <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center justify-between text-amber-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Verification</span>
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-amber-500">
              {analytics?.pendingVerifications ??
                drivers.filter((d) => d.verificationStatus === 'PENDING').length}
            </p>
            <span className="text-xs text-neutral-400 font-medium">Requires review</span>
          </div>

          <div className="bg-white dark:bg-[#1e1e1e] p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center justify-between text-emerald-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Platform Rides</span>
              <Activity className="w-5 h-5" />
            </div>
            <p className="text-3xl sm:text-4xl font-black">{analytics?.totalRides ?? rides.length}</p>
            <span className="text-xs text-emerald-500 font-semibold">Total rides</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-neutral-800 pb-3">
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'drivers'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
          >
            Drivers ({drivers.length})
          </button>

          <button
            onClick={() => setActiveTab('riders')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'riders'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
          >
            Riders ({riders.length})
          </button>

          <button
            onClick={() => setActiveTab('rides')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'rides'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800'
            }`}
          >
            Live Rides ({rides.length})
          </button>
        </div>

        {activeTab === 'drivers' && (
          <div className="space-y-4">

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setDriverFilter(st)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      driverFilter === st
                        ? 'bg-neutral-900 text-white dark:bg-neutral-200 dark:text-black'
                        : 'bg-white dark:bg-[#1e1e1e] text-gray-600 dark:text-neutral-400 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search driver by name, phone, license..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 text-gray-400 uppercase font-bold text-xs tracking-wider">
                    <tr>
                      <th className="w-[24%] py-3.5 px-6">Driver Partner</th>
                      <th className="w-[24%] py-3.5 px-6">Contact Info</th>
                      <th className="w-[18%] py-3.5 px-6">Driving License</th>
                      <th className="w-[12%] py-3.5 px-6">Status</th>
                      <th className="w-[11%] py-3.5 px-6">Account Active</th>
                      <th className="w-[11%] py-3.5 px-6 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
                    {filteredDrivers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                          No drivers match the current filter or search criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedDrivers.map((driver) => (
                        <tr key={driver.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40">
                          <td className="py-4 px-6 font-bold flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-sm">
                              {driver.fullName ? driver.fullName[0].toUpperCase() : 'D'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white text-sm">{driver.fullName}</p>
                              <p className="text-xs text-gray-400 font-mono">{driver.id?.slice(0, 8)}...</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <p className="text-gray-900 dark:text-white text-sm font-medium">{driver.email}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{driver.phone || '—'}</p>
                          </td>
                          <td className="py-4 px-6 font-mono font-semibold text-sm">
                            {driver.licenseNumber || 'PENDING_UPLOAD'}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                                driver.verificationStatus === 'APPROVED'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400'
                                  : driver.verificationStatus === 'REJECTED'
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-400'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400'
                              }`}
                            >
                              {driver.verificationStatus || 'PENDING'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <button
                              onClick={() => handleToggleDriverActive(driver.id, driver.active ?? true)}
                              disabled={actionLoadingId === driver.id}
                              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                                driver.active ?? true
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                              }`}
                            >
                              {driver.active ?? true ? 'Active' : 'Suspended'}
                            </button>
                          </td>
                          <td className="py-4 px-6 text-right space-x-2">
                            {driver.verificationStatus !== 'APPROVED' && (
                              <button
                                onClick={() => handleVerifyDriver(driver.id, 'APPROVED')}
                                disabled={actionLoadingId === driver.id}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                              >
                                Approve
                              </button>
                            )}
                            {driver.verificationStatus !== 'REJECTED' && (
                              <button
                                onClick={() => handleVerifyDriver(driver.id, 'REJECTED')}
                                disabled={actionLoadingId === driver.id}
                                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
                              >
                                Reject
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalDriverPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-neutral-800 text-xs">
                  <span className="text-gray-500 font-medium">
                    Page <strong className="text-gray-900 dark:text-white">{driverPage}</strong> of <strong className="text-gray-900 dark:text-white">{totalDriverPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDriverPage((p) => Math.max(1, p - 1))}
                      disabled={driverPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold transition disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriverPage((p) => Math.min(totalDriverPages, p + 1))}
                      disabled={driverPage === totalDriverPages}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold transition disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'riders' && (
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 text-gray-400 uppercase font-bold text-xs tracking-wider">
                  <tr>
                    <th className="w-[28%] py-3.5 px-6">Passenger Name</th>
                    <th className="w-[28%] py-3.5 px-6">Email Address</th>
                    <th className="w-[18%] py-3.5 px-6">Phone Number</th>
                    <th className="w-[13%] py-3.5 px-6">Account Status</th>
                    <th className="w-[13%] py-3.5 px-6 text-right">Access Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
                  {riders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                        No registered riders found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRiders.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40">
                        <td className="py-4 px-6 font-bold flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                            {r.fullName ? r.fullName[0].toUpperCase() : 'R'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{r.fullName}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.id?.slice(0, 8)}...</p>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium">{r.email}</td>
                        <td className="py-4 px-6 font-mono text-sm">{r.phone || '—'}</td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                              r.active ?? true
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
                            }`}
                          >
                            {r.active ?? true ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleToggleRiderActive(r.id, r.active ?? true)}
                            disabled={actionLoadingId === r.id}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                              r.active ?? true
                                ? 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-950/60 dark:text-red-400'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            }`}
                          >
                            {r.active ?? true ? 'Suspend Access' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalRiderPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-neutral-800 text-xs">
                <span className="text-gray-500 font-medium">
                  Page <strong className="text-gray-900 dark:text-white">{riderPage}</strong> of <strong className="text-gray-900 dark:text-white">{totalRiderPages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRiderPage((p) => Math.max(1, p - 1))}
                    disabled={riderPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold transition disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiderPage((p) => Math.min(totalRiderPages, p + 1))}
                    disabled={riderPage === totalRiderPages}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold transition disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rides' && (
          <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 text-gray-400 uppercase font-bold text-xs tracking-wider">
                  <tr>
                    <th className="w-[16%] py-3.5 px-6">Ride ID</th>
                    <th className="w-[26%] py-3.5 px-6">Pickup Route</th>
                    <th className="w-[26%] py-3.5 px-6">Destination</th>
                    <th className="w-[10%] py-3.5 px-6">Fare (INR)</th>
                    <th className="w-[11%] py-3.5 px-6">Current Status</th>
                    <th className="w-[11%] py-3.5 px-6">Dispatched At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
                  {rides.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                        No active or past rides dispatched on the platform.
                      </td>
                    </tr>
                  ) : (
                    paginatedRides.map((ride) => (
                      <tr key={ride.id || ride.rideId} className="hover:bg-gray-50/50 dark:hover:bg-neutral-800/40">
                        <td className="py-4 px-6 font-mono font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{getVehicleIcon(ride.vehicleType)}</span>
                            <span>{(ride.id || ride.rideId)?.slice(0, 8)}...</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 max-w-[200px] truncate text-sm">
                          {ride.pickupLocation?.address || 'Pickup Point'}
                        </td>
                        <td className="py-4 px-6 max-w-[200px] truncate font-semibold text-sm">
                          {ride.destination?.address || 'Destination Point'}
                        </td>
                        <td className="py-4 px-6 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{Math.round(Number(ride.finalFare || ride.price || ride.fare || 180))}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                              ride.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : ['IN_PROGRESS', 'STARTED'].includes(ride.status)
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                                : ride.status === 'CANCELLED'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            }`}
                          >
                            {ride.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-400 font-mono text-xs">
                          {ride.createdAt ? new Date(ride.createdAt).toLocaleString() : 'Just now'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalRidePages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-neutral-800 text-xs">
                <span className="text-gray-500 font-medium">
                  Page <strong className="text-gray-900 dark:text-white">{ridePage}</strong> of <strong className="text-gray-900 dark:text-white">{totalRidePages}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRidePage((p) => Math.max(1, p - 1))}
                    disabled={ridePage === 1}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold transition disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setRidePage((p) => Math.min(totalRidePages, p + 1))}
                    disabled={ridePage === totalRidePages}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-neutral-700 font-bold transition disabled:opacity-40"
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

export default AdminDashboard;
