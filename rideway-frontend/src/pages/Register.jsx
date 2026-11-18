import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import {
  User,
  Mail,
  Lock,
  Phone,
  Car,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Camera,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';

export const Register = () => {
  const [step, setStep] = useState('FORM');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('AUTO');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [role, setRole] = useState('RIDER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const [transactionId, setTransactionId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPhone = Boolean(phone && phone.trim().replace(/[^0-9]/g, '').length >= 10);

  const { setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file size must be less than 5MB');
        return;
      }
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone ? phone.trim().replace(/[^0-9]/g, '') : '';
    if (cleanPhone && cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number, or leave it blank.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (role === 'DRIVER' && (!licenseNumber || licenseNumber.trim().length < 3)) {
      setError('Driving license number is required for Driver Partners');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedPhotoUrl = profileImagePreview || '';

      if (profileImageFile) {
        try {
          setUploadingImage(true);
          const uploadRes = await authApi.uploadProfilePicture(profileImageFile);
          if (uploadRes?.url || uploadRes?.imageUrl) {
            uploadedPhotoUrl = uploadRes.url || uploadRes.imageUrl;
          }
        } catch (uploadErr) {
          console.warn('Direct upload fallback:', uploadErr);
        } finally {
          setUploadingImage(false);
        }
      }

      const formattedPhone = cleanPhone
        ? (phone.trim().startsWith('+')
            ? phone.trim()
            : `+91${cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.substring(2) : cleanPhone}`)
        : null;

      const payload = {
        role,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: formattedPhone,
        password,
        profilePictureUrl: uploadedPhotoUrl,
      };

      if (role === 'DRIVER') {
        payload.licenseNumber = licenseNumber.trim();
        payload.vehicleType = vehicleType;
        payload.vehicleNumber = vehicleNumber.trim();
      }

      
      if (!cleanPhone) {
        const authData = await authApi.register(payload);
        const userData = {
          id: authData.accountId || authData.id || authData.userId,
          fullName: authData.fullName || fullName,
          email: authData.email || email,
          phone: '',
          role: (authData.role || role).toUpperCase(),
          profilePictureUrl: authData.profilePictureUrl || profileImagePreview || '',
          licenseNumber: authData.licenseNumber || licenseNumber || '',
          vehicleType: authData.vehicleType || vehicleType,
          vehicleNumber: authData.vehicleNumber || vehicleNumber || '',
        };
        setUser(userData);
        if (role === 'DRIVER') {
          navigate('/driver/dashboard');
        } else {
          navigate('/activity');
        }
        return;
      }

      const res = await authApi.requestRegistrationOtp(payload);

      setTransactionId(res.transactionId);
      setStep('OTP_VERIFY');
      setResendCooldown(30);
      setOtpCode('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !transactionId) return;
    setError(null);
    setResendingOtp(true);
    try {
      await authApi.resendRegistrationOtp(transactionId);
      setResendCooldown(30);
      setOtpCode('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleConfirmOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter the verification OTP received on your mobile');
      return;
    }

    setError(null);
    setOtpLoading(true);

    try {
      const authData = await authApi.confirmRegistration(transactionId, otpCode.trim());

      const userData = {
        id: authData.accountId || authData.id || authData.userId,
        fullName: authData.fullName || fullName,
        email: authData.email || email,
        phone: authData.phone || phone,
        role: (authData.role || role).toUpperCase(),
        profilePictureUrl: authData.profilePictureUrl || profileImagePreview || '',
        licenseNumber: authData.licenseNumber || licenseNumber || '',
      };

      setUser(userData);

      if (role === 'DRIVER') {
        navigate('/driver/dashboard');
      } else {
        navigate('/activity');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid or expired OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#f8f9fa] py-12 px-4 sm:px-6">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-gray-200/90 shadow-sm p-8 sm:p-10 space-y-6">

        {step === 'FORM' && (
          <>
            <div className="text-center space-y-1">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-black text-white items-center justify-center font-black text-xl mb-2 shadow-xs">
                R
              </div>
              <h1 className="text-2xl font-black tracking-tight text-gray-950">
                Create an account
              </h1>
              <p className="text-xs text-gray-500">
                Join RideWay as a Rider or Driver Partner
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl border border-gray-200">
              <button
                type="button"
                onClick={() => setRole('RIDER')}
                className={`py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${role === 'RIDER'
                    ? 'bg-black text-white shadow-xs font-black'
                    : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                  }`}
              >
                Rider (Passenger)
              </button>
              <button
                type="button"
                onClick={() => setRole('DRIVER')}
                className={`py-2.5 text-xs font-bold rounded-xl transition cursor-pointer ${role === 'DRIVER'
                    ? 'bg-black text-white shadow-xs font-black'
                    : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                  }`}
              >
                Driver Partner
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">

              <div className="flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-2xl">
                <div className="relative w-14 h-14 rounded-2xl bg-gray-200 border border-gray-300 overflow-hidden flex items-center justify-center shrink-0">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-gray-900 block">Profile Picture (Optional)</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-700 transition"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{profileImagePreview ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Full Name</label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-950 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-950 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Mobile Number</label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="Enter your mobile number"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-950 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              {role === 'DRIVER' && (
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3.5">
                  <span className="text-xs font-black text-gray-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Driver Partner Details</span>
                  </span>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Driving License Number</label>
                    <input
                      type="text"
                      required
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                      placeholder="Enter your driving license number"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-xs font-mono font-bold text-gray-950 focus:outline-none focus:border-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Type</label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-gray-300 text-xs font-bold text-gray-950 focus:outline-none focus:border-black"
                      >
                        <option value="AUTO">🛺 Auto</option>
                        <option value="MOTO">🏍️ Bike</option>
                        <option value="CAB">🚗 Cab</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Vehicle Number</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        placeholder="Enter your vehicle number"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-xs font-mono font-bold text-gray-950 focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Password</label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-950 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Confirm Password</label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Confirm your password"
                      className="w-full pl-10 pr-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-950 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-black text-white font-black text-sm hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{hasPhone ? 'Sending Verification OTP...' : 'Registering...'}</span>
                  </>
                ) : (
                  <>
                    <span>{hasPhone ? 'Verify Mobile & Register' : 'Register'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-black hover:underline">
                Sign in
              </Link>
            </div>
          </>
        )}

        {step === 'OTP_VERIFY' && (
          <div className="space-y-6 animate-in fade-in">
            <button
              type="button" onClick={() => {
                setStep('FORM');
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Edit Details</span>
            </button>

            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-gray-950 tracking-tight">
                Verify Mobile Number
              </h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                We sent a verification OTP via SMS to <strong className="text-gray-900">{phone}</strong>. Enter the code below to complete registration.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleConfirmOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block text-center">
                  Enter  Verification Code
                </label>
                <div className="relative flex justify-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    autoFocus
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''));
                      setError(null);
                    }}
                    placeholder="Enter OTP"
                    className="w-48 py-3.5 px-3 text-center font-mono font-black text-2xl tracking-[0.25em] rounded-2xl bg-gray-50 border-2 border-gray-300 focus:bg-white focus:outline-none focus:border-black transition shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpCode.length < 4}
                className="w-full py-4 rounded-2xl bg-black text-white font-black text-sm hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {otpLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying OTP & Registering...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Verify & Complete Registration</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                <span className="text-gray-500">Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendingOtp || resendCooldown > 0}
                  className="font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 transition"
                >
                  {resendingOtp
                    ? 'Sending...'
                    : resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : 'Resend OTP'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
