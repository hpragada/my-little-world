import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Moon,
  Download,
  RotateCcw,
  Shield,
  Palette,
  Check,
  Smartphone,
  Cloud,
  Lock,
  LogIn,
  LogOut,
  Sparkles,
  ShieldCheck,
  KeyRound,
  Grid,
  Fingerprint,
  AlertCircle,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../firebase/authContext';
import { useAppPin } from '../../context/AppPinContext';
import { PatternLock } from '../auth/PatternLock';
import { Capacitor } from '@capacitor/core';
import { LockMethod } from '../../services/appPinService';

export const SettingsView: React.FC = () => {
  const {
    userProfile,
    updateUserProfile,
    toggleLowEnergyMode,
    toggleJournalAwareAI,
    resetAllData,
    tasks,
    journalEntries,
    memories,
    dreams,
    events,
    setActiveTab,
  } = useApp();

  const { currentUser, isGuest, openAuthModal, signOutUser } = useAuth();
  const {
    hasPin,
    pinLength,
    hasPattern,
    preferredLockMethod,
    changeLockMethod,
    setupPin,
    setupPattern,
    verifyCurrentLock,
    lockApp,
  } = useAppPin();

  const [name, setName] = useState(userProfile.name);
  const [subtitle, setSubtitle] = useState(userProfile.subtitle);
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Security Modal State
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityModalTarget, setSecurityModalTarget] = useState<'pin' | 'pattern' | null>(null);
  const [securityStep, setSecurityStep] = useState<'verify-old' | 'input-new' | 'confirm-new'>('verify-old');
  const [oldPinInput, setOldPinInput] = useState('');
  const [oldVerifyType, setOldVerifyType] = useState<'pin' | 'pattern'>('pin');
  const [newPinLength, setNewPinLength] = useState<3 | 4>(4);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [firstPattern, setFirstPattern] = useState<number[] | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isSubmittingSecurity, setIsSubmittingSecurity] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name: name.trim() || 'Eleanor',
      subtitle: subtitle.trim() || 'Welcome to your little world.',
    });
    setShowSavedNotice(true);
    setTimeout(() => setShowSavedNotice(false), 2500);
  };

  const handleExportData = () => {
    const backupData = {
      userProfile,
      tasks,
      journalEntries,
      memories,
      dreams,
      events,
      exportedAt: new Date().toISOString(),
      app: 'My Little World',
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `my-little-world-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
          <span>Preferences</span>
          <span>·</span>
          <span className="text-[#B8A4D8]">Sanctuary Settings</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
          Settings & Sanctuary
        </h1>
        <p className="text-sm font-light text-[#929099] mt-1">
          Customize your experience, manage your private local data, and review your sanctuary theme.
        </p>
      </div>

      {/* Cloud Account & Synchronization */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-normal text-[#E8E6EB] flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#B8A4D8]" />
              <span>Sanctuary Account & Cloud Sync</span>
            </h2>
            <p className="text-xs font-light text-[#929099] mt-0.5">
              Secure multi-device synchronization with isolated user UID rules and client-side encryption
            </p>
          </div>
          {currentUser ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/50 text-[11px] text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Cloud Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A1A22] border border-[#27272B] text-[11px] text-[#929099]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#716E77]" />
              <span>Local Storage</span>
            </div>
          )}
        </div>

        {currentUser ? (
          <div className="p-4 rounded-xl bg-[#101012] border border-[#222227] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-[#E8E6EB]">
                  {currentUser.displayName || 'Sanctuary Keeper'}
                </span>
                <span className="text-xs text-[#929099] block font-light">
                  {currentUser.email}
                </span>
                <span className="text-[10px] text-[#716E77] font-mono block mt-1">
                  UID: {currentUser.uid}
                </span>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-900/50 hover:bg-rose-950/20 text-rose-300 text-xs transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
            <div className="pt-2 border-t border-[#1C1C21] flex items-center gap-2 text-[11px] text-emerald-400/90 font-light">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Private Vault records remain strictly client-side AES-GCM encrypted.</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#101012] border border-[#222227] space-y-3">
            <p className="text-xs text-[#929099] font-light leading-relaxed">
              You are currently using local storage. Signing in allows your journal, dreams, future letters, and files to synchronize seamlessly across all your devices without overwriting local data.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B8A4D8] hover:bg-[#A691CB] text-[#080809] text-xs font-medium transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Create Account</span>
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#27272B] hover:border-[#383842] text-[#E8E6EB] text-xs font-light transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#B8A4D8]" />
                <span>New Account</span>
              </button>
            </div>
          </div>
        )}

        {/* Sanctuary Lock & Security (3 Unlock Options: PIN, Pattern, Biometric) */}
        {currentUser && (
          <div className="p-5 rounded-xl bg-[#101012] border border-[#222227] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1C1C21]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#18181D] border border-[#27272B] flex items-center justify-center text-[#B8A4D8]">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-medium text-[#E8E6EB] block">
                    Sanctuary Security & Lock Options
                  </span>
                  <span className="text-[11px] text-[#929099] font-light block">
                    Choose your preferred unlock method: Short PIN (3 or 4 digits), Pattern, or Biometrics.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={lockApp}
                className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-[#1A1A20] hover:bg-[#22222A] border border-[#2B2B34] text-[#B8A4D8] text-xs font-light transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Now</span>
              </button>
            </div>

            {/* Three Unlock Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Short PIN */}
              <div
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  preferredLockMethod === 'pin'
                    ? 'bg-[#14141B] border-[#B8A4D8]/50 shadow-sm shadow-[#B8A4D8]/10'
                    : 'bg-[#0E0E12] border-[#222228]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#E8E6EB]">
                      <KeyRound className="w-3.5 h-3.5 text-[#B8A4D8]" />
                      <span>Short PIN Lock</span>
                    </div>
                    {preferredLockMethod === 'pin' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#B8A4D8]/20 text-[#B8A4D8] border border-[#B8A4D8]/30 font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#929099] font-light leading-relaxed">
                    Fast 3-digit or 4-digit numeric code with PBKDF2-SHA256 (100k rounds) & brute-force protection.
                  </p>
                  <div className="text-[11px] text-[#B8A4D8] font-mono">
                    Status: {hasPin ? `${pinLength}-digit PIN active` : 'Not set up'}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#1C1C21]">
                  {preferredLockMethod !== 'pin' && hasPin && (
                    <button
                      type="button"
                      onClick={() => changeLockMethod('pin')}
                      className="px-2.5 py-1 rounded-lg bg-[#181820] hover:bg-[#20202A] border border-[#2B2B34] text-[11px] text-[#E8E6EB] transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSecurityModalTarget('pin');
                      setSecurityStep('verify-old');
                      setOldPinInput('');
                      setOldVerifyType(hasPin ? 'pin' : 'pattern');
                      setNewPinLength(4);
                      setNewPinInput('');
                      setConfirmPinInput('');
                      setModalError(null);
                      setModalSuccess(null);
                      setIsSecurityModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] text-[#B8A4D8] hover:bg-[#B8A4D8]/10 transition-colors ml-auto"
                  >
                    {hasPin ? 'Change PIN' : 'Set Up PIN'}
                  </button>
                </div>
              </div>

              {/* Option 2: Pattern Lock */}
              <div
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  preferredLockMethod === 'pattern'
                    ? 'bg-[#14141B] border-[#B8A4D8]/50 shadow-sm shadow-[#B8A4D8]/10'
                    : 'bg-[#0E0E12] border-[#222228]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#E8E6EB]">
                      <Grid className="w-3.5 h-3.5 text-[#B8A4D8]" />
                      <span>Pattern Lock</span>
                    </div>
                    {preferredLockMethod === 'pattern' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#B8A4D8]/20 text-[#B8A4D8] border border-[#B8A4D8]/30 font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#929099] font-light leading-relaxed">
                    Android-style 3×3 dot pattern with interactive touch lines and salted PBKDF2 hash.
                  </p>
                  <div className="text-[11px] text-[#B8A4D8] font-mono">
                    Status: {hasPattern ? '3×3 Pattern active' : 'Not configured'}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#1C1C21]">
                  {preferredLockMethod !== 'pattern' && hasPattern && (
                    <button
                      type="button"
                      onClick={() => changeLockMethod('pattern')}
                      className="px-2.5 py-1 rounded-lg bg-[#181820] hover:bg-[#20202A] border border-[#2B2B34] text-[11px] text-[#E8E6EB] transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSecurityModalTarget('pattern');
                      setSecurityStep('verify-old');
                      setOldPinInput('');
                      setOldVerifyType(hasPin ? 'pin' : 'pattern');
                      setFirstPattern(null);
                      setModalError(null);
                      setModalSuccess(null);
                      setIsSecurityModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] text-[#B8A4D8] hover:bg-[#B8A4D8]/10 transition-colors ml-auto"
                  >
                    {hasPattern ? 'Change Pattern' : 'Set Up Pattern'}
                  </button>
                </div>
              </div>

              {/* Option 3: Fingerprint / Biometric */}
              <div
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  preferredLockMethod === 'biometric'
                    ? 'bg-[#14141B] border-[#B8A4D8]/50 shadow-sm shadow-[#B8A4D8]/10'
                    : 'bg-[#0E0E12] border-[#222228]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#E8E6EB]">
                      <Fingerprint className="w-3.5 h-3.5 text-[#B8A4D8]" />
                      <span>Fingerprint / Biometric</span>
                    </div>
                    {preferredLockMethod === 'biometric' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#B8A4D8]/20 text-[#B8A4D8] border border-[#B8A4D8]/30 font-medium">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#929099] font-light leading-relaxed">
                    Native device biometric prompt via Capacitor. Zero biometric data stored. PIN kept as immutable fallback.
                  </p>
                  <div className="text-[10px] text-[#716E77] leading-relaxed">
                    {Capacitor.isNativePlatform()
                      ? '✓ Native device environment active'
                      : 'ℹ Web preview: PIN fallback is used until deployed on mobile'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1C1C21]">
                  {preferredLockMethod !== 'biometric' ? (
                    <button
                      type="button"
                      onClick={() => changeLockMethod('biometric')}
                      className="px-2.5 py-1 rounded-lg bg-[#181820] hover:bg-[#20202A] border border-[#2B2B34] text-[11px] text-[#B8A4D8] transition-colors"
                    >
                      Set as Default
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#929099] font-light">
                      Active (PIN fallback)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Credential Change Modal */}
        {isSecurityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="absolute inset-0"
              onClick={() => {
                if (!isSubmittingSecurity) setIsSecurityModalOpen(false);
              }}
            />
            <div className="relative z-10 w-full max-w-sm bg-[#101014] border border-[#27272B] rounded-2xl p-6 space-y-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#222228]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#181820] flex items-center justify-center text-[#B8A4D8]">
                    {securityModalTarget === 'pin' ? <KeyRound className="w-3.5 h-3.5" /> : <Grid className="w-3.5 h-3.5" />}
                  </div>
                  <h3 className="text-xs font-medium text-[#E8E6EB]">
                    {securityStep === 'verify-old'
                      ? 'Verify Current Credentials'
                      : securityModalTarget === 'pin'
                      ? 'Set Short PIN'
                      : 'Draw New Pattern'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  disabled={isSubmittingSecurity}
                  className="text-[#929099] hover:text-[#E8E6EB] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Feedback messages */}
              {modalError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}
              {modalSuccess && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-xs">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{modalSuccess}</span>
                </div>
              )}

              {/* STEP 1: Verify Old Credentials */}
              {securityStep === 'verify-old' && (
                <div className="space-y-4">
                  <p className="text-xs text-[#929099] font-light leading-relaxed">
                    To safely protect your data, please verify your current{' '}
                    {hasPin ? (pinLength === 6 ? '6-digit PIN' : 'PIN') : 'pattern'}{' '}
                    before changing your security settings.
                  </p>

                  {/* Toggle verification type if user has both */}
                  {hasPin && hasPattern && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setOldVerifyType('pin')}
                        className={`px-2.5 py-1 rounded-lg border ${
                          oldVerifyType === 'pin'
                            ? 'bg-[#1C1C24] border-[#B8A4D8] text-[#B8A4D8]'
                            : 'border-[#27272B] text-[#929099]'
                        }`}
                      >
                        Verify with PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setOldVerifyType('pattern')}
                        className={`px-2.5 py-1 rounded-lg border ${
                          oldVerifyType === 'pattern'
                            ? 'bg-[#1C1C24] border-[#B8A4D8] text-[#B8A4D8]'
                            : 'border-[#27272B] text-[#929099]'
                        }`}
                      >
                        Verify with Pattern
                      </button>
                    </div>
                  )}

                  {oldVerifyType === 'pin' ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!oldPinInput) return;
                        setIsSubmittingSecurity(true);
                        setModalError(null);
                        try {
                          const res = await verifyCurrentLock({ type: 'pin', pin: oldPinInput });
                          if (res.success) {
                            setSecurityStep('input-new');
                          } else {
                            setModalError(res.error || 'Incorrect PIN. Please re-enter.');
                          }
                        } catch {
                          setModalError('Verification failed.');
                        } finally {
                          setIsSubmittingSecurity(false);
                        }
                      }}
                      className="space-y-3"
                    >
                      <div>
                        <label className="block text-[11px] font-light text-[#929099] mb-1">
                          Current PIN {pinLength === 6 ? '(Enter your existing 6-digit PIN)' : `(${pinLength} digits)`}
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          autoFocus
                          value={oldPinInput}
                          onChange={(e) => setOldPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder={pinLength === 6 ? '••••••' : '••••'}
                          className="w-full px-3.5 py-2.5 bg-[#141418] border border-[#27272B] focus:border-[#B8A4D8] rounded-xl text-center text-sm font-mono tracking-widest text-[#E8E6EB] focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingSecurity || !oldPinInput}
                        className="w-full py-2.5 rounded-xl bg-[#B8A4D8] hover:bg-[#A691CB] text-[#080809] font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingSecurity ? 'Verifying...' : 'Verify and Proceed'}
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-3 flex flex-col items-center">
                      <span className="text-[11px] text-[#929099]">Draw your current pattern</span>
                      <PatternLock
                        size={240}
                        onComplete={async (pattern) => {
                          setIsSubmittingSecurity(true);
                          setModalError(null);
                          try {
                            const res = await verifyCurrentLock({ type: 'pattern', pattern });
                            if (res.success) {
                              setSecurityStep('input-new');
                            } else {
                              setModalError(res.error || 'Incorrect pattern.');
                            }
                          } catch {
                            setModalError('Pattern verification failed.');
                          } finally {
                            setIsSubmittingSecurity(false);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Input New Credentials */}
              {securityStep === 'input-new' && (
                <div className="space-y-4">
                  {securityModalTarget === 'pin' ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newPinInput.length !== newPinLength) {
                          setModalError(`Please enter a valid ${newPinLength}-digit PIN.`);
                          return;
                        }
                        if (newPinInput !== confirmPinInput) {
                          setModalError('PINs do not match. Please re-enter.');
                          return;
                        }
                        setIsSubmittingSecurity(true);
                        setModalError(null);
                        setupPin(newPinInput)
                          .then(() => {
                            setModalSuccess(`Your short ${newPinLength}-digit PIN has been saved.`);
                            setTimeout(() => setIsSecurityModalOpen(false), 1200);
                          })
                          .catch((err) => {
                            setModalError(err?.message || 'Failed to save PIN.');
                          })
                          .finally(() => setIsSubmittingSecurity(false));
                      }}
                      className="space-y-3.5"
                    >
                      {/* PIN Length Selection (3-Digit vs 4-Digit) */}
                      <div>
                        <label className="block text-[11px] font-light text-[#929099] mb-1.5">
                          Choose Short PIN Length
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewPinLength(3);
                              setNewPinInput('');
                              setConfirmPinInput('');
                            }}
                            className={`py-2 rounded-xl text-xs font-light transition-all border ${
                              newPinLength === 3
                                ? 'bg-[#1C1C24] border-[#B8A4D8] text-[#B8A4D8] font-medium'
                                : 'bg-[#141418] border-[#27272B] text-[#929099]'
                            }`}
                          >
                            3-Digit PIN
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPinLength(4);
                              setNewPinInput('');
                              setConfirmPinInput('');
                            }}
                            className={`py-2 rounded-xl text-xs font-light transition-all border ${
                              newPinLength === 4
                                ? 'bg-[#1C1C24] border-[#B8A4D8] text-[#B8A4D8] font-medium'
                                : 'bg-[#141418] border-[#27272B] text-[#929099]'
                            }`}
                          >
                            4-Digit PIN
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-light text-[#929099] mb-1">
                          Enter New {newPinLength}-Digit PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={newPinLength}
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder={newPinLength === 3 ? '•••' : '••••'}
                          className="w-full px-3.5 py-2.5 bg-[#141418] border border-[#27272B] focus:border-[#B8A4D8] rounded-xl text-center text-sm font-mono tracking-widest text-[#E8E6EB] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-light text-[#929099] mb-1">
                          Confirm New {newPinLength}-Digit PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={newPinLength}
                          value={confirmPinInput}
                          onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder={newPinLength === 3 ? '•••' : '••••'}
                          className="w-full px-3.5 py-2.5 bg-[#141418] border border-[#27272B] focus:border-[#B8A4D8] rounded-xl text-center text-sm font-mono tracking-widest text-[#E8E6EB] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={
                          isSubmittingSecurity ||
                          newPinInput.length !== newPinLength ||
                          confirmPinInput.length !== newPinLength
                        }
                        className="w-full py-2.5 rounded-xl bg-[#B8A4D8] hover:bg-[#A691CB] text-[#080809] font-medium text-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingSecurity ? 'Saving...' : 'Save New PIN'}
                      </button>
                    </form>
                  ) : (
                    /* Pattern Setup Step 1 */
                    <div className="space-y-3 flex flex-col items-center">
                      <span className="text-xs text-[#929099] font-light text-center">
                        Draw your new pattern (connect at least 4 dots)
                      </span>
                      <PatternLock
                        size={240}
                        onComplete={(pattern) => {
                          if (pattern.length < 4) {
                            setModalError('Pattern must connect at least 4 dots.');
                            return;
                          }
                          setFirstPattern(pattern);
                          setSecurityStep('confirm-new');
                          setModalError(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Confirm Pattern */}
              {securityStep === 'confirm-new' && securityModalTarget === 'pattern' && (
                <div className="space-y-3 flex flex-col items-center">
                  <span className="text-xs text-[#929099] font-light text-center">
                    Draw the pattern again to confirm
                  </span>
                  <PatternLock
                    size={240}
                    onComplete={async (pattern) => {
                      if (!firstPattern) {
                        setSecurityStep('input-new');
                        return;
                      }
                      const isMatch =
                        pattern.length === firstPattern.length &&
                        pattern.every((val, idx) => val === firstPattern[idx]);

                      if (!isMatch) {
                        setModalError('Patterns did not match. Draw again.');
                        setFirstPattern(null);
                        setSecurityStep('input-new');
                        return;
                      }

                      setIsSubmittingSecurity(true);
                      setModalError(null);
                      try {
                        await setupPattern(pattern);
                        setModalSuccess('Your pattern lock has been saved.');
                        setTimeout(() => setIsSecurityModalOpen(false), 1200);
                      } catch (err: any) {
                        setModalError(err?.message || 'Failed to save pattern.');
                      } finally {
                        setIsSubmittingSecurity(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFirstPattern(null);
                      setSecurityStep('input-new');
                      setModalError(null);
                    }}
                    className="text-xs text-[#B8A4D8] hover:underline"
                  >
                    Start Over
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Profile & Greeting Customization */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-5">
        <h2 className="text-sm font-normal text-[#E8E6EB]">
          Personal Presence
        </h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-light text-[#929099] mb-1.5">
              Your Preferred Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#101012] border border-[#27272B] text-xs sm:text-sm text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-light text-[#929099] mb-1.5">
              Greeting Message
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#101012] border border-[#27272B] text-xs sm:text-sm text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {showSavedNotice ? (
              <span className="text-xs text-[#B8A4D8] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Sanctuary profile updated</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#929099] font-light">
                Stored privately in your browser storage
              </span>
            )}
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors min-h-[44px]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </section>

      {/* Low Energy Mode Preference */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-[#B8A4D8]" />
            <h3 className="text-sm font-normal text-[#E8E6EB]">
              Low Energy Mode
            </h3>
          </div>
          <p className="text-xs font-light text-[#929099] max-w-md">
            Hides demanding metrics and replaces your dashboard with 3 gentle, nourishing tasks and peaceful reminders.
          </p>
        </div>

        <button
          onClick={toggleLowEnergyMode}
          className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-light transition-colors ${
            userProfile.lowEnergyMode
              ? 'bg-[#B8A4D8] text-[#080809] border-[#B8A4D8]'
              : 'bg-[#101012] text-[#929099] border-[#27272B]'
          }`}
        >
          {userProfile.lowEnergyMode ? 'Active' : 'Disabled'}
        </button>
      </section>

      {/* AI Privacy & Journal-Aware Mode Preference */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#B8A4D8]" />
            <h3 className="text-sm font-normal text-[#E8E6EB]">
              AI Assistant Privacy (Journal-Aware Mode)
            </h3>
          </div>
          <p className="text-xs font-light text-[#929099] max-w-md leading-relaxed">
            When OFF, no personal journal entries or reflections are shared with Gemini. When ON, Aria can reference your mood and recent thoughts for deeper contextual empathy. Photos are never shared.
          </p>
        </div>

        <button
          onClick={toggleJournalAwareAI}
          className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-light transition-colors self-start sm:self-auto ${
            userProfile.journalAwareAI
              ? 'bg-[#B8A4D8] text-[#080809] border-[#B8A4D8]'
              : 'bg-[#101012] text-[#929099] border-[#27272B]'
          }`}
        >
          {userProfile.journalAwareAI ? 'Enabled' : 'Disabled (Strict)'}
        </button>
      </section>

      {/* Palette Reference Card */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#B8A4D8]" />
          <h2 className="text-sm font-normal text-[#E8E6EB]">
            Aesthetic Black & Lavender Palette
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px] font-light">
          <div className="p-3 rounded-xl bg-[#080809] border border-[#27272B] space-y-1">
            <span className="block text-[#E8E6EB]">#080809</span>
            <span className="text-[#929099]">Main Canvas</span>
          </div>
          <div className="p-3 rounded-xl bg-[#101012] border border-[#27272B] space-y-1">
            <span className="block text-[#E8E6EB]">#101012</span>
            <span className="text-[#929099]">Secondary</span>
          </div>
          <div className="p-3 rounded-xl bg-[#151518] border border-[#27272B] space-y-1">
            <span className="block text-[#E8E6EB]">#151518</span>
            <span className="text-[#929099]">Cards</span>
          </div>
          <div className="p-3 rounded-xl bg-[#151518] border border-[#B8A4D8]/50 space-y-1">
            <span className="block text-[#B8A4D8]">#B8A4D8</span>
            <span className="text-[#929099]">Accent Lavender</span>
          </div>
        </div>
      </section>

      {/* Phase 2 Architecture & Integrations Roadmap */}
      <section className="p-6 rounded-2xl bg-[#101012] border border-[#27272B] space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#B8A4D8]" />
          <h2 className="text-sm font-normal text-[#E8E6EB]">
            Phase 2 Integration Ready
          </h2>
        </div>
        <p className="text-xs font-light text-[#929099] leading-relaxed">
          The Phase 1 visual foundation, component modularity, and data structures are crafted cleanly to connect with upcoming services:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-light text-[#929099]">
          <div className="p-3.5 rounded-xl bg-[#151518] border border-[#27272B] space-y-1">
            <div className="flex items-center gap-2 text-[#E8E6EB]">
              <Lock className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="font-normal">Real User Auth</span>
            </div>
            <span>Passwordless email / Google Sign-in to sync your private sanctuary across devices.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#151518] border border-[#27272B] space-y-1">
            <div className="flex items-center gap-2 text-[#E8E6EB]">
              <Cloud className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="font-normal">Cloud DB & Photo Sync</span>
            </div>
            <span>Encrypted cloud database for journals, memories, and personal dreams.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#151518] border border-[#27272B] space-y-1">
            <div className="flex items-center gap-2 text-[#E8E6EB]">
              <Moon className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="font-normal">Server-Side Gemini AI</span>
            </div>
            <span>Deep, secure conversation for Aria with memory recall and wellness routines.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#151518] border border-[#27272B] space-y-1">
            <div className="flex items-center gap-2 text-[#E8E6EB]">
              <Smartphone className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="font-normal">Android & PWA Install</span>
            </div>
            <span>Add to home screen or compile into an Android APK for full-screen sanctuary.</span>
          </div>
        </div>
      </section>

      {/* Files & Vault Security Card */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#B8A4D8]" />
            <h2 className="text-sm font-normal text-[#E8E6EB]">
              Files & Vault Security
            </h2>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#101012] border border-[#27272B] text-[#B8A4D8]">
            AES-256 GCM
          </span>
        </div>
        <p className="text-xs font-light text-[#929099] leading-relaxed">
          Your regular files are stored in your browser's private database. Your Private Vault items are protected by zero-knowledge Web Crypto authenticated encryption (PBKDF2 key derivation with 100,000 SHA-256 iterations and AES-GCM 256).
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => setActiveTab('files')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#E8E6EB] transition-colors"
          >
            Open My Files
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#B8A4D8]/15 border border-[#B8A4D8]/40 hover:bg-[#B8A4D8]/25 text-xs font-light text-[#B8A4D8] transition-colors"
          >
            Open Private Vault
          </button>
        </div>
      </section>

      {/* Data Management & Backup */}
      <section className="p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <h2 className="text-sm font-normal text-[#E8E6EB]">
          Data & Privacy
        </h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handleExportData}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#E8E6EB] flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#B8A4D8]" />
            <span>Export Sanctuary Backup (.json)</span>
          </button>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#101012] border border-[#27272B] hover:border-rose-400/50 text-xs font-light text-[#929099] hover:text-rose-300 flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Sample Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetAllData();
                  setConfirmReset(false);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-900/60 border border-rose-500/50 text-xs font-light text-rose-200"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="min-h-[44px] px-3 py-2 text-xs font-light text-[#929099] hover:text-[#E8E6EB]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
