import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ridesApi } from '../api/rides';
import api from '../api/axios';
import { reverseGeocode, getDrivingRouteCoordinates } from '../utils/geocoding';
import RideMap from '../components/Map';
import LocationInput from '../components/LocationInput';
import {
  Car,
  ArrowRight,
  AlertCircle,
  Loader2,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Banknote,
} from 'lucide-react';

export const BookRide = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [pickup, setPickup] = useState({
    address: '',
    latitude: null,
    longitude: null,
  });

  const [destination, setDestination] = useState({
    address: '',
    latitude: null,
    longitude: null,
  });

  const [selectedVehicle, setSelectedVehicle] = useState('AUTO');
  const [mapTarget, setMapTarget] = useState('pickup');

  const [fareBooster, setFareBooster] = useState(0);
  const [customBooster, setCustomBooster] = useState('');

  const [fareData, setFareData] = useState(null);
  const [roadRouteCoords, setRoadRouteCoords] = useState(null);
  const [calculatingFare, setCalculatingFare] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeRide, setActiveRide] = useState(null);

  useEffect(() => {
    if (user?.id) {
      ridesApi.getRiderHistory(user.id).then((history) => {
        if (Array.isArray(history)) {
          const ongoing = history.find((r) => ['REQUESTED', 'ACCEPTED', 'STARTED'].includes(r.status));
          if (ongoing) {
            setActiveRide(ongoing);
          }
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  const handlePickupAddressChange = (addr) => {
    if (!addr || !addr.trim()) {
      setPickup({ address: '', latitude: null, longitude: null });
      setFareData(null);
      setRoadRouteCoords(null);
    } else {
      setPickup((prev) => ({
        address: addr,
        latitude: prev.address === addr ? prev.latitude : null,
        longitude: prev.address === addr ? prev.longitude : null,
      }));
    }
  };

  const handlePickupSelectLocation = (loc) => {
    if (!loc || !loc.latitude || !loc.longitude) {
      setPickup({ address: '', latitude: null, longitude: null });
      setFareData(null);
      setRoadRouteCoords(null);
    } else {
      setPickup({
        address: loc.address || '',
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
      });
    }
  };

  const handleDestinationAddressChange = (addr) => {
    if (!addr || !addr.trim()) {
      setDestination({ address: '', latitude: null, longitude: null });
      setFareData(null);
      setRoadRouteCoords(null);
    } else {
      setDestination((prev) => ({
        address: addr,
        latitude: prev.address === addr ? prev.latitude : null,
        longitude: prev.address === addr ? prev.longitude : null,
      }));
    }
  };

  const handleDestinationSelectLocation = (loc) => {
    if (!loc || !loc.latitude || !loc.longitude) {
      setDestination({ address: '', latitude: null, longitude: null });
      setFareData(null);
      setRoadRouteCoords(null);
    } else {
      setDestination({
        address: loc.address || '',
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
      });
    }
  };

  useEffect(() => {
    const hasValidPickup = Boolean(pickup?.latitude && pickup?.longitude && pickup?.address?.trim());
    const hasValidDestination = Boolean(destination?.latitude && destination?.longitude && destination?.address?.trim());

    if (!hasValidPickup || !hasValidDestination) {
      setFareData(null);
      setRoadRouteCoords(null);
      setCalculatingFare(false);
      return;
    }

    const dLat = (Number(destination.latitude) - Number(pickup.latitude)) * 111;
    const dLng = (Number(destination.longitude) - Number(pickup.longitude)) * 111;
    const dist = Math.max(1.0, Math.sqrt(dLat * dLat + dLng * dLng) * 1.28);
    const estMinutes = Math.round(dist * 2.4 + 4);
    const distKm = Number(dist.toFixed(1));
    const bikeFare = Math.round(distKm <= 2 ? 20 : 20 + Math.max(0, distKm - 2) * 9);
    const autoFare = Math.round(distKm <= 1.6 ? 25 : 25 + Math.max(0, distKm - 1.6) * 12);
    const cabFare = Math.round(distKm <= 2 ? 50 : 50 + Math.max(0, distKm - 2) * 14);

    setFareData({
      distanceKm: distKm,
      durationMinutes: estMinutes,
      price: autoFare,
      currency: 'INR',
      vehicleFares: {
        BIKE: bikeFare,
        AUTO: autoFare,
        CAB: cabFare,
      },
    });

    let isMounted = true;
    setCalculatingFare(true);
    setError(null);

    const fetchFare = async () => {
      try {
        const result = await ridesApi.calculateFare(
          {
            latitude: Number(pickup.latitude),
            longitude: Number(pickup.longitude),
            address: pickup.address,
          },
          {
            latitude: Number(destination.latitude),
            longitude: Number(destination.longitude),
            address: destination.address,
          }
        );
        if (isMounted && result) {
          setFareData(result);
          if (result?.routeCoordinates && result.routeCoordinates.length >= 2) {
            setRoadRouteCoords(result.routeCoordinates);
          } else {
            getDrivingRouteCoordinates(
              pickup.latitude,
              pickup.longitude,
              destination.latitude,
              destination.longitude
            ).then((coords) => {
              if (isMounted && coords) setRoadRouteCoords(coords);
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setFareData({
            distanceKm: distKm,
            durationMinutes: estMinutes,
            price: autoFare,
            currency: 'INR',
            vehicleFares: {
              BIKE: bikeFare,
              AUTO: autoFare,
              CAB: cabFare,
            },
          });
          getDrivingRouteCoordinates(
            pickup.latitude,
            pickup.longitude,
            destination.latitude,
            destination.longitude
          ).then((coords) => {
            if (isMounted && coords) setRoadRouteCoords(coords);
          });
        }
      } finally {
        if (isMounted) {
          setCalculatingFare(false);
        }
      }
    };

    fetchFare();

    return () => {
      isMounted = false;
    };
  }, [pickup.latitude, pickup.longitude, pickup.address, destination.latitude, destination.longitude, destination.address]);

  const handleMapClick = async (coords) => {
    try {
      const address = await reverseGeocode(coords.latitude, coords.longitude);
      const cleanAddress = (address && address.trim())
        ? address.trim()
        : `Point (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;

      const newLoc = {
        address: cleanAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      if (mapTarget === 'pickup') {
        setPickup(newLoc);
        setMapTarget('destination');
      } else {
        setDestination(newLoc);
        setMapTarget('pickup');
      }
    } catch {
      const fallback = {
        address: `Point (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
      if (mapTarget === 'pickup') {
        setPickup(fallback);
        setMapTarget('destination');
      } else {
        setDestination(fallback);
        setMapTarget('pickup');
      }
    }
  };

  const vehicleOptions = [
    {
      id: 'AUTO',
      name: 'Auto',
      icon: '🛺',
      capacity: '3 seats',
      maxDistanceKm: 40,
    },
    {
      id: 'MOTO',
      name: 'Bike',
      icon: '🏍️',
      capacity: '1 seat',
      maxDistanceKm: 30,
    },
    {
      id: 'CAB',
      name: 'Cab Mini',
      icon: '🚗',
      capacity: '4 seats',
      maxDistanceKm: 60,
    },
  ];

  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const tripDistance = fareData?.distanceKm || 0;

  const getVehiclePrice = (vId) => {
    if (!vId) return '—';
    const hasValidPickup = Boolean(pickup?.latitude && pickup?.longitude && pickup?.address?.trim());
    const hasValidDestination = Boolean(destination?.latitude && destination?.longitude && destination?.address?.trim());
    if (!hasValidPickup || !hasValidDestination) {
      return '—';
    }

    const lookupKey = vId === 'MOTO' ? 'BIKE' : vId;
    if (fareData?.vehicleFares && (fareData.vehicleFares[lookupKey] != null || fareData.vehicleFares[vId] != null)) {
      const raw = fareData.vehicleFares[lookupKey] ?? fareData.vehicleFares[vId];
      return Math.round(Number(raw)) + fareBooster;
    }
    if (!tripDistance || tripDistance <= 0) return '—';
    let base = 0;
    if (vId === 'MOTO' || vId === 'BIKE') {
      base = tripDistance <= 2 ? 20 : 20 + Math.max(0, tripDistance - 2) * 9;
    } else if (vId === 'CAB') {
      base = tripDistance <= 2 ? 50 : 50 + Math.max(0, tripDistance - 2) * 14;
    } else {
      base = tripDistance <= 1.6 ? 25 : 25 + Math.max(0, tripDistance - 1.6) * 12;
    }
    return Math.round(base) + fareBooster;
  };

  const getDistanceErrorMessage = (vId) => {
    if (vId === 'MOTO' || vId === 'BIKE') return 'This trip is beyond the current Bike service range.';
    if (vId === 'AUTO') return 'This trip is beyond the current Auto service range.';
    return 'This trip is beyond the current Cab service range.';
  };

  const currentSelection = vehicleOptions.find((v) => v.id === selectedVehicle) || vehicleOptions[0];
  const isDistanceExceeded = tripDistance > currentSelection.maxDistanceKm;
  const finalPrice = getVehiclePrice(currentSelection.id);

  const handleRequestRide = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/book' } } });
      return;
    }

    const riderUuid = user?.id;
    if (!riderUuid) {
      setError('Please sign in to book your ride.');
      return;
    }

    const hasPickup = Boolean(pickup?.latitude && pickup?.longitude);
    const hasDestination = Boolean(destination?.latitude && destination?.longitude);

    if (!hasPickup || !hasDestination) {
      setError('Please select both pickup and destination locations on the map or search.');
      return;
    }

    if (isDistanceExceeded) {
      setError(getDistanceErrorMessage(selectedVehicle));
      return;
    }

    setIsSubmitting(true);

    try {
      const pAddress = (pickup.address && pickup.address.trim())
        ? pickup.address.trim()
        : `Pickup (${Number(pickup.latitude).toFixed(4)}, ${Number(pickup.longitude).toFixed(4)})`;

      const dAddress = (destination.address && destination.address.trim())
        ? destination.address.trim()
        : `Destination (${Number(destination.latitude).toFixed(4)}, ${Number(destination.longitude).toFixed(4)})`;

      const payload = {
        riderId: riderUuid,
        riderName: user?.fullName || 'Rider',
        riderPhone: user?.phone || localStorage.getItem('rideway_user_phone') || '',
        vehicleType: selectedVehicle === 'MOTO' ? 'BIKE' : selectedVehicle,
        paymentMethod: paymentMethod,
        boostAmount: fareBooster > 0 ? Number(fareBooster) : 0,
        estimatedDistanceKm: fareData?.distanceKm ? Number(fareData.distanceKm) : null,
        estimatedDurationMinutes: fareData?.durationMinutes ? Number(fareData.durationMinutes) : null,
        pickupLocation: {
          latitude: Number(pickup.latitude),
          longitude: Number(pickup.longitude),
          address: pAddress,
        },
        destination: {
          latitude: Number(destination.latitude),
          longitude: Number(destination.longitude),
          address: dAddress,
        },
      };

      const response = await ridesApi.createRide(payload);
      const rideId = response?.id;

      if (fareBooster > 0 && rideId) {
        const expectedPrice = Math.round(Number(finalPrice));
        const actualPrice = response?.price != null ? Math.round(Number(response.price)) : 0;
        if (actualPrice < expectedPrice) {
          try {
            await api.patch(`/api/rides/${rideId}/price-increase`, {
              increaseAmount: Number(expectedPrice - actualPrice),
              amount: Number(expectedPrice - actualPrice),
            });
          } catch {}
        }
      }

      if (rideId) {

        api.post(`/api/dispatch/internal/ride-requested/${rideId}`).catch(() => {});
        navigate(`/rides/${rideId}`);
      } else {
        navigate('/activity');
      }
    } catch (err) {
      let msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Unable to request ride right now. Please try again.';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        msg = 'Connection timed out. Please check your network and tap to retry.';
      } else if (err.response?.status === 503 || err.message?.includes('Network Error')) {
        msg = 'Ride service is temporarily reconnecting. Please tap to retry in a moment.';
      }
      if (typeof msg === 'string' && (msg.includes('8080') || msg.toLowerCase().includes('gateway') || msg.includes('ECONNREFUSED'))) {
        msg = 'Ride service is temporarily reconnecting. Please tap to retry in a moment.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-[#f8f9fa] text-gray-950 py-8 px-4 sm:px-6 lg:px-8 xl:px-10">
      <div className="w-full max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-950">
            Request a Ride
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <div className="lg:col-span-5 bg-white border border-gray-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
            {activeRide && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                  <div>
                    <p className="font-extrabold text-gray-950">Active Ride in Progress</p>
                    <p className="text-[11px] text-emerald-800">Status: {activeRide.status}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/rides/${activeRide.id || activeRide.rideId}`)}
                  className="px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Track Live</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequestRide} className="space-y-4">
              <LocationInput
                label="Pickup Location"
                placeholder="Enter pickup address..."
                value={pickup.address}
                isPickup={true}
                showGpsButton={true}
                onChangeAddress={handlePickupAddressChange}
                onSelectLocation={handlePickupSelectLocation}
              />

              <LocationInput
                label="Destination"
                placeholder="Enter destination..."
                value={destination.address}
                isPickup={false}
                showGpsButton={false}
                onChangeAddress={handleDestinationAddressChange}
                onSelectLocation={handleDestinationSelectLocation}
              />

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-700">
                    Ride Options
                  </label>
                  <span className="text-[11px] text-gray-400 font-semibold">
                    {fareData?.distanceKm ? `${fareData.distanceKm} km trip` : ''}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {vehicleOptions.map((v) => {
                    const price = getVehiclePrice(v.id);
                    const isSelected = selectedVehicle === v.id;
                    const exceedsLimit = tripDistance > v.maxDistanceKm;

                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          if (!exceedsLimit) setSelectedVehicle(v.id);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          exceedsLimit
                            ? 'opacity-40 bg-gray-50 border-gray-200 cursor-not-allowed'
                            : isSelected
                            ? 'border-black bg-gray-50 shadow-xs ring-1 ring-black/5'
                            : 'border-gray-200/90 bg-white hover:bg-gray-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0 border border-gray-200/80">
                            {v.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-gray-950 truncate">
                                {v.name}
                              </h4>
                              <span className="text-[10px] text-gray-600 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                                {v.capacity}
                              </span>
                            </div>
                            {exceedsLimit ? (
                              <span className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Max {v.maxDistanceKm} km limit
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">
                                Max {v.maxDistanceKm} km
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 pl-2">
                          <span className="text-base font-black text-gray-950">
                            {typeof price === 'number' ? `₹${Math.round(price)}` : (calculatingFare ? '...' : price)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    Priority Fare Booster
                  </span>
                  <span className="text-[10px] text-gray-400">Faster Pickup</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 5, 10, 20].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setFareBooster(amount);
                        setCustomBooster('');
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold transition border ${
                        fareBooster === amount && !customBooster
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {amount === 0 ? '+₹0' : `+₹${amount}`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">Or custom:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">₹</span>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      placeholder="Enter custom amount"
                      value={customBooster}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomBooster(val);
                        const num = parseInt(val, 10);
                        setFareBooster(!isNaN(num) && num >= 0 ? num : 0);
                      }}
                      className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-black"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black text-gray-900 block">Payment Method</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                      paymentMethod === 'CASH'
                        ? 'border-black bg-gray-50/90 ring-1 ring-black shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-950 block">Cash</span>
                      <span className="text-[10px] text-gray-500 font-medium">Pay driver on trip end</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ONLINE')}
                    className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                      paymentMethod === 'ONLINE'
                        ? 'border-black bg-gray-50/90 ring-1 ring-black shadow-xs'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-950 block">Online</span>
                      <span className="text-[10px] text-gray-500 font-medium">UPI / Card / Razorpay</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>
                    Duration: <strong className="text-gray-950">{fareData?.durationMinutes ? `~${fareData.durationMinutes} mins` : '—'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Verified Partner</span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isDistanceExceeded ||
                  !pickup?.latitude ||
                  !destination?.latitude ||
                  !pickup?.address?.trim() ||
                  !destination?.address?.trim()
                }
                className="w-full py-4 rounded-2xl font-black text-white bg-black hover:bg-neutral-800 active:scale-[0.99] transition shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Finding Driver...</span>
                  </>
                ) : !pickup?.latitude || !pickup?.address?.trim() ? (
                  <span>Select pickup location</span>
                ) : !destination?.latitude || !destination?.address?.trim() ? (
                  <span>Select destination</span>
                ) : isDistanceExceeded ? (
                  <span>Trip exceeds max distance limit</span>
                ) : (
                  <>
                    <span>
                      Confirm {currentSelection.name}
                      {typeof finalPrice === 'number' ? ` • ₹${Math.round(finalPrice)}` : ''}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-gray-200/90 text-xs shadow-xs">
              <span className="text-gray-500 font-medium">
                Click map to pin location:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMapTarget('pickup')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    mapTarget === 'pickup'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Pickup Pin
                </button>
                <button
                  type="button"
                  onClick={() => setMapTarget('destination')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    mapTarget === 'destination'
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Destination Pin
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200/90 rounded-3xl p-3 shadow-sm overflow-hidden">
              <RideMap
                pickup={pickup}
                destination={destination}
                routeCoordinates={roadRouteCoords || fareData?.routeCoordinates}
                onMapClick={handleMapClick}
                className="h-[520px] w-full rounded-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookRide;
