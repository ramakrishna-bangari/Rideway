import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { driverApi } from '../api/driver';
import { ridesApi } from '../api/rides';
import api from '../api/axios';
import RideMap from '../components/Map';
import { getDrivingRouteCoordinates } from '../utils/geocoding';
import notificationWs from '../utils/websocket';
import {
  Power,
  Navigation,
  CheckCircle2,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Phone,
  ShieldCheck,
  KeyRound,
  User,
  Bell,
  Clock,
  Car,
  X,
  Crosshair,
  Settings,
  Route,
  Compass,
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

export const DriverDashboard = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [onlineStatus, setOnlineStatus] = useState('OFFLINE');
  const isOnline = onlineStatus === 'AVAILABLE' || onlineStatus === 'RESERVED' || onlineStatus === 'BUSY';
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [activeTrip, setActiveTrip] = useState(null);
  const [pendingTrip, setPendingTrip] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(60);

  const [driverVehicle, setDriverVehicle] = useState(() => {
    return user?.vehicleType || localStorage.getItem('rideway_driver_vehicle_type') || 'AUTO';
  });

  useEffect(() => {
    if (user?.vehicleType) {
      const v = String(user.vehicleType).toUpperCase();
      setDriverVehicle(v);
      localStorage.setItem('rideway_driver_vehicle_type', v);
    }
  }, [user?.vehicleType]);

  const isManualPinRef = useRef(
    typeof window !== 'undefined' && localStorage.getItem('rideway_driver_is_manual_pin') === 'true'
  );

  const [driverPos, setDriverPos] = useState(() => {
    const cachedLat = localStorage.getItem('rideway_driver_lat');
    const cachedLng = localStorage.getItem('rideway_driver_lng');
    if (cachedLat && cachedLng) {
      const lat = parseFloat(cachedLat);
      const lng = parseFloat(cachedLng);
      if (!isNaN(lat) && !isNaN(lng) && lat > 0) {
        return { latitude: lat, longitude: lng };
      }
    }
    return { latitude: 17.9784, longitude: 79.5941 };
  });

  const driverPosRef = useRef(driverPos);
  useEffect(() => {
    driverPosRef.current = driverPos;
  }, [driverPos]);

  const [lastLocationSeconds, setLastLocationSeconds] = useState(0);
  const [detectingGps, setDetectingGps] = useState(false);

  const [pastTrips, setPastTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [earningsFilter, setEarningsFilter] = useState('ALL');

  const [showPinModal, setShowPinModal] = useState(false);
  const [tripPin, setTripPin] = useState('');
  const [pinErrorMessage, setPinErrorMessage] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isCompletingTrip, setIsCompletingTrip] = useState(false);
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [isAcceptingOffer, setIsAcceptingOffer] = useState(false);
  const [isDecliningOffer, setIsDecliningOffer] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const [pushPermission, setPushPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const offerTimerRef = useRef(null);
  const lastNotifiedRideIdRef = useRef(null);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setPushPermission(result);
      } catch { }
    }
  };

  const loadDriverData = async () => {
    const driverId = user?.id;
    if (!driverId) return;

    setLoadingTrips(true);
    try {
      const [availRes, tripsRes] = await Promise.allSettled([
        driverApi.getAvailability(),
        ridesApi.getDriverHistory(driverId),
      ]);

      if (availRes.status === 'fulfilled' && availRes.value) {
        if (availRes.value.status) setOnlineStatus(availRes.value.status);
        const resolvedType = user?.vehicleType || availRes.value.vehicleType || localStorage.getItem('rideway_driver_vehicle_type') || 'AUTO';
        const vType = String(resolvedType).toUpperCase();
        setDriverVehicle(vType);
        localStorage.setItem('rideway_driver_vehicle_type', vType);
        if (updateUser && user?.vehicleType !== vType) updateUser({ vehicleType: vType });
        if (availRes.value.vehicleType !== vType) {
          driverApi.updateAvailability(availRes.value.status || 'AVAILABLE', vType).catch(() => {});
        }
      } else {
        setOnlineStatus('OFFLINE');
      }

      if (tripsRes.status === 'fulfilled' && Array.isArray(tripsRes.value)) {

        const unique = Array.from(new window.Map(tripsRes.value.map((t) => [t.id || t.rideId, t])).values());
        setPastTrips(unique);
        const ongoing = unique.find((t) => ['ACCEPTED', 'STARTED'].includes(t.status?.toUpperCase()));
        if (ongoing) {
          setActiveTrip(ongoing);
          setOnlineStatus('AVAILABLE');
        } else {
          setActiveTrip(null);
        }
      }
    } catch (err) {
      console.warn('Driver profile fetch notice:', err);
    } finally {
      setLoadingStatus(false);
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    loadDriverData();
  }, [user]);

  const updateDriverPosition = async (coords, isFromDeviceGps = false) => {
    const nextCoords = {
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
    };
    setDriverPos(nextCoords);
    localStorage.setItem('rideway_driver_lat', nextCoords.latitude.toString());
    localStorage.setItem('rideway_driver_lng', nextCoords.longitude.toString());

    if (!isFromDeviceGps) {

      isManualPinRef.current = true;
      localStorage.setItem('rideway_driver_is_manual_pin', 'true');
    }

    try {
      await driverApi.sendLocation(nextCoords.latitude, nextCoords.longitude);
      setLastLocationSeconds(0);
      setToastMessage(`Location updated: ${nextCoords.latitude.toFixed(4)}, ${nextCoords.longitude.toFixed(4)}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.warn('Location broadcast notice:', err);
    }
  };

  const detectDeviceLocation = () => {
    if (!('geolocation' in navigator)) {
      setApiErrorMessage('Geolocation is not supported by your browser. Click on the map to set your location.');
      return;
    }

    setDetectingGps(true);
    setApiErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        isManualPinRef.current = false;
        localStorage.removeItem('rideway_driver_is_manual_pin');
        updateDriverPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }, true);
      },
      (err) => {
        setDetectingGps(false);
        setApiErrorMessage('Unable to fetch precise device GPS. Please click anywhere on the map to pin your location.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  const playAlertChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch { }
  };

  useEffect(() => {
    if (!isOnline || activeTrip) {
      return;
    }

    const checkIncomingTrips = async () => {
      try {
        const offer = await driverApi.getPendingOffer();
        if (offer && (offer.offerId || offer.id)) {
          if (!offer.offerId) offer.offerId = offer.id;
          let initialSeconds = 60;
          if (offer.remainingSeconds != null && !isNaN(Number(offer.remainingSeconds)) && Number(offer.remainingSeconds) > 0) {
            initialSeconds = Math.min(120, Number(offer.remainingSeconds));
          } else if (offer.expiresAt) {
            try {
              let iso = String(offer.expiresAt);
              if (!iso.endsWith('Z') && !iso.includes('+')) iso += 'Z';
              const diff = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
              if (diff > 0 && diff <= 120) {
                initialSeconds = diff;
              }
            } catch {}
          }
          const offerRideId = offer.rideId || offer.id;
          const isSameRide = lastNotifiedRideIdRef.current === offerRideId;

          setPendingTrip((prev) => {
            if (prev && (prev.offerId === offer.offerId || prev.rideId === offer.rideId)) {
              return { ...prev, ...offer };
            }

            setTimerSeconds(initialSeconds);

            if (!isSameRide) {
              lastNotifiedRideIdRef.current = offerRideId;
              playAlertChime();
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New Ride Request Available!', {
                  body: (offer.fare || offer.price)
                    ? `Fare: ₹${Math.round(offer.fare || offer.price)} • Tap to view trip details.`
                    : 'Tap to view new trip offer.',
                  icon: '/favicon.ico',
                  tag: 'rideway-ride-offer-' + offerRideId,
                });
              }
            }
            return offer;
          });
        } else {
          setPendingTrip(null);
        }
      } catch (err) {
        if (err.response?.status === 204) {
          setPendingTrip(null);
        } else {
          console.warn('Pending offer check notice:', err?.message || err);
        }
      }
    };

    checkIncomingTrips();
    const pollTimer = setInterval(checkIncomingTrips, 1000);

    const onFocus = () => checkIncomingTrips();
    window.addEventListener('focus', onFocus);

    const unsubscribe = notificationWs.subscribe((notif) => {
      if (['NEW_RIDE_OFFER', 'RIDE_OFFER_AVAILABLE', 'FARE_UPDATED', 'RIDE_REQUESTED'].includes(notif?.eventType)) {
        checkIncomingTrips();
      }
    });

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
      if (unsubscribe) unsubscribe();
    };
  }, [isOnline, activeTrip]);

  useEffect(() => {
    if (!pendingTrip) return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPendingTrip(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingTrip?.offerId || pendingTrip?.id]);

  useEffect(() => {
    const isManual = localStorage.getItem('rideway_driver_is_manual_pin') === 'true';
    if (isManual) {

      return;
    }
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isManualPinRef.current || localStorage.getItem('rideway_driver_is_manual_pin') === 'true') return;
          const coords = {
            latitude: Number(pos.coords.latitude),
            longitude: Number(pos.coords.longitude),
          };
          setDriverPos(coords);
          localStorage.setItem('rideway_driver_lat', coords.latitude.toString());
          localStorage.setItem('rideway_driver_lng', coords.longitude.toString());
          driverApi.sendLocation(coords.latitude, coords.longitude).catch(() => { });
        },
        (err) => {
          console.warn('Initial GPS auto-detect notice:', err?.message);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    let watchId = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {

          if (isManualPinRef.current || localStorage.getItem('rideway_driver_is_manual_pin') === 'true') {
            return;
          }
          const coords = {
            latitude: Number(pos.coords.latitude),
            longitude: Number(pos.coords.longitude),
          };
          setDriverPos(coords);
          localStorage.setItem('rideway_driver_lat', coords.latitude.toString());
          localStorage.setItem('rideway_driver_lng', coords.longitude.toString());
          driverApi.sendLocation(coords.latitude, coords.longitude).catch(() => { });
          setLastLocationSeconds(0);
        },
        (err) => {
          console.warn('Live GPS watch notice:', err?.message);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    const sendHeartbeat = async () => {
      const cur = driverPosRef.current;
      if (cur && cur.latitude && cur.longitude) {
        try {
          await driverApi.sendLocation(cur.latitude, cur.longitude);
          setLastLocationSeconds(0);
        } catch (err) {
          console.warn('Location broadcast notice:', err?.message);
        }
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 10000);
    const counter = setInterval(() => {
      setLastLocationSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(interval);
      clearInterval(counter);
    };
  }, [isOnline]);

  const toggleOnlineStatus = async () => {
    setUpdatingStatus(true);
    setApiErrorMessage(null);
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then((p) => setPushPermission(p)).catch(() => { });
      }
      const nextStatus = isOnline ? 'OFFLINE' : 'AVAILABLE';
      const currentVehicle = (driverVehicle || localStorage.getItem('rideway_driver_vehicle_type') || user?.vehicleType || 'AUTO').toUpperCase();
      await driverApi.updateAvailability(nextStatus, currentVehicle);
      setOnlineStatus(nextStatus);
      if (nextStatus === 'AVAILABLE') {
        const cur = driverPosRef.current;
        if (cur?.latitude && cur?.longitude) {
          driverApi.sendLocation(cur.latitude, cur.longitude).catch(() => { });
        }
      } else {
        setPendingTrip(null);
      }
    } catch (err) {
      setApiErrorMessage(err.response?.data?.message || 'Failed to update online status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const acceptCurrentTrip = async () => {
    if (!pendingTrip?.offerId || isAcceptingOffer) return;
    setIsAcceptingOffer(true);
    setApiErrorMessage(null);

    const tripOfferId = pendingTrip.offerId;
    const tripRideId = pendingTrip.rideId;

    try {

      await driverApi.acceptOffer(tripOfferId, {
        driverPhone: user?.phone || localStorage.getItem('rideway_user_phone') || '',
        driverName: user?.fullName || 'Driver Partner',
        driverVehicleNumber: user?.vehicleNumber || user?.licenseNumber || localStorage.getItem('rideway_driver_vehicle_number') || '',
        driverProfilePictureUrl: user?.profilePictureUrl || '',
      });

      setPendingTrip(null);
      setToastMessage('Ride request accepted! Heading to active trip navigation.');

      navigate(`/rides/${tripRideId}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Ride offer is no longer available or was accepted by another driver.';
      setApiErrorMessage(msg);
      setPendingTrip(null);
      loadDriverData();
    } finally {
      setIsAcceptingOffer(false);
    }
  };

  const declineCurrentTrip = async () => {
    if (!pendingTrip?.offerId) return;
    setIsDecliningOffer(true);
    try {
      await driverApi.declineOffer(pendingTrip.offerId);
    } catch (err) {
      console.warn('Decline notice:', err?.message);
    } finally {
      setIsDecliningOffer(false);
      setPendingTrip(null);
    }
  };

  const startTripWithPin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetRideId = activeTrip?.id || activeTrip?.rideId;
    if (!targetRideId) {
      setPinErrorMessage('Trip reference missing. Please refresh status.');
      return;
    }
    const cleanPin = String(tripPin).replace(/\D/g, '').trim();
    if (cleanPin.length !== 4) {
      setPinErrorMessage('Please enter the 4-digit PIN provided by passenger.');
      return;
    }

    setIsStartingTrip(true);
    setPinErrorMessage(null);
    try {
      await ridesApi.startRide(targetRideId, cleanPin);
      try {
        await api.post(`/api/dispatch/internal/ride-started/${targetRideId}`);
      } catch { }
      setShowPinModal(false);
      setTripPin('');
      setActiveTrip((prev) => (prev ? { ...prev, status: 'STARTED' } : null));
      setToastMessage('PIN verified! Trip started successfully.');
      setTimeout(() => setToastMessage(null), 4000);
      loadDriverData();
    } catch (err) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error;
      const msg = serverMsg || err.message || 'Incorrect PIN. Please ask passenger for the 4-digit PIN shown on their screen.';
      setPinErrorMessage(msg);
    } finally {
      setIsStartingTrip(false);
    }
  };

  const finishTrip = async (rideId) => {
    const targetRideId = rideId || activeTrip?.id || activeTrip?.rideId;
    if (!targetRideId) return;
    if (!window.confirm('Mark this trip as completed?')) return;
    setIsCompletingTrip(true);
    setApiErrorMessage(null);
    try {
      await ridesApi.completeRide(targetRideId);
      try {
        await api.post(`/api/dispatch/internal/ride-completed/${targetRideId}`);
      } catch { }
      setActiveTrip(null);
      setToastMessage('Trip completed! Earnings updated.');
      setTimeout(() => setToastMessage(null), 4000);
      loadDriverData();
    } catch (err) {
      setApiErrorMessage(err.response?.data?.message || 'Failed to complete trip.');
    } finally {
      setIsCompletingTrip(false);
    }
  };

  const handleConfirmCashPayment = async () => {
    const targetRideId = activeTrip?.id || activeTrip?.rideId;
    if (!targetRideId) return;
    const amount = Math.round(Number(activeTrip.price || activeTrip.fare || 0));
    if (!window.confirm(`Confirm collection of ₹${amount} cash from passenger?`)) return;

    setConfirmingCash(true);
    try {
      await api.post('/api/payments/cash-collect', {
        rideId: targetRideId,
        driverId: user?.id,
        riderId: activeTrip.riderId,
        amountCollected: amount,
      });
      try {
        await api.post(`/api/rides/${targetRideId}/payment-status`, {
          paymentStatus: 'PAID',
          paymentMethod: 'CASH',
        });
      } catch { }
      setActiveTrip((prev) => (prev ? { ...prev, paymentStatus: 'PAID', paymentMethod: 'CASH' } : null));
      setToastMessage('Payment recorded as Cash.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record cash payment');
    } finally {
      setConfirmingCash(false);
    }
  };

  const cancelAcceptedTrip = async () => {
    const targetRideId = activeTrip?.id || activeTrip?.rideId;
    if (!targetRideId) return;
    if (!window.confirm('Are you sure you want to cancel this trip? The passenger will be notified.')) return;
    try {
      await ridesApi.cancelRide(targetRideId);
      setActiveTrip(null);
      setToastMessage('Trip cancelled. You are back online.');
      setTimeout(() => setToastMessage(null), 4000);
      loadDriverData();
    } catch (err) {
      setApiErrorMessage(err.response?.data?.message || 'Failed to cancel trip.');
    }
  };

  useEffect(() => {
    const targetRideId = activeTrip?.id || activeTrip?.rideId;
    if (!targetRideId) return;

    const syncActiveTrip = async () => {
      try {
        const [freshRideRes, payRes] = await Promise.allSettled([
          ridesApi.getRideById(targetRideId),
          api.get(`/api/payments/ride/${targetRideId}`),
        ]);

        let isPaid = false;
        let payMethod = null;

        if (payRes.status === 'fulfilled' && payRes.value?.data?.paymentStatus === 'SUCCESS') {
          isPaid = true;
          payMethod = payRes.value.data.paymentMethod;
        }

        if (freshRideRes.status === 'fulfilled' && freshRideRes.value) {
          const freshRide = freshRideRes.value;
          if (freshRide.paymentStatus === 'PAID') {
            isPaid = true;
          }

          if (freshRide.status === 'CANCELLED') {
            setActiveTrip(null);
            setToastMessage('Ride was cancelled by passenger.');
            setTimeout(() => setToastMessage(null), 4000);
            loadDriverData();
          } else if (freshRide.status === 'COMPLETED') {
            setActiveTrip(null);
            setToastMessage('Trip completed! Fare added to your earnings.');
            setTimeout(() => setToastMessage(null), 4000);
            loadDriverData();
          } else {
            setActiveTrip((prev) => (prev ? {
              ...prev,
              ...freshRide,
              paymentStatus: isPaid ? 'PAID' : (freshRide.paymentStatus || prev.paymentStatus),
              paymentMethod: payMethod || freshRide.paymentMethod || prev.paymentMethod,
            } : null));
          }
        }
      } catch (err) {
        console.warn('Trip sync notice:', err?.message);
      }
    };

    const syncTimer = setInterval(syncActiveTrip, 3000);
    return () => clearInterval(syncTimer);
  }, [activeTrip?.id, activeTrip?.status]);

  const currentTargetLocation =
    activeTrip?.status === 'ACCEPTED'
      ? activeTrip?.pickupLocation
      : activeTrip?.destination;

  const targetLatitude = currentTargetLocation?.latitude ? Number(currentTargetLocation.latitude) : null;
  const targetLongitude = currentTargetLocation?.longitude ? Number(currentTargetLocation.longitude) : null;

  const distanceRemainingKm =
    targetLatitude && targetLongitude && driverPos?.latitude && driverPos?.longitude
      ? getDistanceKm(driverPos.latitude, driverPos.longitude, targetLatitude, targetLongitude)
      : activeTrip?.distanceKm || 0;

  const etaMinutes = getEstimatedMinutes(distanceRemainingKm);

  const [detailedRoutePoints, setDetailedRoutePoints] = useState(null);
  const [secondaryRoutePoints, setSecondaryRoutePoints] = useState(null);

  useEffect(() => {
    if (!activeTrip) {
      setDetailedRoutePoints(null);
      setSecondaryRoutePoints(null);
      return;
    }

    let isSubscribed = true;

    if (targetLatitude && targetLongitude && driverPos?.latitude && driverPos?.longitude) {
      getDrivingRouteCoordinates(
        driverPos.latitude,
        driverPos.longitude,
        targetLatitude,
        targetLongitude
      ).then((pts) => {
        if (isSubscribed && pts) {
          setDetailedRoutePoints(pts);
        }
      });
    }

    if (activeTrip?.status === 'ACCEPTED' && activeTrip?.pickupLocation && activeTrip?.destination) {
      const pLat = Number(activeTrip.pickupLocation.latitude);
      const pLng = Number(activeTrip.pickupLocation.longitude);
      const dLat = Number(activeTrip.destination.latitude);
      const dLng = Number(activeTrip.destination.longitude);
      if (pLat && pLng && dLat && dLng) {
        getDrivingRouteCoordinates(pLat, pLng, dLat, dLng).then((pts) => {
          if (isSubscribed && pts) {
            setSecondaryRoutePoints(pts);
          }
        });
      }
    } else {
      setSecondaryRoutePoints(null);
    }

    return () => {
      isSubscribed = false;
    };
  }, [activeTrip?.status, targetLatitude, targetLongitude, driverPos?.latitude, driverPos?.longitude]);

  const completedRides = pastTrips.filter((t) => t.status?.toUpperCase() === 'COMPLETED');
  const totalRevenue = completedRides.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

  const filteredCompletedRides = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return completedRides.filter((trip) => {
      if (earningsFilter === 'ALL') return true;
      const tripDate = trip.completedAt || trip.createdAt ? new Date(trip.completedAt || trip.createdAt) : null;
      if (!tripDate) return true;

      if (earningsFilter === 'TODAY') return tripDate >= startOfToday;
      if (earningsFilter === 'WEEK') return tripDate >= startOfWeek;
      if (earningsFilter === 'MONTH') return tripDate >= startOfMonth;
      return true;
    });
  }, [completedRides, earningsFilter]);

  const filteredRevenue = filteredCompletedRides.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  const avgTripEarnings = filteredCompletedRides.length > 0 ? Math.round(filteredRevenue / filteredCompletedRides.length) : 0;

  const earningsByDate = React.useMemo(() => {
    const groups = {};
    completedRides.forEach((trip) => {
      const d = trip.completedAt || trip.createdAt;
      const dateKey = d
        ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Recent';
      if (!groups[dateKey]) {
        groups[dateKey] = { date: dateKey, tripsCount: 0, totalFare: 0 };
      }
      groups[dateKey].tripsCount += 1;
      groups[dateKey].totalFare += Number(trip.price || 0);
    });
    return Object.values(groups);
  }, [completedRides]);

  const tripsPerPage = 5;
  const totalTripPages = Math.max(1, Math.ceil(pastTrips.length / tripsPerPage));
  const paginatedTrips = pastTrips.slice((historyPage - 1) * tripsPerPage, historyPage * tripsPerPage);

  const getVehicleIcon = () => {
    const type = (driverVehicle || localStorage.getItem('rideway_driver_vehicle_type') || user?.vehicleType || 'AUTO').toUpperCase();
    if (type.includes('MOTO') || type.includes('BIKE')) return '🏍️';
    if (type.includes('CAB') || type.includes('CAR')) return '🚗';
    return '🛺';
  };

  const getVehicleTitle = () => {
    const type = (driverVehicle || localStorage.getItem('rideway_driver_vehicle_type') || user?.vehicleType || 'AUTO').toUpperCase();
    if (type.includes('MOTO') || type.includes('BIKE')) return 'Bike (1 seat)';
    if (type.includes('CAB') || type.includes('CAR')) return 'Cab (4 seats)';
    return 'Auto (3 seats)';
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-gray-950 py-6 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="w-full max-w-[1600px] mx-auto space-y-6">

        {toastMessage && (
          <div className="p-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {apiErrorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-red-700 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="font-bold">{apiErrorMessage}</span>
            </div>
            <button onClick={() => setApiErrorMessage(null)} className="text-red-500 hover:text-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {pushPermission !== 'granted' && (
          <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Notifications are currently disabled</p>
                <p className="text-amber-800 text-[11px]">Enable browser notifications to receive sound and pop-up alerts for new passenger ride requests.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-xs flex-shrink-0"
            >
              Enable Notifications
            </button>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-900 flex items-center justify-center font-black text-3xl shadow-xs border border-gray-200">
              {getVehicleIcon()}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-gray-950 tracking-tight">
                  {user?.fullName || 'Driver Partner'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-2 font-medium flex-wrap">
                <span>{getVehicleTitle()}</span>
                {user?.licenseNumber && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-900 font-bold" title="Driving License Number">
                      DL: {user.licenseNumber}
                    </span>
                  </>
                )}
                {user?.vehicleNumber && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-900 font-bold" title="Vehicle Registration Plate">
                      {user.vehicleNumber}
                    </span>
                  </>
                )}
                {!user?.licenseNumber && !user?.vehicleNumber && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-gray-900 font-bold">
                      Registered Partner
                    </span>
                  </>
                )}
                {user?.email && (
                  <>
                    <span>•</span>
                    <span>{user.email}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadDriverData}
              disabled={loadingStatus}
              className="p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 hover:text-black transition shadow-xs"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={toggleOnlineStatus}
              disabled={updatingStatus}
              className={`px-7 py-3.5 rounded-2xl font-black text-sm tracking-wide transition shadow-md flex items-center gap-2.5 ${isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-black hover:bg-neutral-800 text-white'
                }`}
            >
              {updatingStatus ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : isOnline ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <Power className="w-4 h-4" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 text-emerald-400" />
                  <span>Offline</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-950 flex items-center gap-2">
                <span>Driver Earnings & Activity</span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">Real-time revenue calculation from your completed trips.</p>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
              {[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'WEEK', label: 'This Week' },
                { id: 'MONTH', label: 'This Month' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setEarningsFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${earningsFilter === f.id
                    ? 'bg-black text-white shadow-xs'
                    : 'text-gray-600 hover:text-black'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Net Earnings</span>
              <p className="text-3xl font-black text-emerald-700">₹{Math.round(filteredRevenue)}</p>
              <span className="text-[10px] text-gray-400 font-medium">100% direct driver payout</span>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Completed Trips</span>
              <p className="text-3xl font-black text-gray-950">{filteredCompletedRides.length}</p>
              <span className="text-[10px] text-gray-400 font-medium">Verified completed rides</span>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Avg / Trip</span>
              <p className="text-3xl font-black text-gray-950">₹{avgTripEarnings}</p>
              <span className="text-[10px] text-gray-400 font-medium">Average fare per completed ride</span>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Location Status</span>
              <div className="flex items-center gap-2 pt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-bold text-gray-950">
                  {isOnline ? `Active (${lastLocationSeconds}s ago)` : 'Offline'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate">
                {driverPos ? `${driverPos.latitude.toFixed(4)}, ${driverPos.longitude.toFixed(4)}` : 'Waiting for GPS fix...'}
              </p>
            </div>
          </div>
        </div>

        {pendingTrip && (
          <div className="bg-white border-2 border-emerald-500 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600 animate-ping" />
                <h2 className="text-xl sm:text-2xl font-black text-gray-950">Incoming Ride Request</h2>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center font-mono font-black text-emerald-800 text-base shadow-xs">
                {timerSeconds}s
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/90 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center font-bold text-xs">
                    {pendingTrip.riderName ? pendingTrip.riderName.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Passenger</span>
                    <p className="font-bold text-gray-950 text-sm">{pendingTrip.riderName || 'Passenger'}</p>
                    <p className="text-[11px] font-mono text-gray-700 font-bold">
                      {pendingTrip.riderPhone || 'Mobile connected'}
                    </p>
                  </div>
                </div>
                {pendingTrip.riderPhone ? (
                  <a
                    href={`tel:${pendingTrip.riderPhone}`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 transition shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                ) : (
                  <span className="text-[11px] text-gray-400 font-medium">Passenger</span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/90 space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Pickup Location</span>
                  <p className="font-bold text-gray-950 text-sm truncate">
                    {pendingTrip.pickupLocation?.address || pendingTrip.pickupAddress || 'Pickup Point'}
                  </p>
                </div>
                <div className="border-l-2 border-dashed border-gray-300 ml-1 h-2" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500">Dropoff Destination</span>
                  <p className="font-bold text-gray-950 text-sm truncate">
                    {pendingTrip.destination?.address || pendingTrip.destinationAddress || 'Dropoff Point'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200/90">
                <div>
                  <span className="text-xs text-gray-500 font-medium">Guaranteed Fare</span>
                  <p className="text-3xl font-black text-emerald-700">
                    {(pendingTrip.fare || pendingTrip.price) ? `₹${Math.round(pendingTrip.fare || pendingTrip.price)}` : 'Calculating...'}
                  </p>
                </div>
                <div className="text-center">
                  <span className="text-xs text-gray-500 font-medium">Vehicle Requested</span>
                  <p className="text-xs font-black text-gray-950 flex items-center justify-center gap-1">
                    <span>{pendingTrip.vehicleType === 'CAB' ? '🚗 Cab' : pendingTrip.vehicleType === 'MOTO' ? '🏍️ Bike' : '🛺 Auto'}</span>
                    <span className="text-[10px] text-gray-500 font-normal">
                      ({pendingTrip.vehicleType === 'CAB' ? '4 seats' : pendingTrip.vehicleType === 'MOTO' ? '1 seat' : '3 seats'})
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 font-medium">Distance</span>
                  <p className="text-base font-black text-gray-950">
                    {pendingTrip.distanceKm ? `${pendingTrip.distanceKm} km` : 'Direct'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={declineCurrentTrip}
                  disabled={isDecliningOffer || isAcceptingOffer}
                  className="py-4 rounded-2xl border border-gray-300 bg-white font-bold text-xs text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                >
                  {isDecliningOffer ? 'Declining...' : 'Decline'}
                </button>
                <button
                  type="button"
                  onClick={acceptCurrentTrip}
                  disabled={isAcceptingOffer || isDecliningOffer}
                  className="py-4 rounded-2xl bg-black text-white font-black text-sm hover:bg-neutral-800 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isAcceptingOffer ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : 'ACCEPT RIDE'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTrip && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-emerald-500 shadow-md space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Current Trip #{String(activeTrip.id).slice(0, 8)}
                </span>
                <h2 className="text-2xl font-black text-gray-950">
                  {activeTrip.status === 'ACCEPTED' ? 'Heading to Passenger Pickup' : 'Trip in Progress'}
                </h2>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => navigate(`/rides/${activeTrip.id || activeTrip.rideId}`)}
                  className="px-3.5 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Open Full Navigation View</span>
                </button>

                <div className="px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                  <Compass className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  <span>{distanceRemainingKm} km remaining</span>
                  <span>•</span>
                  <span>~{etaMinutes} min away</span>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
                  {activeTrip.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/90 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center text-xs font-black">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Passenger</span>
                      <p className="text-sm font-bold text-gray-950">
                        {activeTrip.riderName || 'Passenger'}
                      </p>
                      <p className="text-xs text-gray-700 font-mono font-bold">
                        {activeTrip.riderPhone || 'Mobile on trip'}
                      </p>
                    </div>
                  </div>

                  {activeTrip.riderPhone ? (
                    <a
                      href={`tel:${activeTrip.riderPhone}`}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Passenger</span>
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">Passenger</span>
                  )}
                </div>

                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-200/90 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Passenger Pickup</span>
                    <p className="font-bold text-gray-950">{activeTrip.pickupLocation?.address || 'Pickup Point'}</p>
                  </div>
                  <div className="border-l-2 border-dashed border-gray-300 ml-1 h-3" />
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Dropoff Destination</span>
                    <p className="font-bold text-gray-950">{activeTrip.destination?.address || 'Dropoff Point'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200/90 text-xs">
                  <div>
                    <span className="text-gray-500 font-medium block text-[11px]">Trip Fare</span>
                    <span className="text-lg font-black text-gray-950">
                      {(activeTrip.price || activeTrip.fare) ? `₹${Math.round(activeTrip.price || activeTrip.fare)}` : 'Fare pending'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 font-medium block text-[11px]">Estimated Arrival</span>
                    <span className="text-sm font-black text-emerald-700">{etaMinutes} minutes</span>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  {activeTrip.status === 'ACCEPTED' && (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-emerald-700" />
                          <span className="text-xs font-bold text-gray-900">Passenger Trip Start PIN</span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium">Ask rider for 4-digit PIN</span>
                      </div>

                      <form onSubmit={startTripWithPin} className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={tripPin}
                          onChange={(e) => {
                            setTripPin(e.target.value.replace(/\D/g, ''));
                            setPinErrorMessage(null);
                          }}
                          placeholder="PIN"
                          className="w-32 py-3 px-3 text-center font-mono font-black text-xl tracking-[0.3em] rounded-xl bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black shadow-inner"
                        />
                        <button
                          type="submit"
                          disabled={isStartingTrip || tripPin.replace(/\D/g, '').length !== 4}
                          className="flex-1 py-3 px-4 rounded-xl bg-black text-white font-bold text-xs hover:bg-neutral-800 disabled:opacity-40 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isStartingTrip ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span>VERIFY PIN & START TRIP</span>
                            </>
                          )}
                        </button>
                      </form>

                      {pinErrorMessage && (
                        <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg border border-red-200">
                          {pinErrorMessage}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={cancelAcceptedTrip}
                        className="w-full py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel Assignment</span>
                      </button>
                    </div>
                  )}

                  {activeTrip.status === 'STARTED' && (
                    <div className="space-y-3">

                      {activeTrip.paymentStatus === 'PAID' ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Payment Received ({activeTrip.paymentMethod === 'ONLINE' ? 'Paid Online via Razorpay' : 'Cash Collected'})
                          </span>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Payment: ₹{Math.round(activeTrip.price || activeTrip.fare || 0)}</span>
                            </span>
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-black">
                              Pending
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={handleConfirmCashPayment}
                            disabled={confirmingCash}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {confirmingCash ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Recording Cash...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 text-white" />
                                <span>Confirm Cash Payment (₹{Math.round(activeTrip.price || activeTrip.fare || 0)})</span>
                              </>
                            )}
                          </button>

                          <p className="text-[10px] text-amber-800 text-center font-medium">
                            Or passenger can pay online in app via Razorpay.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => finishTrip(activeTrip.id)}
                        disabled={isCompletingTrip || activeTrip.paymentStatus !== 'PAID'}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition shadow-md flex items-center justify-center gap-2 ${activeTrip.paymentStatus === 'PAID'
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300 opacity-75'
                          }`}
                      >
                        {isCompletingTrip ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                            <span>Completing Trip...</span>
                          </>
                        ) : activeTrip.paymentStatus === 'PAID' ? (
                          <>
                            <Check className="w-5 h-5 text-white" />
                            <span>COMPLETE TRIP</span>
                          </>
                        ) : (
                          <span>COMPLETE TRIP (Awaiting Payment)</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xs">
                <RideMap
                  pickup={activeTrip.pickupLocation}
                  destination={activeTrip.destination}
                  driverLocation={driverPos}
                  routeCoordinates={detailedRoutePoints}
                  routeColor={activeTrip.status === 'ACCEPTED' ? '#2563eb' : '#10b981'}
                  secondaryRouteCoordinates={secondaryRoutePoints}
                  secondaryRouteColor="#10b981"
                  secondaryRouteDashed={true}
                  className="h-80 w-full"
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-950 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-emerald-700" />
                <span>Live Location Map</span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Live driver position. Click anywhere on the map to pin your exact location.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={detectDeviceLocation}
                disabled={detectingGps}
                className="px-3.5 py-2 rounded-xl border border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-800 flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
              >
                {detectingGps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 text-emerald-600" />}
                <span>Detect Device GPS</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xs">
            <RideMap
              driverLocation={driverPos}
              onMapClick={updateDriverPosition}
              className="h-[180px] sm:h-[220px] w-full"
              zoom={14}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
            <span>
              Current Pinned Coords: <strong className="text-gray-900 font-mono">{driverPos ? `${driverPos.latitude.toFixed(4)}, ${driverPos.longitude.toFixed(4)}` : 'Acquiring GPS fix...'}</strong>
            </span>
            <span>Click on the map if you want to reposition your driver marker.</span>
          </div>
        </div>

        {earningsByDate.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-950">Daily Earnings Summary</h2>
                <p className="text-xs text-gray-500 font-medium">Breakdown of completed rides and earnings by date.</p>
              </div>
              <span className="text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1 rounded-xl">
                {earningsByDate.length} active {earningsByDate.length === 1 ? 'day' : 'days'}
              </span>
            </div>

            <div className="divide-y divide-gray-100 overflow-x-auto">
              {earningsByDate.map((row) => (
                <div key={row.date} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                      📅
                    </div>
                    <div>
                      <p className="font-bold text-gray-950 text-sm">{row.date}</p>
                      <p className="text-[11px] text-gray-500">{row.tripsCount} {row.tripsCount === 1 ? 'ride completed' : 'rides completed'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-black text-emerald-700">₹{Math.round(row.totalFare)}</p>
                    <span className="text-[10px] text-gray-400 font-medium">Daily Net</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-950 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-700" />
              <span>Recent Trip History</span>
            </h2>
            <span className="text-xs text-gray-500 font-bold">{pastTrips.length} total records</span>
          </div>

          {pastTrips.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-semibold space-y-2">
              <Car className="w-8 h-8 mx-auto text-gray-300" />
              <p>No trip records found. Go Online to receive ride requests!</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100 overflow-x-auto">
                {paginatedTrips.map((trip) => (
                  <div key={trip.id || Math.random()} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-500">#{String(trip.id).slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${trip.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-800'
                          }`}>
                          {trip.status}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          {trip.createdAt ? new Date(trip.createdAt).toLocaleDateString() : 'Today'}
                        </span>
                      </div>
                      <p className="text-gray-900 font-semibold truncate">
                        {trip.pickupLocation?.address || 'Pickup'} ➔ {trip.destination?.address || 'Dropoff'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-700">₹{Math.round(Number(trip.price || 0))}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{trip.distanceKm ? `${trip.distanceKm} km` : 'Direct'}</p>
                    </div>
                  </div>
                ))}
              </div>

              {totalTripPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
                  <span className="text-gray-500 font-medium">
                    Page <strong className="text-gray-900">{historyPage}</strong> of <strong className="text-gray-900">{totalTripPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.min(totalTripPages, p + 1))}
                      disabled={historyPage === totalTripPages}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-200 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-gray-950">Verify Trip Start PIN</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setTripPin('');
                  setPinErrorMessage(null);
                }}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Ask passenger for their 4-digit PIN to verify and begin the journey.
            </p>

            <form onSubmit={startTripWithPin} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  value={tripPin}
                  onChange={(e) => setTripPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter PIN"
                  className="w-full py-3 px-4 text-center font-mono font-black text-2xl tracking-[0.5em] rounded-2xl bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                  autoFocus
                />
                {pinErrorMessage && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium">{pinErrorMessage}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStartingTrip || tripPin.replace(/\D/g, '').length !== 4}
                  className="flex-1 py-3 rounded-xl bg-black text-white font-bold text-xs hover:bg-neutral-800 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isStartingTrip ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Start Ride'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default DriverDashboard;
