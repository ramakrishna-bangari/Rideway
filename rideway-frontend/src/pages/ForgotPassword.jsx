import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { Phone, Lock, KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';

export const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState('PHONE');

  const [phone, setPhone] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const formatted = phone.trim().startsWith('+') ? phone.trim() : `+91${cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.substring(2) : cleanPhone}`;
      const res = await authApi.requestForgotPasswordOtp(formatted);
      setResetToken(res.resetToken);
      setStep('OTP');
      setResendCooldown(30);
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to send OTP. Please check your mobile number.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setResending(true);
    try {
      const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
      const formatted = phone.trim().startsWith('+') ? phone.trim() : `+91${cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.substring(2) : cleanPhone}`;
      const res = await authApi.requestForgotPasswordOtp(formatted);
      setResetToken(res.resetToken);
      setResendCooldown(30);
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.trim().length < 4) {
      setError('Please enter the verification OTP received on your mobile');
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyForgotPasswordOtp(resetToken, otp.trim());

      setStep('PASSWORD');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Incorrect or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authApi.confirmForgotPasswordReset(resetToken, newPassword);
      setStep('SUCCESS');
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update password. Authorization may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#f8f9fa] py-12 px-4 sm:px-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200/90 shadow-sm p-8 sm:p-10 space-y-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </Link>

        {step === 'PHONE' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mx-auto shadow-xs">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-gray-950 tracking-tight">
                Forgot Password
              </h1>
              <p className="text-xs text-gray-500">
                Enter your registered mobile number to verification OTP.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Registered Mobile Number</label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-950 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-black text-white font-black text-sm hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Sending  OTP...</span>
                  </>
                ) : (
                  <span>Send Verification Code</span>
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'OTP' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-gray-950 tracking-tight">
                Enter Verification OTP
              </h2>
              <p className="text-xs text-gray-500">
                We sent a  verification code to <strong className="text-gray-900">{phone}</strong>.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block text-center">
                  Verification Code
                </label>
                <div className="flex justify-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="OTP Code"
                    className="w-44 py-3 px-3 text-center font-mono font-black text-2xl tracking-[0.25em] rounded-2xl bg-gray-50 border-2 border-gray-300 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full py-4 rounded-2xl bg-black text-white font-black text-sm hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify OTP</span>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="font-bold text-gray-500 hover:text-black transition"
                >
                  Change Number
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resending || resendCooldown > 0}
                  className="font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 transition"
                >
                  {resending
                    ? 'Sending...'
                    : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend OTP'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'PASSWORD' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-gray-950 tracking-tight">
                Set New Password
              </h2>
              <p className="text-xs text-gray-500">
                OTP verified successfully. Create a new secure password for your account.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">New Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-950 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Confirm New Password</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-950 focus:bg-white focus:outline-none focus:border-black transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-black text-white font-black text-sm hover:bg-neutral-800 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="text-center space-y-4 py-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-gray-950">Password Updated!</h2>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Your password has been changed successfully. Redirecting you to sign in...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
