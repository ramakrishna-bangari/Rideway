import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';

export const Home = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const navigate = useNavigate();

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('AUTO');

  const cachedRole = typeof window !== 'undefined' ? (localStorage.getItem('rideway_user_role') || '').trim().toUpperCase() : '';
  const effectiveRole = (role || cachedRole || '').trim().toUpperCase();

  useEffect(() => {
    if (isAuthenticated && effectiveRole === 'DRIVER') {
      navigate('/driver/dashboard', { replace: true });
    } else if (isAuthenticated && effectiveRole === 'ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, effectiveRole, navigate]);

  if (isAuthenticated && (effectiveRole === 'DRIVER' || effectiveRole === 'ADMIN')) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-gray-500">
            Redirecting to {effectiveRole === 'DRIVER' ? 'Driver Dashboard' : 'Admin Operations'}...
          </p>
        </div>
      </div>
    );
  }

  const handleBookRedirect = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (effectiveRole === 'DRIVER') {
      navigate('/driver/dashboard');
      return;
    }
    if (effectiveRole === 'ADMIN') {
      navigate('/admin/dashboard');
      return;
    }
    navigate('/book', {
      state: {
        initialPickup: pickup,
        initialDestination: destination,
        initialVehicle: selectedVehicle,
      },
    });
  };

  const rideTypes = [
    {
      id: 'AUTO',
      name: 'Auto',
      icon: '🛺',
      capacity: '3 seats',
    },
    {
      id: 'MOTO',
      name: 'Bike',
      icon: '🏍️',
      capacity: '1 seat',
    },
    {
      id: 'CAB',
      name: 'Cab Mini',
      icon: '🚗',
      capacity: '4 seats',
    },
  ];

  return (
    <div className="w-full min-h-screen bg-white text-gray-950 font-sans antialiased flex flex-col justify-between selection:bg-black selection:text-white">

      <section className="w-full pt-8 sm:pt-16 pb-12 sm:pb-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-gray-950 leading-[1.1]">
              Go anywhere with RideWay
            </h1>
            <p className="text-base sm:text-lg text-gray-600 font-medium max-w-xl mx-auto leading-relaxed">
              Request in seconds, ride with verified drivers, and pay with ease.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xl shadow-black/5 space-y-5 text-left max-w-xl mx-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base sm:text-lg font-black text-gray-950">
                Request a ride
              </h2>
              <span className="text-[11px] sm:text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Available now
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {rideTypes.map((v) => {
                const isSelected = selectedVehicle === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicle(v.id)}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[64px] ${
                      isSelected
                        ? 'border-black bg-black text-white shadow-sm ring-2 ring-black/10'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <span className="text-2xl">{v.icon}</span>
                    <span className="text-xs font-bold">{v.name}</span>
                    <span className={`text-[10px] font-semibold ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                      {v.capacity}
                    </span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleBookRedirect} className="space-y-3.5 pt-1">
              <div className="relative flex items-center">
                <span className="absolute left-3.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <input
                  type="text"
                  placeholder="Enter pickup location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full pl-9 pr-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm sm:text-base font-medium text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                />
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-3.5 w-2.5 h-2.5 bg-black ring-4 ring-gray-100" />
                <input
                  type="text"
                  placeholder="Enter destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full pl-9 pr-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm sm:text-base font-medium text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-black text-white font-black text-sm sm:text-base hover:bg-neutral-800 active:scale-[0.99] transition shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <span>See prices</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="w-full pb-14 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-black text-white rounded-3xl p-7 sm:p-10 lg:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8 shadow-sm">
            <div className="space-y-2 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                Drive and earn with RideWay
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-medium">
                Drive your Auto, Bike, or Cab. Set your own schedule and earn on your own terms.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-shrink-0">
              <Link
                to="/register"
                className="px-6 py-3.5 rounded-xl bg-white text-black font-black text-xs sm:text-sm hover:bg-gray-100 transition text-center shadow-xs cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Sign Up to Drive
              </Link>
              <Link
                to="/login"
                className="px-5 py-3.5 rounded-xl border border-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-900 transition text-white text-center cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Partner Login
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
