import React, { useState } from 'react';
import { useAuth } from '../../firebase/authContext';
import { Feather, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const FirebaseAuthScreen: React.FC = () => {
  const {
    authError,
    authSuccessMessage,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    if (!email) return;

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'register') {
        await signUpWithEmail(email, password, displayName);
      } else if (mode === 'reset') {
        await resetPassword(email);
      }
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080809] text-[#E8E6EB] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#B8A4D8]/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-indigo-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-[#0E0E12] border border-[#27272B] rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="p-8 pb-4 text-center border-b border-[#1C1C21]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#18181D] border border-[#27272B] flex items-center justify-center text-[#B8A4D8] shadow-sm shadow-[#B8A4D8]/20">
            <Feather className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-normal tracking-wide text-[#E8E6EB]">
            My Little World
          </h1>
          <p className="text-xs text-[#929099] font-light mt-1">
            {mode === 'login' && 'Sign in to access your private sanctuary'}
            {mode === 'register' && 'Create your private cloud-synchronized space'}
            {mode === 'reset' && 'Receive a password reset link to your email'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-4">
          {/* Error & Success Messages */}
          {authError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccessMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authSuccessMessage}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-[#15151A] hover:bg-[#1D1D24] border border-[#27272B] hover:border-[#38383F] text-xs font-light text-[#E8E6EB] transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-[#1C1C21]" />
                <span className="text-[11px] text-[#716E77] uppercase tracking-wider font-mono">or email</span>
                <div className="flex-1 h-px bg-[#1C1C21]" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-light text-[#929099] mb-1.5">
                  Your Sanctuary Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#716E77] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Eleanor"
                    className="w-full pl-9 pr-3 py-2 bg-[#121217] border border-[#27272B] focus:border-[#B8A4D8] rounded-xl text-xs text-[#E8E6EB] placeholder-[#5A5861] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-light text-[#929099] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#716E77] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@sanctuary.com"
                  className="w-full pl-9 pr-3 py-2 bg-[#121217] border border-[#27272B] focus:border-[#B8A4D8] rounded-xl text-xs text-[#E8E6EB] placeholder-[#5A5861] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-light text-[#929099]">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        clearAuthError();
                        setMode('reset');
                      }}
                      className="text-[11px] text-[#B8A4D8] hover:underline"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#716E77] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2 bg-[#121217] border border-[#27272B] focus:border-[#B8A4D8] rounded-xl text-xs text-[#E8E6EB] placeholder-[#5A5861] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#B8A4D8] hover:bg-[#A691CB] text-[#080809] font-medium text-xs tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm shadow-[#B8A4D8]/20"
            >
              <span>
                {isSubmitting
                  ? 'Connecting...'
                  : mode === 'login'
                  ? 'Sign In to Sanctuary'
                  : mode === 'register'
                  ? 'Create My Sanctuary'
                  : 'Send Reset Link'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="pt-2 text-center text-xs text-[#929099] font-light">
            {mode === 'login' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('register');
                  }}
                  className="text-[#B8A4D8] hover:underline font-normal"
                >
                  Create one
                </button>
              </p>
            ) : mode === 'register' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('login');
                  }}
                  className="text-[#B8A4D8] hover:underline font-normal"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('login');
                  }}
                  className="text-[#B8A4D8] hover:underline font-normal"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>

          {/* Temporary Debug Display: Origin & Hostname */}
          <div className="mt-4 pt-3 border-t border-[#1C1C21] font-mono text-xs space-y-2 bg-[#0A0A0E] p-3 rounded-xl border border-[#232328]">
            <div className="text-[10px] text-[#716E77] uppercase tracking-wider font-sans font-medium">
              Environment Debug
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
              <span className="text-[#929099] font-sans">origin:</span>
              <code className="text-[#B8A4D8] select-all break-all bg-[#141418] px-2 py-0.5 rounded border border-[#27272B]">
                {typeof window !== 'undefined' ? window.location.origin : ''}
              </code>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
              <span className="text-[#929099] font-sans">hostname:</span>
              <code className="text-[#B8A4D8] select-all break-all bg-[#141418] px-2 py-0.5 rounded border border-[#27272B]">
                {typeof window !== 'undefined' ? window.location.hostname : ''}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
