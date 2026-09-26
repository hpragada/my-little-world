import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../firebase/authContext';
import { useAppPin } from '../../context/AppPinContext';
import { Lock, ShieldAlert, Delete, LogOut, Clock, AlertCircle, Fingerprint, Grid, KeyRound, ArrowRight } from 'lucide-react';
import { PatternLock } from './PatternLock';
import { LockMethod } from '../../services/appPinService';

export const AppPinScreen: React.FC = () => {
  const { currentUser, signOutUser } = useAuth();
  const {
    hasPin,
    pinLength,
    hasPattern,
    preferredLockMethod,
    unlockWithPin,
    unlockWithPattern,
    unlockWithBiometric,
    setupPin,
    setupPattern,
    getLockoutStatus,
  } = useAppPin();

  // Active method being displayed right now (defaults to preferred method)
  const [activeMethod, setActiveMethod] = useState<LockMethod>(() => {
    if (preferredLockMethod === 'pattern' && hasPattern) return 'pattern';
    if (preferredLockMethod === 'biometric') return 'biometric';
    if (hasPattern && !hasPin) return 'pattern';
    return 'pin';
  });

  // Setup options (when user has neither PIN nor Pattern)
  const [setupType, setSetupType] = useState<'pin' | 'pattern'>('pin');
  const [targetPinLength, setTargetPinLength] = useState<3 | 4>(4);

  // PIN state
  const [pin, setPin] = useState<string>('');
  const [firstPin, setFirstPin] = useState<string>('');
  const [pinSetupStep, setPinSetupStep] = useState<'create' | 'confirm'>('create');

  // Pattern state
  const [firstPattern, setFirstPattern] = useState<number[] | null>(null);
  const [patternSetupStep, setPatternSetupStep] = useState<'create' | 'confirm'>('create');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [patternResetTrigger, setPatternResetTrigger] = useState<boolean>(false);

  // Persistent lockout timer
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync active method if preferred changes or when user locks
  useEffect(() => {
    if (preferredLockMethod === 'pattern' && hasPattern) {
      setActiveMethod('pattern');
    } else if (preferredLockMethod === 'biometric') {
      setActiveMethod('biometric');
    } else if (hasPattern && !hasPin) {
      setActiveMethod('pattern');
    } else {
      setActiveMethod('pin');
    }
  }, [preferredLockMethod, hasPattern, hasPin]);

  // Lockout check
  useEffect(() => {
    const status = getLockoutStatus();
    if (status.isLocked && status.remainingSeconds > 0) {
      setLockoutSeconds(status.remainingSeconds);
    } else {
      setLockoutSeconds(0);
    }
  }, [getLockoutStatus, currentUser?.uid]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds > 0) {
      timerRef.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockoutSeconds]);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setPin('');
    setPatternResetTrigger(true);
    setTimeout(() => {
      setIsShaking(false);
      setPatternResetTrigger(false);
    }, 600);
  };

  // ================= PIN DIGIT HANDLING =================
  const effectivePinLength = hasPin ? pinLength : targetPinLength;

  const handleDigit = useCallback(
    async (digit: string) => {
      if (isVerifying || lockoutSeconds > 0 || pin.length >= effectivePinLength) return;

      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);

      if (nextPin.length === effectivePinLength) {
        if (!hasPin) {
          // Setup flow
          if (pinSetupStep === 'create') {
            setFirstPin(nextPin);
            setPinSetupStep('confirm');
            setPin('');
            setInfoMsg('Re-enter your PIN to confirm.');
          } else {
            // Confirm flow
            if (nextPin === firstPin) {
              setIsVerifying(true);
              try {
                await setupPin(nextPin);
              } catch (err: any) {
                triggerError(err?.message || 'Failed to save PBKDF2 PIN');
                setPinSetupStep('create');
                setFirstPin('');
              } finally {
                setIsVerifying(false);
              }
            } else {
              triggerError('PINs do not match. Please choose again.');
              setPinSetupStep('create');
              setFirstPin('');
            }
          }
        } else {
          // Unlock flow
          setIsVerifying(true);
          try {
            const result = await unlockWithPin(nextPin);
            if (!result.success) {
              if (result.locked && result.remainingSeconds > 0) {
                setLockoutSeconds(result.remainingSeconds);
                triggerError(`Too many failed attempts. Cooldown active for ${result.remainingSeconds}s.`);
              } else {
                const attemptsRemaining = 5 - (result.failedAttempts % 5);
                if (result.failedAttempts >= 3 && attemptsRemaining > 0) {
                  triggerError(`Incorrect PIN. ${attemptsRemaining} tries remaining before cooldown.`);
                } else {
                  triggerError('Incorrect PIN. Please try again.');
                }
              }
            }
          } catch {
            triggerError('Verification failed. Please try again.');
          } finally {
            setIsVerifying(false);
          }
        }
      }
    },
    [pin, isVerifying, lockoutSeconds, effectivePinLength, hasPin, pinSetupStep, firstPin, setupPin, unlockWithPin]
  );

  const handleDelete = useCallback(() => {
    if (isVerifying || lockoutSeconds > 0 || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  }, [isVerifying, lockoutSeconds, pin.length]);

  // Keyboard navigation for desktop users in PIN mode
  useEffect(() => {
    if (activeMethod !== 'pin') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutSeconds > 0) return;
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete, lockoutSeconds, activeMethod]);

  // ================= PATTERN HANDLING =================
  const handlePatternComplete = async (pattern: number[]) => {
    if (isVerifying || lockoutSeconds > 0) return;
    setErrorMsg(null);

    if (!hasPattern) {
      // Pattern Setup Flow
      if (patternSetupStep === 'create') {
        if (pattern.length < 4) {
          triggerError('Pattern must connect at least 4 dots.');
          return;
        }
        setFirstPattern(pattern);
        setPatternSetupStep('confirm');
        setInfoMsg('Draw the pattern again to confirm.');
      } else {
        // Confirm Step
        if (!firstPattern) {
          setPatternSetupStep('create');
          return;
        }

        const isMatch =
          pattern.length === firstPattern.length &&
          pattern.every((val, index) => val === firstPattern[index]);

        if (isMatch) {
          setIsVerifying(true);
          try {
            await setupPattern(pattern);
          } catch (err: any) {
            triggerError(err?.message || 'Failed to save pattern');
            setPatternSetupStep('create');
            setFirstPattern(null);
          } finally {
            setIsVerifying(false);
          }
        } else {
          triggerError('Patterns do not match. Try again.');
          setPatternSetupStep('create');
          setFirstPattern(null);
        }
      }
    } else {
      // Pattern Unlock Flow
      setIsVerifying(true);
      try {
        const result = await unlockWithPattern(pattern);
        if (!result.success) {
          if (result.locked && result.remainingSeconds > 0) {
            setLockoutSeconds(result.remainingSeconds);
            triggerError(`Too many failed attempts. Cooldown active for ${result.remainingSeconds}s.`);
          } else {
            const attemptsRemaining = 5 - (result.failedAttempts % 5);
            if (result.failedAttempts >= 3 && attemptsRemaining > 0) {
              triggerError(`Incorrect pattern. ${attemptsRemaining} tries remaining.`);
            } else {
              triggerError('Incorrect pattern. Please try again.');
            }
          }
        }
      } catch {
        triggerError('Pattern verification failed. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  // ================= BIOMETRIC HANDLING =================
  const handleBiometricUnlock = async () => {
    if (lockoutSeconds > 0 || isVerifying) return;
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const res = await unlockWithBiometric();
      if (!res.success) {
        if (res.error) {
          setErrorMsg(res.error);
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Biometric authentication was cancelled or failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const userIdentifier = currentUser?.displayName || currentUser?.email || 'Sanctuary Keeper';
  const isKeypadDisabled = isVerifying || lockoutSeconds > 0;
  const isSettingUp = !hasPin && !hasPattern;

  return (
    <div className="min-h-screen bg-[#080809] text-[#E8E6EB] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#B8A4D8]/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-16 right-1/3 w-64 h-64 bg-indigo-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Main Lock Box */}
      <div className="w-full max-w-sm flex flex-col items-center relative z-10 animate-in fade-in duration-300">
        {/* Lock Icon */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border transition-colors ${
            lockoutSeconds > 0
              ? 'bg-rose-950/40 border-rose-900/60 text-rose-300'
              : 'bg-[#141418] border-[#27272B] text-[#B8A4D8] shadow-sm shadow-[#B8A4D8]/10'
          }`}
        >
          {lockoutSeconds > 0 ? (
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          ) : activeMethod === 'pattern' ? (
            <Grid className="w-6 h-6" />
          ) : activeMethod === 'biometric' ? (
            <Fingerprint className="w-6 h-6" />
          ) : (
            <Lock className="w-6 h-6" />
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl font-light tracking-wide text-[#E8E6EB] text-center">
          {lockoutSeconds > 0
            ? 'Security Cooldown'
            : isSettingUp
            ? setupType === 'pin'
              ? pinSetupStep === 'create'
                ? `Create ${targetPinLength}-Digit PIN`
                : 'Confirm Secret PIN'
              : patternSetupStep === 'create'
              ? 'Draw Pattern Lock'
              : 'Confirm Pattern'
            : activeMethod === 'pattern'
            ? 'Draw Pattern Lock'
            : activeMethod === 'biometric'
            ? 'Biometric Unlock'
            : `Enter ${effectivePinLength}-Digit PIN`}
        </h1>

        {/* Subtitle / Instructions */}
        <p className="text-xs text-[#929099] font-light mt-1 text-center max-w-xs leading-relaxed">
          {lockoutSeconds > 0
            ? 'Multiple consecutive incorrect entries detected. Keypad temporarily suspended to prevent brute force.'
            : isSettingUp
            ? setupType === 'pin'
              ? pinSetupStep === 'create'
                ? `Choose a short ${targetPinLength}-digit PIN to protect your private sanctuary on this device.`
                : 'Re-enter your PIN to confirm.'
              : patternSetupStep === 'create'
              ? 'Connect at least 4 dots to form your private unlock pattern.'
              : 'Draw the pattern one more time to confirm.'
            : activeMethod === 'pattern'
            ? 'Draw your 3x3 pattern to unlock.'
            : activeMethod === 'biometric'
            ? 'Scan your registered fingerprint or face ID to unlock.'
            : `Welcome back, ${userIdentifier}. Enter your ${effectivePinLength}-digit PIN to unlock.`}
        </p>

        {/* Cooldown Timer Banner */}
        {lockoutSeconds > 0 ? (
          <div className="mt-4 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-200 text-xs">
            <Clock className="w-4 h-4 text-rose-400 shrink-0 animate-spin" />
            <span>
              Try again in <strong>{lockoutSeconds}s</strong> (survives page refresh)
            </span>
          </div>
        ) : errorMsg ? (
          <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs animate-in fade-in duration-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : infoMsg ? (
          <div className="mt-4 px-3 py-1.5 rounded-xl bg-[#141418] border border-[#27272B] text-[#B8A4D8] text-xs">
            <span>{infoMsg}</span>
          </div>
        ) : null}

        {/* ================= FIRST-TIME SETUP SWITCHER ================= */}
        {isSettingUp && (
          <div className="mt-4 flex flex-col items-center gap-3 w-full">
            {/* Setup Type Switcher: PIN vs Pattern */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[#101014] border border-[#27272B]">
              <button
                type="button"
                onClick={() => {
                  setSetupType('pin');
                  setPin('');
                  setFirstPin('');
                  setPinSetupStep('create');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-light transition-all flex items-center gap-1.5 ${
                  setupType === 'pin'
                    ? 'bg-[#B8A4D8] text-[#080809] font-medium shadow-sm'
                    : 'text-[#929099] hover:text-[#E8E6EB]'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Short PIN</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetupType('pattern');
                  setFirstPattern(null);
                  setPatternSetupStep('create');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-light transition-all flex items-center gap-1.5 ${
                  setupType === 'pattern'
                    ? 'bg-[#B8A4D8] text-[#080809] font-medium shadow-sm'
                    : 'text-[#929099] hover:text-[#E8E6EB]'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Pattern Lock</span>
              </button>
            </div>

            {/* Length toggle for PIN setup (3-digit vs 4-digit) */}
            {setupType === 'pin' && pinSetupStep === 'create' && (
              <div className="flex items-center gap-2 text-xs text-[#929099]">
                <span>Length:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetPinLength(3);
                    setPin('');
                  }}
                  className={`px-2.5 py-0.5 rounded-lg border transition-colors ${
                    targetPinLength === 3
                      ? 'bg-[#1C1C22] border-[#B8A4D8] text-[#B8A4D8]'
                      : 'border-[#27272B] hover:border-[#383842]'
                  }`}
                >
                  3 Digits
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetPinLength(4);
                    setPin('');
                  }}
                  className={`px-2.5 py-0.5 rounded-lg border transition-colors ${
                    targetPinLength === 4
                      ? 'bg-[#1C1C22] border-[#B8A4D8] text-[#B8A4D8]'
                      : 'border-[#27272B] hover:border-[#383842]'
                  }`}
                >
                  4 Digits
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= ACTIVE METHOD CONTENT ================= */}

        {/* 1. PATTERN MODE */}
        {(activeMethod === 'pattern' || (isSettingUp && setupType === 'pattern')) && (
          <div className="my-6 flex flex-col items-center">
            <PatternLock
              size={270}
              onComplete={handlePatternComplete}
              disabled={isKeypadDisabled}
              isError={patternResetTrigger}
            />

            {/* Reset button during Pattern confirm step */}
            {isSettingUp && patternSetupStep === 'confirm' && (
              <button
                type="button"
                onClick={() => {
                  setPatternSetupStep('create');
                  setFirstPattern(null);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="mt-4 text-xs text-[#B8A4D8] hover:underline"
              >
                Start Over
              </button>
            )}
          </div>
        )}

        {/* 2. BIOMETRIC MODE */}
        {!isSettingUp && activeMethod === 'biometric' && (
          <div className="my-8 flex flex-col items-center gap-4 w-full">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={isVerifying || lockoutSeconds > 0}
              className="w-24 h-24 rounded-full bg-[#14141A] hover:bg-[#1D1D24] active:scale-95 border-2 border-[#B8A4D8]/50 hover:border-[#B8A4D8] flex flex-col items-center justify-center gap-2 text-[#B8A4D8] shadow-lg shadow-[#B8A4D8]/10 transition-all cursor-pointer group disabled:opacity-50"
            >
              <Fingerprint className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </button>
            <span className="text-xs text-[#929099] font-light">
              Tap icon to authenticate with device biometrics
            </span>

            {/* Notice for web preview */}
            <div className="mt-2 p-3 rounded-xl bg-[#0D0D10] border border-[#222228] text-[11px] text-[#716E77] text-center max-w-xs leading-relaxed">
              Note: Native device biometrics require a physical mobile device with Capacitor. Use your fallback below if running in web preview.
            </div>
          </div>
        )}

        {/* 3. PIN MODE */}
        {(activeMethod === 'pin' || (isSettingUp && setupType === 'pin')) && (
          <>
            {/* PIN Indicator Dots */}
            <div
              className={`flex items-center gap-4 my-7 transition-transform ${
                isShaking ? 'translate-x-[-8px] animate-pulse duration-75' : ''
              }`}
            >
              {Array.from({ length: effectivePinLength }).map((_, idx) => {
                const isFilled = idx < pin.length;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                      lockoutSeconds > 0
                        ? 'bg-rose-950 border border-rose-800/50'
                        : isFilled
                        ? 'bg-[#B8A4D8] border border-[#B8A4D8] scale-110 shadow-[0_0_10px_rgba(184,164,216,0.6)]'
                        : 'bg-[#151518] border border-[#2B2B32]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-[280px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  disabled={isKeypadDisabled}
                  className="w-18 h-18 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-[#121216] hover:bg-[#1C1C22] active:bg-[#25252E] border border-[#24242A] hover:border-[#383842] text-xl font-light text-[#E8E6EB] flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {digit}
                </button>
              ))}

              {/* Bottom row: Reset/Cancel on Setup, 0, Backspace */}
              <div className="w-18 h-18 sm:w-20 sm:h-20 mx-auto flex items-center justify-center">
                {isSettingUp && pinSetupStep === 'confirm' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPinSetupStep('create');
                      setFirstPin('');
                      setPin('');
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    disabled={isKeypadDisabled}
                    className="text-[11px] text-[#929099] hover:text-[#E8E6EB] transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleDigit('0')}
                disabled={isKeypadDisabled}
                className="w-18 h-18 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-[#121216] hover:bg-[#1C1C22] active:bg-[#25252E] border border-[#24242A] hover:border-[#383842] text-xl font-light text-[#E8E6EB] flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isKeypadDisabled || pin.length === 0}
                className="w-18 h-18 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-[#121216] hover:bg-[#1C1C22] active:bg-[#25252E] border border-[#24242A] hover:border-[#383842] text-[#929099] hover:text-[#E8E6EB] flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Delete digit"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {/* ================= UNLOCK METHOD FALLBACK SWITCHER ================= */}
        {!isSettingUp && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-[#929099]">
            {activeMethod !== 'pin' && hasPin && (
              <button
                type="button"
                onClick={() => {
                  setActiveMethod('pin');
                  setErrorMsg(null);
                  setPin('');
                }}
                className="px-3 py-1.5 rounded-xl bg-[#121216] hover:bg-[#1B1B22] border border-[#25252B] text-[#B8A4D8] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Unlock with PIN</span>
              </button>
            )}

            {activeMethod !== 'pattern' && hasPattern && (
              <button
                type="button"
                onClick={() => {
                  setActiveMethod('pattern');
                  setErrorMsg(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#121216] hover:bg-[#1B1B22] border border-[#25252B] text-[#B8A4D8] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Unlock with Pattern</span>
              </button>
            )}

            {activeMethod !== 'biometric' && (
              <button
                type="button"
                onClick={() => {
                  setActiveMethod('biometric');
                  setErrorMsg(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#121216] hover:bg-[#1B1B22] border border-[#25252B] text-[#929099] hover:text-[#E8E6EB] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Biometric / Fingerprint</span>
              </button>
            )}
          </div>
        )}

        {/* Footer / Account options */}
        <div className="mt-8 pt-4 border-t border-[#1C1C21] w-full text-center">
          <button
            type="button"
            onClick={async () => {
              await signOutUser();
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[#929099] hover:text-[#E8E6EB] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out / Switch account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
