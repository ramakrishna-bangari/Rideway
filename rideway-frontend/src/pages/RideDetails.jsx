import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ridesApi } from '../api/rides';
import { driverApi } from '../api/driver';
import RideMap from '../components/Map';
import api from '../api/axios';
import { getDrivingRouteCoordinates, getMinimumDistanceToPolyline } from '../utils/geocoding';
import { useAuth } from '../context/AuthContext';
import notificationWs from '../utils/websocket';
import {
  Clock,
  CheckCircle2,
  Check,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Phone,
  ShieldCheck,
  Loader2,
  KeyRound,
  TrendingUp,
  User,
  Navigation,
  Compass,
  AlertCircle,
  CreditCard,
  Banknote,
} from 'lucide-react';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const earthRadius = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadius * c).toFixed(2));
}

function getEstimatedMinutes(distKm) {
  if (!distKm || distKm <= 0) return 1;
  const mins = Math.round((distKm / 25) * 60) + 1;
  return Math.max(1, mins);
}

export const RideDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { user, role, loading: authLoading } = useAuth();
  const savedRole = (typeof window !== 'undefined' ? localStorage.getItem('rideway_user_role') : '') || '';
  const userRole = (role || user?.role || savedRole || '').toUpperCase();
  const isRider = Boolean(ride?.riderId && user?.id && String(ride.riderId).toLowerCase() === String(user.id).toLowerCase());
  const isDriver = !isRider && (
    Boolean(ride?.driverId && user?.id && String(ride.driverId).toLowerCase() === String(user.id).toLowerCase()) ||
    userRole.includes('DRIVER')
  );

  const [cancelling, setCancelling] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [customBoost, setCustomBoost] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const [payment, setPayment] = useState(null);
  const [payingOnline, setPayingOnline] = useState(false);
  const [collectingCash, setCollectingCash] = useState(false);

  const [tripPin, setTripPin] = useState('');
  const [pinError, setPinError] = useState(null);
  const [isStartingRide, setIsStartingRide] = useState(false);
  const [isCompletingRide, setIsCompletingRide] = useState(false);

  const [driverPos, setDriverPos] = useState(() => {

    if (typeof window !== 'undefined' && localStorage.getItem('rideway_driver_lat')) {
      const lat = parseFloat(localStorage.getItem('rideway_driver_lat'));
      const lng = parseFloat(localStorage.getItem('rideway_driver_lng'));
      if (!isNaN(lat) && !isNaN(lng) && lat > 0) {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  });

  const [activeRouteCoords, setActiveRouteCoords] = useState(null);
  const [secondaryRouteCoords, setSecondaryRouteCoords] = useState(null);
  const [routingUnavailable, setRoutingUnavailable] = useState(false);
  const lastRecalculationTimeRef = useRef(0);

  const fetchRide = async () => {
    try {
      const data = await ridesApi.getRideById(id);
      if (data) {
        setRide((prev) => {
          if (!prev) return data;

          if ((prev.status === 'COMPLETED' || prev.status === 'CANCELLED') && data.status !== prev.status) {
            return { ...data, status: prev.status };
          }
          return data;
        });
        if (data?.paymentStatus === 'PAID') {
          setPayment((prev) => ({
            ...(prev || {}),
            paymentStatus: 'SUCCESS',
            paymentMethod: data.paymentMethod || prev?.paymentMethod || 'ONLINE',
          }));
        }
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to retrieve ride details');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayment = async () => {
    try {
      const res = await api.get(`/api/payments/ride/${id}`);
      if (res.data && res.data.paymentStatus) {
        setPayment(res.data);
        if (res.data.paymentStatus === 'SUCCESS') {
          setRide((prev) => (prev && prev.paymentStatus !== 'PAID' ? { ...prev, paymentStatus: 'PAID', paymentMethod: res.data.paymentMethod || prev.paymentMethod } : prev));
        }
      }
    } catch { }
  };

  useEffect(() => {
    if (id) {
      fetchRide();
      fetchPayment();
      api.post(`/api/dispatch/internal/ride-requested/${id}`).catch(() => { });

      let interval = null;
      if (ride?.status !== 'COMPLETED' && ride?.status !== 'CANCELLED') {
        interval = setInterval(() => {
          fetchRide();
          fetchPayment();
        }, 2500);
      }

      const unsubscribe = notificationWs.subscribe((notif) => {
        if (!notif?.rideId || String(notif.rideId) === String(id)) {
          fetchRide();
          fetchPayment();
          if (notif?.eventType === 'RIDE_ASSIGNED') {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(notif.title || 'Driver Assigned!', {
                body: notif.message,
                icon: '/favicon.ico',
              });
            }
          }
        }
      });

      return () => {
        if (interval) clearInterval(interval);
        if (unsubscribe) unsubscribe();
      };
    }
  }, [id, ride?.status]);

  useEffect(() => {
    if (isDriver || !ride?.driverId || !['ACCEPTED', 'STARTED'].includes(ride?.status)) {
      return;
    }

    const fetchDriverLocation = async () => {
      try {
        const res = await api.get(`/api/dispatch/drivers/${ride.driverId}/location`);
        if (res.data?.latitude && res.data?.longitude) {
          const lat = Number(res.data.latitude);
          const lng = Number(res.data.longitude);
          let valid = true;

          if (ride.pickupLocation?.latitude && ride.pickupLocation?.longitude) {
            const pLat = Number(ride.pickupLocation.latitude);
            const pLng = Number(ride.pickupLocation.longitude);
            const dist = getDistanceKm(lat, lng, pLat, pLng);
            if (dist > 100) valid = false;
          }
          if (valid) {
            setDriverPos({ latitude: lat, longitude: lng });
          }
        }
      } catch { }
    };

    fetchDriverLocation();
    const locPoll = setInterval(fetchDriverLocation, 2500);
    return () => clearInterval(locPoll);
  }, [isDriver, ride?.driverId, ride?.status, ride?.pickupLocation]);

  useEffect(() => {
    if (!ride) return;

    const pLat = ride.pickupLocation?.latitude ? Number(ride.pickupLocation.latitude) : null;
    const pLng = ride.pickupLocation?.longitude ? Number(ride.pickupLocation.longitude) : null;
    const dLat = ride.destination?.latitude ? Number(ride.destination.latitude) : null;
    const dLng = ride.destination?.longitude ? Number(ride.destination.longitude) : null;
    const dPosLat = driverPos?.latitude ? Number(driverPos.latitude) : null;
    const dPosLng = driverPos?.longitude ? Number(driverPos.longitude) : null;

    const computeRoadRoute = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastRecalculationTimeRef.current < 6000) {
        return;
      }

      if (ride.status === 'ACCEPTED') {

        if (dPosLat && dPosLng && pLat && pLng) {
          getDrivingRouteCoordinates(dPosLat, dPosLng, pLat, pLng).then((pts) => {
            if (pts && pts.length >= 2) {
              setActiveRouteCoords(pts);
              setRoutingUnavailable(false);
            }
          });
        } else if (pLat && pLng && dLat && dLng) {
          getDrivingRouteCoordinates(pLat, pLng, dLat, dLng).then((pts) => {
            if (pts && pts.length >= 2) setActiveRouteCoords(pts);
          });
        }

        if (pLat && pLng && dLat && dLng) {
          getDrivingRouteCoordinates(pLat, pLng, dLat, dLng).then((pts) => {
            if (pts && pts.length >= 2) {
              setSecondaryRouteCoords(pts);
            }
          });
        } else {
          setSecondaryRouteCoords(null);
        }
      } else if (ride.status === 'STARTED') {

        const fromLat = dPosLat || pLat;
        const fromLng = dPosLng || pLng;
        if (fromLat && fromLng && dLat && dLng) {
          getDrivingRouteCoordinates(fromLat, fromLng, dLat, dLng).then((pts) => {
            if (pts && pts.length >= 2) {
              setActiveRouteCoords(pts);
              setRoutingUnavailable(false);
            }
          });
        }
        setSecondaryRouteCoords(null);
      } else if (pLat && pLng && dLat && dLng) {

        getDrivingRouteCoordinates(pLat, pLng, dLat, dLng).then((pts) => {
          if (pts && pts.length >= 2) {
            setActiveRouteCoords(pts);
            setRoutingUnavailable(false);
          }
        });
        setSecondaryRouteCoords(null);
      }

      lastRecalculationTimeRef.current = Date.now();
    };

    computeRoadRoute(true);
  }, [ride?.status, ride?.pickupLocation, ride?.destination, driverPos?.latitude, driverPos?.longitude]);

  const targetLocation = useMemo(() => {
    if (ride?.status === 'ACCEPTED') return ride.pickupLocation;
    return ride?.destination;
  }, [ride?.status, ride?.pickupLocation, ride?.destination]);

  const distanceRemainingKm = useMemo(() => {
    if (!targetLocation?.latitude || !targetLocation?.longitude) return ride?.distanceKm || 0;
    if (!driverPos?.latitude || !driverPos?.longitude) return ride?.distanceKm || 0;
    return getDistanceKm(
      driverPos.latitude,
      driverPos.longitude,
      Number(targetLocation.latitude),
      Number(targetLocation.longitude)
    );
  }, [targetLocation, driverPos, ride?.distanceKm]);

  const etaMinutes = getEstimatedMinutes(distanceRemainingKm);

  const handleStartRide = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPin = tripPin.replace(/\D/g, '').trim();
    if (cleanPin.length !== 4) {
      setPinError('Please enter the 4-digit PIN provided by the rider.');
      return;
    }

    setIsStartingRide(true);
    setPinError(null);
    try {
      const updated = await ridesApi.startRide(id, cleanPin);
      setRide(updated || { ...ride, status: 'STARTED' });
      setTripPin('');
      api.post(`/api/dispatch/internal/ride-started/${id}`).catch(() => { });
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid PIN. Please check the code with the passenger.';
      setPinError(msg);
    } finally {
      setIsStartingRide(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!window.confirm('Confirm trip completion? Passenger has arrived at destination.')) return;
    setIsCompletingRide(true);

    setRide((prev) => prev ? { ...prev, status: 'COMPLETED', completedAt: new Date().toISOString() } : prev);
    try {
      const updated = await ridesApi.completeRide(id);
      if (updated) {
        setRide(updated);
      }

      api.post(`/api/dispatch/internal/ride-completed/${id}`).catch(() => { });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete ride');
      fetchRide();
    } finally {
      setIsCompletingRide(false);
    }
  };

  const handleCancelRide = async () => {
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    setCancelling(true);
    setRide((prev) => prev ? { ...prev, status: 'CANCELLED' } : prev);
    try {
      const who = isDriver ? 'DRIVER' : 'RIDER';
      await ridesApi.cancelRide(id);
      api.post(`/api/dispatch/internal/ride-cancelled/${id}?by=${who}`).catch(() => { });
      await fetchRide();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel ride');
    } finally {
      setCancelling(false);
    }
  };

  const handleBoostFare = async (amount) => {
    if (!amount || Number(amount) <= 0) return;
    setBoosting(true);
    try {
      const res = await api.patch(`/api/rides/${id}/price-increase`, {
        increaseAmount: Number(amount),
        amount: Number(amount),
      });
      const newPrice = res?.data?.price != null ? Number(res.data.price) : (Number(ride?.price || 0) + Number(amount));
      if (res?.data) {
        setRide((prev) => ({
          ...prev,
          ...res.data,
          price: newPrice,
        }));
      } else {
        setRide((prev) => ({
          ...prev,
          price: newPrice,
        }));
      }
      setToastMessage(`✓ Fare boosted by ₹${amount}! Guaranteed fare is now ₹${Math.round(newPrice)}`);
      try {
        await api.post(`/api/dispatch/internal/ride-boosted/${id}`);
      } catch { }
      await fetchRide();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Unable to boost fare');
    } finally {
      setBoosting(false);
    }
  };

  const handlePayOnline = async () => {
    if (!['STARTED', 'COMPLETED'].includes(ride?.status)) {
      alert('Payment can only be made after the ride starts or upon trip completion.');
      return;
    }
    setPayingOnline(true);
    try {
      const loadScript = () => {
        return new Promise((resolve) => {
          if (window.Razorpay) {
            resolve(true);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const loaded = await loadScript();
      if (!loaded) {
        alert('Payment gateway could not be loaded. Please check your network connection.');
        return;
      }

      const effectiveFare = fixedFare || Math.round(Number(ride.price || ride.fare || 50));
      const orderRes = await api.post('/api/payments/order', {
        rideId: id,
        riderId: user?.id,
        amount: effectiveFare,
        currency: 'INR',
      });
      const orderData = orderRes.data;

      const options = {
        key: orderData.keyId || '',
        amount: Math.round(Number(orderData.amount) * 100),
        currency: orderData.currency || 'INR',
        name: 'RideWay',
        description: `Ride #${String(id).slice(0, 8)} Payment`,
        order_id: (orderData.orderId && !orderData.orderId.startsWith('order_rzp_mock_')) ? orderData.orderId : undefined,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        handler: async function (response) {
          try {
            await api.post('/api/payments/verify', {
              rideId: id,
              razorpayOrderId: response.razorpay_order_id || orderData.orderId,
              razorpayPaymentId: response.razorpay_payment_id || ('pay_test_' + Date.now()),
              razorpaySignature: response.razorpay_signature || 'sig_test_ok',
            });

            try {
              await api.post(`/api/rides/${id}/payment-status`, {
                paymentStatus: 'PAID',
                paymentMethod: 'ONLINE',
              });
            } catch { }
            setPayment({ paymentStatus: 'SUCCESS', paymentMethod: 'ONLINE' });
            setRide((prev) => (prev ? { ...prev, paymentStatus: 'PAID', paymentMethod: 'ONLINE' } : null));
            alert('Online payment successful!');
            await fetchRide();
            await fetchPayment();
          } catch (err) {
            alert('Verification failed: ' + (err.response?.data?.message || err.message));
          }
        },
        prefill: {
          name: user?.fullName || ride?.riderName || 'Rider',
          email: user?.email || '',
          contact: user?.phone || ride?.riderPhone || '',
        },
        theme: {
          color: '#000000',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to initialize payment.');
    } finally {
      setPayingOnline(false);
    }
  };

  const handleCollectCash = async () => {
    const effectiveFare = fixedFare || Math.round(Number(ride.price || ride.fare || 0));
    if (!window.confirm(`Confirm collection of ₹${effectiveFare} cash from passenger?`)) return;
    setCollectingCash(true);
    try {
      await api.post('/api/payments/cash-collect', {
        rideId: id,
        driverId: user?.id,
        riderId: ride?.riderId,
        amountCollected: effectiveFare,
      });

      try {
        await api.post(`/api/rides/${id}/payment-status`, {
          paymentStatus: 'PAID',
          paymentMethod: 'CASH',
        });
      } catch { }
      setPayment({ paymentStatus: 'SUCCESS', paymentMethod: 'CASH' });
      setRide((prev) => (prev ? { ...prev, paymentStatus: 'PAID', paymentMethod: 'CASH' } : null));
      alert('Cash payment confirmed and recorded successfully!');
      await fetchRide();
      await fetchPayment();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record cash payment');
    } finally {
      setCollectingCash(false);
    }
  };

  const getVehicleMeta = (vehicleType) => {
    const type = (vehicleType || '').toUpperCase();
    if (type.includes('MOTO') || type.includes('BIKE')) return { icon: '🏍️', name: 'Bike' };
    if (type.includes('CAB') || type.includes('CAR')) return { icon: '🚗', name: 'Cab' };
    return { icon: '🛺', name: 'Auto' };
  };

  if (loading || authLoading || !ride) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500 bg-[#f8f9fa]">
        <Loader2 className="w-7 h-7 animate-spin text-black" />
        <span className="text-xs font-semibold">Loading live trip details...</span>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 bg-[#f8f9fa]">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {error || 'Ride information could not be found.'}
        </div>
        <button
          onClick={() => navigate(isDriver ? '/driver/dashboard' : '/activity')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isDriver ? 'Back to Driver Dashboard' : 'Back to Activity'}</span>
        </button>
      </div>
    );
  }

  const isFindingDriver = ride.status === 'REQUESTED';
  const isDriverAssigned = ride.status === 'ACCEPTED';
  const isInProgress = ride.status === 'STARTED';
  const isCompleted = ride.status === 'COMPLETED';
  const isCancelled = ride.status === 'CANCELLED';

  const getStatusDisplay = () => {
    if (isFindingDriver) {
      return {
        title: isDriver ? 'Ride Requested' : 'Finding Driver',
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    if (isDriverAssigned) {
      return {
        title: isDriver ? 'Heading to Passenger Pickup' : 'Driver Confirmed',
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    }
    if (isInProgress) {
      return {
        title: 'Trip in Progress',
        badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      };
    }
    if (isCompleted) {
      return {
        title: 'Trip Completed',
        badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
      };
    }
    return {
      title: 'Ride Cancelled',
      badgeColor: 'bg-red-50 text-red-800 border-red-200',
    };
  };

  const statusInfo = getStatusDisplay();
  const vehicleMeta = getVehicleMeta(ride.vehicleType);
  const fixedFare = ride.price != null ? Math.round(ride.price) : (ride.fare != null ? Math.round(ride.fare) : null);

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-gray-950 py-8 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="w-full max-w-[1600px] mx-auto space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate(isDriver ? '/driver/dashboard' : '/activity')}
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-black transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isDriver ? 'Back to Driver Dashboard' : 'Back to Activity'}</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchRide}
              className="p-2.5 rounded-2xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition shadow-xs"
              title="Refresh status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {((!isDriver && (isFindingDriver || isDriverAssigned)) || (isDriver && isDriverAssigned)) && (
              <button
                onClick={handleCancelRide}
                disabled={cancelling}
                className="px-4 py-2 text-xs font-bold rounded-2xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>{isDriver ? 'Cancel Trip' : 'Cancel Ride'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Ride #{String(ride.id).slice(0, 8)}
                  </span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-extrabold text-gray-900">
                    <span>{vehicleMeta.icon}</span>
                    <span>{vehicleMeta.name}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <h1 className="text-2xl font-black text-gray-950">
                    {statusInfo.title}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeColor}`}>
                    {ride.status}
                  </span>
                </div>
              </div>

              {toastMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-200">
                  <span>{toastMessage}</span>
                  <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-950 ml-2">✕</button>
                </div>
              )}

              {isDriver ? (
                <>

                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center font-bold text-sm">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Passenger</span>
                        <p className="font-bold text-sm text-gray-950">{ride.riderName || 'Passenger'}</p>
                        <p className="text-xs font-mono font-bold text-gray-700">
                          {ride.riderPhone || 'Mobile on trip'}
                        </p>
                      </div>
                    </div>

                    {ride.riderPhone ? (
                      <a
                        href={`tel:${ride.riderPhone}`}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Passenger</span>
                    )}
                  </div>

                  {isDriverAssigned && (
                    <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500 space-y-3.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-emerald-700" />
                          <span>Passenger Trip Start PIN</span>
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium">Ask passenger at pickup</span>
                      </div>

                      <form onSubmit={handleStartRide} className="flex items-center gap-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={tripPin}
                          onChange={(e) => {
                            setTripPin(e.target.value.replace(/\D/g, ''));
                            setPinError(null);
                          }}
                          placeholder="PIN"
                          disabled={isStartingRide}
                          className="w-32 py-3 px-3 text-center font-mono font-black text-xl tracking-[0.25em] rounded-xl bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black shadow-inner"
                        />

                        <button
                          type="submit"
                          disabled={isStartingRide || tripPin.replace(/\D/g, '').length !== 4}
                          className="flex-1 py-3 px-4 rounded-xl bg-black text-white font-black text-xs hover:bg-neutral-800 disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isStartingRide ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Starting...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span>START RIDE</span>
                            </>
                          )}
                        </button>
                      </form>

                      {pinError && (
                        <div className="p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>{pinError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {isInProgress && (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Passenger on board. Follow road navigation to dropoff destination.</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCompleteRide}
                        disabled={isCompletingRide || !(payment?.paymentStatus === 'SUCCESS' || ride?.paymentStatus === 'PAID')}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition shadow-md flex items-center justify-center gap-2 ${(payment?.paymentStatus === 'SUCCESS' || ride?.paymentStatus === 'PAID')
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-500/20'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300 opacity-75'
                          }`}
                      >
                        {isCompletingRide ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                            <span>Completing Trip...</span>
                          </>
                        ) : (payment?.paymentStatus === 'SUCCESS' || ride?.paymentStatus === 'PAID') ? (
                          <>
                            <Check className="w-5 h-5 text-white" />
                            <span>COMPLETE TRIP (Payment Verified)</span>
                          </>
                        ) : (
                          <span>COMPLETE TRIP (Awaiting Payment)</span>
                        )}
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-3 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <div>
                        <h3 className="text-base font-black text-gray-950">Trip Completed Successfully!</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Fare has been credited to your daily driver earnings.</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-gray-200 text-center">
                        <span className="text-[11px] text-gray-500 font-bold block uppercase">Earned Fare</span>
                        <span className="text-2xl font-black text-emerald-700 font-mono">
                          {fixedFare != null ? `₹${fixedFare}` : 'Fare pending'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/driver/dashboard')}
                        className="w-full py-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs transition"
                      >
                        Return to Driver Dashboard
                      </button>
                    </div>
                  )}
                </>
              ) : (

                <>

                  {(isDriverAssigned || isInProgress) && ride.startOtp && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          Trip Start PIN
                        </span>
                        <p className="text-2xl font-mono font-black text-gray-950 tracking-widest mt-0.5">
                          {ride.startOtp}
                        </p>
                      </div>
                      <span className="text-[11px] text-emerald-800 max-w-[140px] text-right font-medium">
                        Share PIN with driver to start ride
                      </span>
                    </div>
                  )}

                  {(ride.driverId || isDriverAssigned || isInProgress) && (
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                        Assigned Driver Partner
                      </span>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-black text-white overflow-hidden flex items-center justify-center font-bold text-xl border border-gray-200 shadow-xs">
                            {ride.driverProfilePictureUrl ? (
                              <img
                                src={ride.driverProfilePictureUrl}
                                alt={ride.driverName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{vehicleMeta.icon}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-900">{ride.driverName || 'Driver Partner'}</p>
                            <p className="text-xs font-mono text-gray-700 font-bold">
                              {ride.driverPhone || 'Verified Partner'}
                            </p>
                            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                              {vehicleMeta.name} • <span className="font-mono font-bold text-gray-900">{ride.driverVehicleNumber || ride.driverLicenseNumber || 'Registered'}</span>
                            </p>
                          </div>
                        </div>

                        {ride.driverPhone ? (
                          <a
                            href={`tel:${ride.driverPhone}`}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Assigned</span>
                        )}
                      </div>
                    </div>
                  )}

                  {isFindingDriver && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3.5">
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                      </span>
                      <div className="text-xs text-amber-900">
                        <p className="font-bold">Searching for nearby {vehicleMeta?.name || 'drivers'}...</p>
                      </div>
                    </div>
                  )}

                  {isFindingDriver && (
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          Boost Fare to Get a Driver Faster
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[5, 10, 20].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleBoostFare(amt)}
                            disabled={boosting}
                            className="py-2 rounded-xl bg-white border border-gray-200 hover:bg-black hover:text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                          >
                            +₹{amt}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">₹</span>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            placeholder="Custom amount"
                            value={customBoost}
                            onChange={(e) => setCustomBoost(e.target.value)}
                            className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-black"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={boosting || !customBoost || Number(customBoost) <= 0}
                          onClick={() => {
                            const amt = Number(customBoost);
                            if (amt > 0) {
                              handleBoostFare(amt);
                              setCustomBoost('');
                            }
                          }}
                          className="px-4 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 disabled:opacity-40 transition shadow-xs"
                        >
                          Boost
                        </button>
                      </div>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500 space-y-3.5 text-center shadow-xs">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-gray-950">Trip Completed!</h3>
                        <p className="text-xs text-gray-600 mt-0.5">Hope you had a smooth ride with RideWay.</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-white border border-gray-200 text-center">
                        <span className="text-[11px] text-gray-500 font-bold block uppercase tracking-wide">Total Fare Paid</span>
                        <span className="text-2xl font-black text-emerald-700 font-mono">
                          ₹{fixedFare || ride.price}
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          {ride.paymentMethod === 'ONLINE' ? 'Paid Online via Razorpay' : 'Paid in Cash'}
                        </span>
                      </div>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => navigate('/book')}
                          className="w-full py-3.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                        >
                          Book Another Ride
                        </button>
                      </div>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-3.5 text-center shadow-xs">
                      <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-gray-950">
                          {!ride.driverId ? 'No Drivers Available Right Now' : 'Ride Cancelled'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
                          {!ride.driverId
                            ? 'All nearby drivers were busy or no matching drivers were nearby. We apologize for the wait.'
                            : 'This ride request has been cancelled.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate('/book')}
                          className="flex-1 py-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                        >
                          Book Again
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/activity')}
                          className="py-3 px-4 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition cursor-pointer shadow-xs"
                        >
                          View Activity
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                    <div className="w-0.5 h-7 bg-gray-200 my-0.5" />
                    <span className="w-2.5 h-2.5 rounded-xs bg-black" />
                  </div>
                  <div className="flex-1 space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pickup</span>
                      <p className="font-semibold text-gray-900 leading-snug">
                        {ride.pickupLocation?.address || 'Pickup point'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Destination</span>
                      <p className="font-semibold text-gray-900 leading-snug">
                        {ride.destination?.address || 'Destination point'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ride.paymentMethod === 'ONLINE' ? (
                      <CreditCard className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Banknote className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="text-xs font-black text-gray-950 uppercase tracking-wide">
                      {ride.paymentMethod === 'ONLINE' ? 'Online Payment' : 'Cash Payment'}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${(payment?.paymentStatus === 'SUCCESS' || ride?.paymentStatus === 'PAID')
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                    {(payment?.paymentStatus === 'SUCCESS' || ride?.paymentStatus === 'PAID') ? 'PAID' : 'PENDING'}
                  </span>
                </div>

                {isDriver && (
                  <div>
                    {(payment?.paymentStatus === 'SUCCESS' || ride?.paymentStatus === 'PAID') ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Payment of ₹{fixedFare || ride.price} confirmed ({payment?.paymentMethod || ride?.paymentMethod || 'Online'}). You can now complete the trip!</span>
                      </div>
                    ) : (isInProgress || isCompleted) ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handleCollectCash}
                          disabled={collectingCash}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {collectingCash ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Confirming...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 text-white" />
                              <span>Confirm Cash Payment (₹{fixedFare || ride.price})</span>
                            </>
                          )}
                        </button>
                        <p className="text-[10px] text-gray-500 text-center font-medium">
                          Use this if passenger pays cash directly to you.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-gray-100 text-gray-500 text-xs font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>Collect cash from passenger upon arrival.</span>
                      </div>
                    )}
                  </div>
                )}

                {!isDriver && (
                  <div>
                    {(payment?.paymentStatus === 'SUCCESS' || ride.paymentStatus === 'PAID') ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Payment completed successfully.</span>
                      </div>
                    ) : (isInProgress || isCompleted) ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handlePayOnline}
                          disabled={payingOnline}
                          className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {payingOnline ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Opening Payment...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 text-emerald-400" />
                              <span>Pay ₹{fixedFare || ride.price} with Razorpay</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>Online payment unlocks once your ride starts or upon trip completion.</span>
                      </div>
                    )}
                  </div>
                )}

                {!isDriver && (ride.paymentMethod === 'CASH' || !ride.paymentMethod) && (
                  <p className="text-[11px] text-gray-500 font-medium">
                    Please pay ₹{fixedFare || ride.price} in cash to the driver upon trip completion.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[10px] block tracking-wider">Agreed Fare</span>
                  <span className="text-xl font-black text-gray-950 font-mono">
                    {fixedFare != null ? `₹${fixedFare}` : 'Fare pending'}
                  </span>
                  <span className="text-[10px] text-gray-400 block">Guaranteed fixed rate</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 font-bold uppercase text-[10px] block tracking-wider">Trip Distance</span>
                  <span className="text-sm font-black text-gray-900 font-mono">
                    {Number(ride.distanceKm || 0).toFixed(1)} km
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-3">

            {['ACCEPTED', 'STARTED'].includes(ride.status) && (
              <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-xs flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span className="font-bold text-gray-900">
                    {ride.status === 'ACCEPTED' ? 'Navigation to Pickup Point' : 'Navigation to Final Destination'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-700">~{distanceRemainingKm} km remaining</span>
                  <span>•</span>
                  <span className="font-black text-emerald-700">ETA ~{etaMinutes} min</span>
                </div>
              </div>
            )}

            {routingUnavailable && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Calculating fastest route... Live markers remain active on the map.</span>
              </div>
            )}

            <RideMap
              pickup={ride.pickupLocation}
              destination={ride.destination}
              driverLocation={['ACCEPTED', 'STARTED'].includes(ride.status) ? driverPos : null}
              routeCoordinates={activeRouteCoords}
              routeColor={ride.status === 'ACCEPTED' ? '#2563eb' : '#10b981'}
              secondaryRouteCoordinates={secondaryRouteCoords}
              secondaryRouteColor="#10b981"
              secondaryRouteDashed={true}
              className="h-[520px] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RideDetails;
