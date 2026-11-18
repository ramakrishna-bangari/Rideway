import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isAuthenticated, role, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || null;

  const redirectByRole = (resolvedRole) => {
    if (resolvedRole === 'DRIVER') {
      navigate('/driver/dashboard', { replace: true });
    } else if (resolvedRole === 'ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    } else if (from && !from.includes('/driver') && !from.includes('/admin') && from !== '/') {
      navigate(from, { replace: true });
    } else {
      navigate('/rider/dashboard', { replace: true });
    }
  };

  useEffect(() => {
    if (!loading && isAuthenticated && role) {
      redirectByRole(role);
    }
  }, [isAuthenticated, role, loading]);

  if (loading) {
    return (
      <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your phone number or email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login({ email: cleanIdentifier, password });
      const role = result?.user?.role || result?.role;
      redirectByRole(role);
    } catch (err) {
      let msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Authentication failed. Please verify your phone/email and password.';
      if (typeof msg === 'string' && (msg.includes('8080') || msg.toLowerCase().includes('gateway') || msg.includes('ECONNREFUSED') || msg.includes('Network Error'))) {
        msg = 'Authentication service is temporarily reconnecting. Please try again shortly.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-[#f8f9fa] py-12 px-4 sm:px-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200/90 shadow-sm p-8 sm:p-10 space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-black text-white items-center justify-center font-black text-xl mb-2 shadow-xs">
            R
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-950">
            Sign In
          </h1>
          <p className="text-xs text-gray-500">
            Enter your phone number or email and password
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Phone Number or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                required
                placeholder="Enter your email or phone number"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-700">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-[11px] text-gray-500 hover:text-black font-semibold transition"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-black transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-black text-white font-bold text-xs hover:bg-neutral-800 transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 pt-2">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-black hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
