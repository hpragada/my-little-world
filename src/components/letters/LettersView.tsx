import React, { useState, useMemo } from 'react';
import {
  Mail,
  Plus,
  Lock,
  Unlock,
  Calendar,
  Clock,
  Trash2,
  X,
  Heart,
  Check,
  AlertCircle,
  Eye,
  Feather,
  Sparkles,
  Send,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FutureLetter, MoodType } from '../../types';
import { MOOD_OPTIONS } from '../../data/initialData';

export const LettersView: React.FC = () => {
  const { futureLetters, addFutureLetter, updateFutureLetter, deleteFutureLetter } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'sealed' | 'ready'>('all');

  // Reader Modal State
  const [readingLetter, setReadingLetter] = useState<FutureLetter | null>(null);

  // Early unlock confirmation state (if user wants to open before date)
  const [earlyUnlockTarget, setEarlyUnlockTarget] = useState<FutureLetter | null>(null);

  // Composer Modal State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [letterTitle, setLetterTitle] = useState('');
  const [letterContent, setLetterContent] = useState('');
  const [letterMood, setLetterMood] = useState<MoodType>('hopeful');
  const [unlockPreset, setUnlockPreset] = useState<'1m' | '6m' | '1y' | '3y' | 'custom'>('6m');
  const [customUnlockDate, setCustomUnlockDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });

  // Delete Confirmation Modal
  const [deletingLetter, setDeletingLetter] = useState<FutureLetter | null>(null);

  // Success Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Calculate preset dates
  const handleSelectPreset = (preset: '1m' | '6m' | '1y' | '3y' | 'custom') => {
    setUnlockPreset(preset);
    const d = new Date();
    if (preset === '1m') {
      d.setMonth(d.getMonth() + 1);
      setCustomUnlockDate(d.toISOString().split('T')[0]);
    } else if (preset === '6m') {
      d.setMonth(d.getMonth() + 6);
      setCustomUnlockDate(d.toISOString().split('T')[0]);
    } else if (preset === '1y') {
      d.setFullYear(d.getFullYear() + 1);
      setCustomUnlockDate(d.toISOString().split('T')[0]);
    } else if (preset === '3y') {
      d.setFullYear(d.getFullYear() + 3);
      setCustomUnlockDate(d.toISOString().split('T')[0]);
    }
  };

  // Open Composer
  const handleOpenComposer = () => {
    setLetterTitle('');
    setLetterContent('');
    setLetterMood('hopeful');
    handleSelectPreset('6m');
    setIsComposerOpen(true);
  };

  // Save new letter
  const handleSealLetter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!letterTitle.trim() || !letterContent.trim() || !customUnlockDate) return;

    addFutureLetter({
      title: letterTitle.trim(),
      content: letterContent.trim(),
      openDate: customUnlockDate,
      mood: letterMood,
      isSealed: true,
    });

    setIsComposerOpen(false);
    showToast('Your letter has been sealed with care and entrusted to time.');
  };

  // Check if a letter is ready to open based on date
  const isReadyToOpen = (letter: FutureLetter) => {
    return letter.openDate <= todayStr;
  };

  // Calculate days remaining
  const getDaysRemaining = (openDateStr: string) => {
    const target = new Date(openDateStr).getTime();
    const today = new Date(todayStr).getTime();
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  // Open letter to read
  const handleReadLetter = (letter: FutureLetter) => {
    const ready = isReadyToOpen(letter);
    if (ready || !letter.isSealed) {
      if (letter.isSealed) {
        // Mark as unsealed on first open
        updateFutureLetter(letter.id, { isSealed: false });
      }
      setReadingLetter({ ...letter, isSealed: false });
    } else {
      // Locked: show early unlock confirmation
      setEarlyUnlockTarget(letter);
    }
  };

  // Confirm early unseal
  const handleConfirmEarlyUnlock = () => {
    if (!earlyUnlockTarget) return;
    updateFutureLetter(earlyUnlockTarget.id, { isSealed: false });
    setReadingLetter({ ...earlyUnlockTarget, isSealed: false });
    setEarlyUnlockTarget(null);
  };

  // Toggle seal status
  const handleToggleReseal = (letter: FutureLetter) => {
    const nextState = !letter.isSealed;
    updateFutureLetter(letter.id, { isSealed: nextState });
    if (readingLetter && readingLetter.id === letter.id) {
      setReadingLetter({ ...readingLetter, isSealed: nextState });
    }
    showToast(nextState ? 'Letter resealed.' : 'Letter marked as unsealed.');
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (!deletingLetter) return;
    deleteFutureLetter(deletingLetter.id);
    if (readingLetter?.id === deletingLetter.id) {
      setReadingLetter(null);
    }
    setDeletingLetter(null);
    showToast('Letter released from time.');
  };

  // Filter letters
  const filteredLetters = useMemo(() => {
    return futureLetters
      .filter((l) => {
        if (activeFilter === 'sealed') return l.isSealed && !isReadyToOpen(l);
        if (activeFilter === 'ready') return isReadyToOpen(l) || !l.isSealed;
        return true;
      })
      .sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());
  }, [futureLetters, activeFilter, todayStr]);

  // Statistics
  const totalLetters = futureLetters.length;
  const readyCount = futureLetters.filter((l) => isReadyToOpen(l) || !l.isSealed).length;
  const sealedFutureCount = futureLetters.filter((l) => l.isSealed && !isReadyToOpen(l)).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272B]">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Epistles</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Timeless Sanctuary</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            Letters to My Future Self
          </h1>
          <p className="text-xs sm:text-sm font-light text-[#929099] mt-1 max-w-xl">
            Words sealed across time. Write to yourself today, to be rediscovered on a quiet tomorrow.
          </p>
        </div>

        <button
          onClick={handleOpenComposer}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Feather className="w-3.5 h-3.5" />
          <span>Write a Letter</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-200 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Atmospheric Quote & Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#151518] border border-[#27272B] space-y-1 sm:col-span-2 flex flex-col justify-center">
          <span className="text-[11px] uppercase tracking-widest text-[#B8A4D8] font-light">
            A Message to the Horizon
          </span>
          <p className="text-xs sm:text-sm font-light text-[#E8E6EB]/90 italic leading-relaxed">
            “The person you will become is already grateful for the gentle patience you are practicing today.”
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#101012] border border-[#27272B] flex flex-col justify-center gap-2">
          <div className="flex items-center justify-between text-xs text-[#929099]">
            <span>Sealed in Time</span>
            <span className="text-[#B8A4D8] font-normal">{sealedFutureCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#929099]">
            <span>Ready / Unsealed</span>
            <span className="text-emerald-400 font-normal">{readyCount}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#929099]/80 pt-1 border-t border-[#27272B]">
            <span>Total Letters</span>
            <span className="text-[#E8E6EB]">{totalLetters}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-light transition-colors min-h-[36px] ${
            activeFilter === 'all'
              ? 'bg-[#151518] border-[#B8A4D8] text-[#E8E6EB]'
              : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
          }`}
        >
          All Letters ({totalLetters})
        </button>
        <button
          onClick={() => setActiveFilter('sealed')}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-light transition-colors min-h-[36px] flex items-center gap-1.5 ${
            activeFilter === 'sealed'
              ? 'bg-[#151518] border-[#B8A4D8] text-[#B8A4D8]'
              : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
          }`}
        >
          <Lock className="w-3 h-3" />
          <span>Sealed & Waiting ({sealedFutureCount})</span>
        </button>
        <button
          onClick={() => setActiveFilter('ready')}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-light transition-colors min-h-[36px] flex items-center gap-1.5 ${
            activeFilter === 'ready'
              ? 'bg-[#151518] border-emerald-500/50 text-emerald-300'
              : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
          }`}
        >
          <Unlock className="w-3 h-3" />
          <span>Ready to Open ({readyCount})</span>
        </button>
      </div>

      {/* Letters List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredLetters.map((letter) => {
          const ready = isReadyToOpen(letter);
          const daysLeft = getDaysRemaining(letter.openDate);
          const moodObj = letter.mood ? MOOD_OPTIONS.find((m) => m.id === letter.mood) : null;
          const isSealed = letter.isSealed ?? true;

          return (
            <div
              key={letter.id}
              onClick={() => handleReadLetter(letter)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden ${
                isSealed && !ready
                  ? 'bg-[#131316] border-[#27272B] hover:border-[#B8A4D8]/40'
                  : 'bg-[#151518] border-emerald-800/40 hover:border-emerald-500/50'
              }`}
            >
              {/* Wax Seal Ribbon Background Motif */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${
                      isSealed && !ready
                        ? 'bg-[#1a1720] border-[#B8A4D8]/40 text-[#B8A4D8]'
                        : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {isSealed && !ready ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] block font-light text-[#929099]">
                      {isSealed && !ready ? 'Sealed Wax Epistle' : 'Unsealed Letter'}
                    </span>
                    <span className="text-xs font-light text-[#E8E6EB]">
                      Open: {letter.openDate}
                    </span>
                  </div>
                </div>

                {/* Mood Tag Badge */}
                {moodObj && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#101012] border border-[#27272B] text-[#929099] flex items-center gap-1">
                    <span>{moodObj.symbol}</span>
                    <span>{moodObj.label}</span>
                  </span>
                )}
              </div>

              {/* Title & Mystery Preview */}
              <div className="space-y-1.5">
                <h3 className="text-sm sm:text-base font-normal text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors leading-snug">
                  {letter.title}
                </h3>

                {isSealed && !ready ? (
                  <p className="text-xs font-light text-[#929099]/80 italic line-clamp-2">
                    “The words inside rest quietly beneath the seal, waiting for {letter.openDate}.”
                  </p>
                ) : (
                  <p className="text-xs font-light text-[#929099] line-clamp-2">
                    {letter.content}
                  </p>
                )}
              </div>

              {/* Footer Meta & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#27272B]/60 text-xs">
                <div className="flex items-center gap-1.5 text-[11px] font-light">
                  {isSealed && !ready ? (
                    <span className="text-[#B8A4D8] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {daysLeft === 0 ? 'Unlocks today' : `Unlocks in ${daysLeft} days`}
                    </span>
                  ) : (
                    <span className="text-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Ready to read
                    </span>
                  )}
                </div>

                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[#929099]"
                >
                  <button
                    onClick={() => setDeletingLetter(letter)}
                    className="p-1.5 rounded-lg hover:text-rose-400 hover:bg-[#101012] transition-colors"
                    title="Delete letter"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredLetters.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-[#101012] border border-dashed border-[#27272B] p-6 space-y-3">
          <Mail className="w-7 h-7 text-[#929099] mx-auto opacity-40" />
          <p className="text-xs font-light text-[#E8E6EB]">
            {activeFilter === 'all'
              ? 'No future letters written yet. Your future self is waiting to hear from you.'
              : 'No letters match this filter.'}
          </p>
          <button
            onClick={handleOpenComposer}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 text-xs font-light text-[#E8E6EB] cursor-pointer"
          >
            Write First Letter
          </button>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Composer Modal */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsComposerOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-[#151518] border border-[#27272B] rounded-3xl p-5 sm:p-7 max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <div className="flex items-center gap-2">
                <Feather className="w-4 h-4 text-[#B8A4D8]" />
                <h3 className="text-sm font-normal text-[#E8E6EB]">
                  Compose Letter to Future Self
                </h3>
              </div>
              <button
                onClick={() => setIsComposerOpen(false)}
                className="text-[#929099] hover:text-[#E8E6EB] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSealLetter} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Letter Title / Salutation
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Dear me, on the morning you turn twenty-seven..."
                  value={letterTitle}
                  onChange={(e) => setLetterTitle(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              {/* Mood at time of writing */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1.5">
                  How are you feeling right now as you write this?
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLetterMood(m.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-light whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                        letterMood === m.id
                          ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                          : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                      }`}
                    >
                      <span>{m.symbol}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Future Open Date Preset */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1.5">
                  When should this letter unseal?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('1m')}
                    className={`py-2 px-3 rounded-xl border text-xs font-light transition-colors ${
                      unlockPreset === '1m'
                        ? 'bg-[#101012] border-[#B8A4D8] text-[#B8A4D8]'
                        : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                    }`}
                  >
                    +1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('6m')}
                    className={`py-2 px-3 rounded-xl border text-xs font-light transition-colors ${
                      unlockPreset === '6m'
                        ? 'bg-[#101012] border-[#B8A4D8] text-[#B8A4D8]'
                        : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                    }`}
                  >
                    +6 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('1y')}
                    className={`py-2 px-3 rounded-xl border text-xs font-light transition-colors ${
                      unlockPreset === '1y'
                        ? 'bg-[#101012] border-[#B8A4D8] text-[#B8A4D8]'
                        : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                    }`}
                  >
                    +1 Year
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('3y')}
                    className={`py-2 px-3 rounded-xl border text-xs font-light transition-colors ${
                      unlockPreset === '3y'
                        ? 'bg-[#101012] border-[#B8A4D8] text-[#B8A4D8]'
                        : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                    }`}
                  >
                    +3 Years
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#929099] font-light">Or pick specific date:</span>
                  <input
                    type="date"
                    min={todayStr}
                    value={customUnlockDate}
                    onChange={(e) => {
                      setCustomUnlockDate(e.target.value);
                      setUnlockPreset('custom');
                    }}
                    className="bg-[#101012] border border-[#27272B] rounded-xl px-3 py-1.5 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>
              </div>

              {/* Letter Content */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Your Letter
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder="Pour out your honest thoughts, hopes, fears, quiet joys, and whatever you want your future self to remember about this exact season of life..."
                  value={letterContent}
                  onChange={(e) => setLetterContent(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-2xl p-4 text-xs sm:text-sm text-[#E8E6EB] placeholder-[#929099]/50 focus:outline-none focus:border-[#B8A4D8] font-light resize-none leading-relaxed"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-[#27272B] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#101012] border border-[#27272B] text-xs font-light text-[#929099] hover:text-[#E8E6EB]"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={!letterTitle.trim() || !letterContent.trim() || !customUnlockDate}
                  className="min-h-[44px] px-5 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Seal in Time</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reader Modal (Physical Stationery Aesthetic) */}
      {readingLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setReadingLetter(null)} />
          <div className="relative z-10 w-full max-w-2xl bg-[#101012] border border-[#27272B] rounded-3xl p-6 sm:p-9 max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl">
            {/* Stationery Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#27272B]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#929099] font-light">
                  <span className="text-[#B8A4D8]">Letter from the Past</span>
                  <span>·</span>
                  <span>Written on {new Date(readingLetter.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-light text-[#E8E6EB] tracking-wide">
                  {readingLetter.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-[#929099] pt-1">
                  <span>Intended unlock: {readingLetter.openDate}</span>
                  {readingLetter.mood && (
                    <>
                      <span>·</span>
                      <span className="text-[#B8A4D8] capitalize">
                        Written feeling {readingLetter.mood}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => setReadingLetter(null)}
                className="text-[#929099] hover:text-[#E8E6EB] p-1.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Letter Body (Soft Stationery Parchment Feel) */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
              <p className="text-xs sm:text-sm font-light text-[#E8E6EB] leading-relaxed whitespace-pre-wrap font-serif">
                {readingLetter.content}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleToggleReseal(readingLetter)}
                className="text-xs font-light text-[#929099] hover:text-[#E8E6EB] flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{readingLetter.isSealed ? 'Mark Unsealed' : 'Reseal Letter'}</span>
              </button>

              <button
                onClick={() => setReadingLetter(null)}
                className="min-h-[40px] px-5 rounded-xl bg-[#151518] border border-[#27272B] text-xs font-light text-[#E8E6EB] hover:border-[#B8A4D8]/50"
              >
                Close Letter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Early Unlock Confirmation Modal */}
      {earlyUnlockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setEarlyUnlockTarget(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#151518] border border-[#27272B] rounded-2xl p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-[#1e1a24] border border-[#B8A4D8]/40 flex items-center justify-center text-[#B8A4D8] mx-auto">
              <Lock className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-normal text-[#E8E6EB]">
                This Letter is Still Sealed
              </h3>
              <p className="text-xs font-light text-[#929099] leading-relaxed">
                You promised your future self not to open &ldquo;{earlyUnlockTarget.title}&rdquo; until{' '}
                <span className="text-[#B8A4D8]">{earlyUnlockTarget.openDate}</span> (
                {getDaysRemaining(earlyUnlockTarget.openDate)} days away).
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setEarlyUnlockTarget(null)}
                className="min-h-[42px] px-4 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4]"
              >
                Keep it Sealed
              </button>
              <button
                onClick={handleConfirmEarlyUnlock}
                className="min-h-[38px] px-4 rounded-xl text-xs font-light text-[#929099] hover:text-rose-300"
              >
                Peek Early Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setDeletingLetter(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#151518] border border-[#27272B] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-normal text-[#E8E6EB]">
                Discard This Letter?
              </h3>
            </div>
            <p className="text-xs font-light text-[#929099] leading-relaxed">
              Are you sure you want to permanently discard &ldquo;{deletingLetter.title}&rdquo;?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingLetter(null)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#101012] border border-[#27272B] text-xs font-light text-[#929099] hover:text-[#E8E6EB]"
              >
                Keep Letter
              </button>
              <button
                onClick={handleConfirmDelete}
                className="min-h-[40px] px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-medium transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
