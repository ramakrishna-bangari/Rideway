import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { driverApi } from '../api/driver';
import api from '../api/axios';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Trash2,
  Phone,
  KeyRound,
  X,
  User,
  Pencil,
  Lock,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const Account = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [isEditing, setIsEditing] = useState(false);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [vehicleType, setVehicleType] = useState(
    localStorage.getItem('rideway_driver_vehicle_type') || user?.vehicleType || 'AUTO'
  );
  const [vehicleNumber, setVehicleNumber] = useState(
    user?.vehicleNumber || localStorage.getItem('rideway_driver_vehicle_number') || ''
  );
  const [licenseNumber, setLicenseNumber] = useState(user?.licenseNumber || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [changePhoneToken, setChangePhoneToken] = useState('');
  const [pendingNewPhone, setPendingNewPhone] = useState('');
  const [phoneOtpError, setPhoneOtpError] = useState(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changeStep, setChangeStep] = useState('CURRENT_PWD');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [changeOtp, setChangeOtp] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState(null);
  const [changeSuccess, setChangeSuccess] = useState(null);
  const [changeCooldown, setChangeCooldown] = useState(0);

  React.useEffect(() => {
    if (changeCooldown <= 0) return;
    const timer = setInterval(() => setChangeCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [changeCooldown]);

  React.useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.phone) setPhone(user.phone);
      if (user.vehicleType) setVehicleType(user.vehicleType);
      if (user.vehicleNumber) setVehicleNumber(user.vehicleNumber);
      if (user.licenseNumber) setLicenseNumber(user.licenseNumber);
    }
    if (user?.role === 'DRIVER') {
      driverApi.getAvailability().then((avail) => {
        if (user?.vehicleType) {
          const vt = String(user.vehicleType).toUpperCase();
          setVehicleType(vt);
          localStorage.setItem('rideway_driver_vehicle_type', vt);
          if (avail?.vehicleType !== vt) {
            driverApi.updateAvailability(avail?.status || 'AVAILABLE', vt).catch(() => {});
          }
        } else if (avail?.vehicleType) {
          const vt = String(avail.vehicleType).toUpperCase();
          setVehicleType(vt);
          localStorage.setItem('rideway_driver_vehicle_type', vt);
          if (updateUser) updateUser({ vehicleType: vt });
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const compressImage = (file, maxDim = 480) => {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name || 'avatar.jpg', { type: 'image/jpeg' }));
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.82
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setError(null);
    setMessage(null);
    setUploadingImage(true);

    try {
      const fileToUpload = await compressImage(rawFile);
      const res = await authApi.uploadProfilePicture(fileToUpload);
      const newUrl = res?.url || res?.imageUrl;
      if (newUrl) {
        if (updateUser) {
          updateUser({ profilePictureUrl: newUrl });
        }
        if (user?.id) {
          const endpoint = user.role === 'DRIVER' ? `/api/drivers/${user.id}` : `/api/riders/${user.id}`;
          try {
            await api.put(endpoint, {
              fullName: fullName || user.fullName || '',
              phone: phone || user.phone || '',
              profilePictureUrl: newUrl,
            });
          } catch { }
        }
        setMessage('Profile photo updated successfully!');
      } else {
        throw new Error('No image URL returned');
      }
    } catch (err) {
      setError('Could not upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
    setError(null);
    setMessage(null);
    try {
      if (updateUser) {
        updateUser({ profilePictureUrl: null });
      }
      if (user?.id) {
        const endpoint = user.role === 'DRIVER' ? `/api/drivers/${user.id}` : `/api/riders/${user.id}`;
        try {
          await api.put(endpoint, {
            fullName: fullName || user.fullName || '',
            phone: phone || user.phone || '',
            profilePictureUrl: null,
          });
        } catch { }
      }
      setMessage('Profile photo removed.');
    } catch (err) {
      setError('Could not remove photo.');
    }
  };

  const handleCancelEdit = () => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setVehicleType(user?.vehicleType || localStorage.getItem('rideway_driver_vehicle_type') || 'AUTO');
    setVehicleNumber(user?.vehicleNumber || localStorage.getItem('rideway_driver_vehicle_number') || '');
    setLicenseNumber(user?.licenseNumber || '');
    setError(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setSavingProfile(true);

    try {
      const cleanVehicle = (vehicleType || 'AUTO').toUpperCase();
      const cleanVehicleNum = (vehicleNumber || '').trim();

      if (user?.id) {
        const endpoint = user.role === 'DRIVER' ? `/api/drivers/${user.id}` : `/api/riders/${user.id}`;
        const updatePayload = {
          fullName: fullName.trim(),
          phone: phone.trim(),
          profilePictureUrl: user.profilePictureUrl || '',
        };
        if (user.role === 'DRIVER') {
          updatePayload.licenseNumber = licenseNumber.trim();
          updatePayload.vehicleType = cleanVehicle;
          updatePayload.vehicleNumber = cleanVehicleNum;
        }
        await api.put(endpoint, updatePayload);
      }

      if (user?.role === 'DRIVER') {
        localStorage.setItem('rideway_driver_vehicle_type', cleanVehicle);
        localStorage.setItem('rideway_driver_vehicle_number', cleanVehicleNum);
        try {
          await driverApi.updateAvailability('AVAILABLE', cleanVehicle);
        } catch (e) {
          console.warn('Syncing vehicle type to dispatch service notice:', e);
        }
      }

      if (updateUser) {
        await updateUser({
          fullName: fullName.trim(),
          phone: phone.trim(),
          vehicleType: cleanVehicle,
          vehicleNumber: cleanVehicleNum,
          licenseNumber: licenseNumber.trim(),
        });
      }

      setMessage('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to update profile details.';
      setError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendOtp = async () => {
    const rawDigits = phone ? phone.replace(/[^0-9]/g, '').trim() : '';
    if (!rawDigits || rawDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setMessage(null);
    setPhoneOtpError(null);
    setOtpSending(true);

    try {
      const res = await authApi.requestChangePhoneOtp(rawDigits, { email: user?.email, role: user?.role });
      setChangePhoneToken(res?.changePhoneToken || '');
      setPendingNewPhone(rawDigits);
      setShowOtpModal(true);
      setMessage(`Verification code dispatched to +91 ${rawDigits}`);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to dispatch OTP code.';
      setError(msg);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 4) {
      setPhoneOtpError('Please enter the 6-digit OTP code.');
      return;
    }
    setPhoneOtpError(null);
    setOtpVerifying(true);

    try {
      const res = await authApi.confirmChangePhone(
        changePhoneToken,
        otpCode.trim(),
        pendingNewPhone,
        { email: user?.email, role: user?.role }
      );
      const updatedPhone = res?.phone || pendingNewPhone;
      setPhone(updatedPhone);
      setPhoneVerified(true);
      setShowOtpModal(false);
      setOtpCode('');
      setChangePhoneToken('');
      localStorage.setItem('rideway_user_phone', updatedPhone);
      if (updateUser) {
        await updateUser({ phone: updatedPhone });
      }
      setMessage('Mobile number updated and verified successfully in your account!');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Invalid or expired OTP.';
      setPhoneOtpError(msg);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeletePasswordError(null);

    if (!deletePassword || deletePassword.trim().length < 6) {
      setDeletePasswordError('Please enter your password (minimum 6 characters) to confirm deletion.');
      return;
    }

    setDeleting(true);

    try {
      if (user?.role === 'DRIVER') {
        try {
          await driverApi.updateAvailability('OFFLINE');
        } catch { }
      }

      localStorage.removeItem('rideway_driver_vehicle_type');
      localStorage.removeItem('rideway_driver_vehicle_number');

      try {
        await api.delete('/api/auth/account', {
          data: { password: deletePassword },
        });
      } catch { }

      setShowDeleteConfirm(false);
      await logout();
      navigate('/');
    } catch (err) {
      setDeletePasswordError('Failed to delete account. Please check your password and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRequestChangePasswordOtp = async (e) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(null);

    if (!currentPassword || currentPassword.length < 6) {
      setChangeError('Please enter your current password');
      return;
    }

    setChangeLoading(true);
    try {
      const res = await authApi.requestChangePasswordOtp(currentPassword);
      setChangeToken(res.changeToken);
      setChangeStep('OTP_CONFIRM');
      setChangeCooldown(30);
    } catch (err) {
      setChangeError(err.response?.data?.message || err.message || 'Failed to verify current password or dispatch OTP');
    } finally {
      setChangeLoading(false);
    }
  };

  const handleConfirmChangePassword = async (e) => {
    e.preventDefault();
    setChangeError(null);

    if (!changeOtp || changeOtp.trim().length < 4) {
      setChangeError('Please enter the verification OTP sent to your registered mobile');
      return;
    }
    if (newPassword.length < 8) {
      setChangeError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangeError('New passwords do not match');
      return;
    }

    setChangeLoading(true);
    try {
      await authApi.confirmChangePassword(changeToken, changeOtp.trim(), currentPassword, newPassword);
      setChangeSuccess('Password changed successfully!');
      setTimeout(() => {
        setShowChangePassword(false);
        setChangeStep('CURRENT_PWD');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setChangeOtp('');
        setChangeSuccess(null);
      }, 2500);
    } catch (err) {
      setChangeError(err.response?.data?.message || err.message || 'Failed to update password. Please check the OTP.');
    } finally {
      setChangeLoading(false);
    }
  };

  const getVehicleDisplay = () => {
    const type = (vehicleType || 'AUTO').toUpperCase();
    if (type.includes('MOTO') || type.includes('BIKE')) {
      return { icon: '🏍️', name: 'Bike', capacity: '1 Seat' };
    }
    if (type.includes('CAB') || type.includes('CAR')) {
      return { icon: '🚗', name: 'Cab', capacity: '4 Seats' };
    }
    return { icon: '🛺', name: 'Auto', capacity: '3 Seats' };
  };

  const currentVehicle = getVehicleDisplay();

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-gray-50 text-gray-900 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-black transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {isEditing ? 'Editing Profile' : 'My Account'}
          </span>
        </div>

        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="relative">
                {user?.profilePictureUrl ? (
                  <img
                    src={user.profilePictureUrl}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xl">
                    {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
                  </div>
                )}

                {isEditing && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black text-white border border-white shadow-md flex items-center justify-center hover:bg-neutral-800 transition"
                    title="Upload profile picture"
                  >
                    {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {user?.fullName || user?.name || user?.email?.split('@')[0] || 'User'}
                </h1>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">
                    {user?.role === 'DRIVER' ? 'Driver Partner' : 'Rider'}
                  </span>
                  {user?.role === 'DRIVER' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Verified
                    </span>
                  )}
                </div>

                {isEditing && user?.profilePictureUrl && (
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-1 mt-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Photo</span>
                  </button>
                )}
              </div>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 hover:text-black transition shadow-xs self-start sm:self-auto"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-6">

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
                    <span className="text-gray-500 block mb-0.5">Full Name</span>
                    <span className="font-semibold text-gray-900 text-sm">
                      {user?.fullName || user?.name || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
                    <span className="text-gray-500 block mb-0.5">Email Address</span>
                    <span className="font-semibold text-gray-900 text-sm">{user?.email}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 block mb-0.5">Phone Number</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {user?.phone || phone || 'Not provided'}
                      </span>
                    </div>
                    {phoneVerified && (
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {user?.role === 'DRIVER' && (
                <div className="pt-2 border-t border-gray-100">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                    Driver & Vehicle Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
                      <span className="text-gray-500 block mb-0.5">Driving License Number</span>
                      <span className="font-mono font-bold text-gray-900 text-sm">
                        {user?.licenseNumber || licenseNumber || 'Not specified'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80">
                      <span className="text-gray-500 block mb-0.5">Vehicle License Plate</span>
                      <span className="font-mono font-bold text-gray-900 text-sm">
                        {user?.vehicleNumber || vehicleNumber || 'Not specified'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 sm:col-span-2 flex items-center justify-between">
                      <div>
                        <span className="text-gray-500 block mb-0.5">Active Vehicle Category</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-lg">{currentVehicle.icon}</span>
                          <span className="font-bold text-gray-900 text-sm">{currentVehicle.name}</span>
                          <span className="text-xs text-gray-500">({currentVehicle.capacity})</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                        Registered
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="space-y-4">

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-500 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-gray-400">Email address cannot be changed.</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700">Phone Number</label>
                    <span className="text-[10px] text-gray-400">Verified via 2Factor OTP</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      className="px-3.5 py-2.5 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {otpSending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Verify & Change</span>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    To change mobile number, enter new 10-digit number and click Verify & Change. Cross-table check ensures uniqueness across rider & driver accounts.
                  </p>
                </div>

                {user?.role === 'DRIVER' && (
                  <div className="pt-3 border-t border-gray-100 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">
                      Driver & Vehicle Information
                    </h3>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Driving License Number</label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="Enter driving license number"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-700">Select Vehicle Category</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        {[
                          { id: 'AUTO', name: 'Auto', icon: '🛺', capacity: '3 Seats' },
                          { id: 'MOTO', name: 'Bike', icon: '🏍️', capacity: '1 Seat' },
                          { id: 'CAB', name: 'Cab', icon: '🚗', capacity: '4 Seats' },
                        ].map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVehicleType(v.id)}
                            className={`p-3 rounded-xl border text-center transition ${vehicleType === v.id
                                ? 'border-black bg-gray-50 ring-2 ring-black font-bold'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                              }`}
                          >
                            <span className="text-2xl block mb-1">{v.icon}</span>
                            <span className="text-xs block font-bold text-gray-900">{v.name}</span>
                            <span className="text-[10px] block text-gray-500">{v.capacity}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700">Vehicle License Plate</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        placeholder="Enter vehicle license plate"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={savingProfile}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-xs font-bold text-white transition shadow-xs flex items-center gap-2"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-950">Change Password</h3>
              </div>
              <p className="text-xs text-gray-500">
                Update your account password with mandatory 2Factor OTP verification to your registered mobile number.
              </p>
            </div>
            {!showChangePassword && (
              <button
                type="button"
                onClick={() => {
                  setShowChangePassword(true);
                  setChangeStep('CURRENT_PWD');
                  setChangeError(null);
                  setChangeSuccess(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setChangeOtp('');
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-300 hover:border-black bg-white text-gray-900 text-xs font-bold transition flex items-center justify-center gap-1.5 self-start sm:self-auto flex-shrink-0 cursor-pointer shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                <span>Change Password</span>
              </button>
            )}
          </div>

          {showChangePassword && (
            <div className="pt-4 border-t border-gray-100 space-y-4 animate-in fade-in">
              {changeError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{changeError}</span>
                </div>
              )}

              {changeSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{changeSuccess}</span>
                </div>
              )}

              {changeStep === 'CURRENT_PWD' && (
                <form onSubmit={handleRequestChangePasswordOtp} className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Enter Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Your current password"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-black transition"
                    />
                    <span className="text-[11px] text-gray-400 mt-1 block">
                      A verification OTP will be dispatched to your registered phone ending in {user?.phone ? user.phone.slice(-4) : '****'} via 2Factor SMS.
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(false)}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={changeLoading || !currentPassword}
                      className="px-5 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                      {changeLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Requesting 2Factor OTP...</span>
                        </>
                      ) : (
                        <span>Request OTP</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {changeStep === 'OTP_CONFIRM' && (
                <form onSubmit={handleConfirmChangePassword} className="space-y-4 max-w-md animate-in fade-in">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>2Factor OTP sent to your registered mobile. Enter OTP and your new password.</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">2Factor Verification OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      required
                      autoFocus
                      value={changeOtp}
                      onChange={(e) => setChangeOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter OTP"
                      className="w-40 px-3.5 py-2.5 text-center font-mono font-bold tracking-widest rounded-xl bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-black transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">New Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-black transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Repeat new password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-300 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-black transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setChangeStep('CURRENT_PWD')}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={changeLoading || changeOtp.length < 4}
                      className="px-5 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition disabled:opacity-50 flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                      {changeLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying & Updating...</span>
                        </>
                      ) : (
                        <span>Confirm & Update Password</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-red-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-600" />
                <h3 className="text-sm font-bold text-gray-950">Delete Account</h3>
              </div>
              <p className="text-xs text-gray-500">
                Permanently remove your RideWay {user?.role === 'DRIVER' ? 'driver partner' : 'rider'} account and profile data. Requires your password to confirm.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeletePassword('');
                setDeletePasswordError(null);
                setShowDeleteConfirm(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold transition flex items-center justify-center gap-1.5 self-start sm:self-auto flex-shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Delete My Account</span>
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-gray-900">Delete Account</h3>
                <p className="text-xs text-gray-500 mt-1">
                  This action is permanent and will delete your profile data. Please enter your password to confirm.
                </p>
              </div>

              <form onSubmit={handleDeleteAccount} className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => {
                        setDeletePassword(e.target.value);
                        setDeletePasswordError(null);
                      }}
                      autoComplete="current-password"
                      placeholder="Enter your current password"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                      autoFocus
                    />
                    <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-3" />
                  </div>
                  {deletePasswordError && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">{deletePasswordError}</p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                      setDeletePasswordError(null);
                    }}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Confirm Delete</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl border border-gray-200 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-xs text-gray-900">Verify Phone Number</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-600">
                Enter the OTP sent to <strong className="text-gray-900">+91 {pendingNewPhone || phone}</strong>
              </p>

              {phoneOtpError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{phoneOtpError}</span>
                </div>
              )}

              <div className="space-y-3">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="6-digit OTP"
                  className="w-full py-2.5 px-3 text-center font-mono text-lg tracking-widest rounded-xl bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpVerifying || otpCode.length < 4}
                  className="w-full py-2.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
                >
                  {otpVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Confirm & Verify</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Account;
