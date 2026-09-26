import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  Moon,
  ArrowRight,
  Heart,
  Feather,
  Sun,
  Mail,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOOD_OPTIONS } from '../../data/initialData';
import { MoodType } from '../../types';

export const HomeDashboard: React.FC = () => {
  const {
    userProfile,
    toggleLowEnergyMode,
    setMood,
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    dreams,
    futureLetters,
    setActiveTab,
    setQuickActionModal,
  } = useApp();

  const [newTaskInput, setNewTaskInput] = useState('');

  // Format today's date dynamically
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const currentMoodObj = MOOD_OPTIONS.find((m) => m.id === userProfile.currentMood) || MOOD_OPTIONS[0];

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    addTask(newTaskInput.trim());
    setNewTaskInput('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Greeting Header */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>{formattedDate}</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Personal Sanctuary</span>
          </div>

          {/* Low Energy Mode button */}
          <button
            onClick={toggleLowEnergyMode}
            className={`min-h-[44px] px-3.5 py-1.5 rounded-full border text-xs font-light flex items-center gap-2 transition-all ${
              userProfile.lowEnergyMode
                ? 'bg-[#B8A4D8]/15 border-[#B8A4D8]/60 text-[#B8A4D8] shadow-sm'
                : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>
              {userProfile.lowEnergyMode ? 'Low Energy Mode Active' : 'Low Energy Mode'}
            </span>
          </button>
        </div>

        <div className="pt-2">
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide">
            {userProfile.subtitle || 'Welcome to your little world.'}
          </h1>
          <p className="text-sm font-light text-[#929099] mt-1.5 max-w-xl leading-relaxed">
            {userProfile.lowEnergyMode
              ? 'Today is a day for slow breaths and zero guilt. Only do what feels gentle.'
              : 'A peaceful corner for your thoughts, gentle memories, and quiet dreams.'}
          </p>
        </div>
      </section>

      {/* Low Energy Mode Supportive Message (When Enabled) */}
      {userProfile.lowEnergyMode && (
        <section className="p-5 rounded-2xl bg-[#101012] border border-[#B8A4D8]/30 space-y-2 relative overflow-hidden">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#151518] border border-[#27272B] flex items-center justify-center text-[#B8A4D8] shrink-0 mt-0.5">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-normal text-[#E8E6EB]">
                Soft reminder: You are enough just as you are
              </h3>
              <p className="text-xs font-light text-[#929099] leading-relaxed mt-1">
                Your worth is never tied to productivity or completed checklists. Take a warm sip of tea, soften your shoulders, and let today be as quiet as it needs to be.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Daily Mood Check-In */}
      <section className="p-5 rounded-2xl bg-[#151518] border border-[#27272B] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-light text-[#929099] uppercase tracking-wider">
              Daily Check-in
            </span>
            <span className="text-[#929099]">·</span>
            <span className="text-xs font-light text-[#E8E6EB]">
              How does your heart feel today?
            </span>
          </div>
          <span className="text-xs text-[#B8A4D8] font-light hidden sm:inline">
            Currently: {currentMoodObj.label}
          </span>
        </div>

        {/* Mood Options Carousel / Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {MOOD_OPTIONS.map((mood) => {
            const isSelected = userProfile.currentMood === mood.id;
            return (
              <button
                key={mood.id}
                onClick={() => setMood(mood.id)}
                className={`min-h-[48px] p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                  isSelected
                    ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB] shadow-sm'
                    : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB] hover:bg-[#101012]'
                }`}
              >
                <span
                  className={`text-base leading-none mb-1 transition-colors ${
                    isSelected ? 'text-[#B8A4D8]' : 'text-[#929099]'
                  }`}
                >
                  {mood.symbol}
                </span>
                <span className="text-[11px] font-light tracking-tight truncate max-w-full">
                  {mood.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs font-light text-[#929099] pt-1">
          {currentMoodObj.description}
        </p>
      </section>

      {/* Quick Actions Trio */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setQuickActionModal('journal')}
          className="min-h-[56px] p-4 rounded-2xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 hover:bg-[#101012] transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#101012] border border-[#27272B] flex items-center justify-center text-[#B8A4D8] group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-normal text-[#E8E6EB] block">
                Write Journal
              </span>
              <span className="text-[11px] text-[#929099] font-light">
                Quiet reflections
              </span>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[#929099] group-hover:text-[#B8A4D8] group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => setQuickActionModal('memory')}
          className="min-h-[56px] p-4 rounded-2xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 hover:bg-[#101012] transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#101012] border border-[#27272B] flex items-center justify-center text-[#B8A4D8] group-hover:scale-105 transition-transform">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-normal text-[#E8E6EB] block">
                Add Memory
              </span>
              <span className="text-[11px] text-[#929099] font-light">
                Preserve moments
              </span>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[#929099] group-hover:text-[#B8A4D8] group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          onClick={() => setQuickActionModal('task')}
          className="min-h-[56px] p-4 rounded-2xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 hover:bg-[#101012] transition-all text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#101012] border border-[#27272B] flex items-center justify-center text-[#B8A4D8] group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-normal text-[#E8E6EB] block">
                Add Intention
              </span>
              <span className="text-[11px] text-[#929099] font-light">
                Today's gentle focus
              </span>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[#929099] group-hover:text-[#B8A4D8] group-hover:translate-x-0.5 transition-all" />
        </button>
      </section>

      {/* Today's Tasks & Intentions */}
      <section className="p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-normal text-[#E8E6EB] tracking-wide">
                {userProfile.lowEnergyMode
                  ? 'Gentle Daily Anchors'
                  : 'Today’s Intentions'}
              </h2>
              {userProfile.lowEnergyMode && (
                <span className="text-[11px] text-[#B8A4D8] font-light">
                  (3 small anchors)
                </span>
              )}
            </div>
            <p className="text-xs font-light text-[#929099] mt-0.5">
              {userProfile.lowEnergyMode
                ? 'Only tiny, nourishing things. Zero expectations.'
                : 'Small rituals to honor your day with presence.'}
            </p>
          </div>

          {/* Daily Progress Indicator (Gentle, unpressured) */}
          {!userProfile.lowEnergyMode && totalCount > 0 && (
            <div className="flex items-center gap-2 text-right">
              <span className="text-xs font-light text-[#929099] tabular-nums">
                {completedCount} of {totalCount} completed
              </span>
              <div className="w-16 h-1.5 rounded-full bg-[#101012] border border-[#27272B] overflow-hidden">
                <div
                  className="h-full bg-[#B8A4D8] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Task List */}
        <div className="space-y-2 pt-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`min-h-[50px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                task.completed
                  ? 'bg-[#101012] border-[#27272B]/60 text-[#929099]'
                  : 'bg-[#151518] border-[#27272B] text-[#E8E6EB]'
              }`}
            >
              <button
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-3 text-left flex-1 min-h-[44px]"
              >
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    task.completed
                      ? 'bg-[#B8A4D8] border-[#B8A4D8] text-[#080809]'
                      : 'border-[#27272B] bg-[#101012] text-transparent hover:border-[#B8A4D8]/50'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                  <span
                    className={`text-xs font-light transition-all ${
                      task.completed ? 'line-through text-[#929099]' : 'text-[#E8E6EB]'
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="text-[10px] text-[#929099] capitalize font-light">
                    {task.category}
                  </span>
                </div>
              </button>

              <button
                onClick={() => deleteTask(task.id)}
                aria-label="Remove intention"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#929099] hover:text-rose-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {tasks.length === 0 && (
            <div className="py-8 text-center text-xs font-light text-[#929099]">
              No intentions set right now. Rest easy, or add a gentle thought below.
            </div>
          )}
        </div>

        {/* Inline Add Task Input */}
        <form onSubmit={handleAddTaskSubmit} className="pt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder={
              userProfile.lowEnergyMode
                ? 'Add another gentle anchor...'
                : 'Add a new intention for today...'
            }
            value={newTaskInput}
            onChange={(e) => setNewTaskInput(e.target.value)}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#101012] border border-[#27272B] text-xs text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50 font-light"
          />
          <button
            type="submit"
            disabled={!newTaskInput.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-[#151518] hover:bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#E8E6EB] transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#B8A4D8]" />
            <span>Add</span>
          </button>
        </form>
      </section>

      {/* Wishes and Dreams Preview */}
      <section className="p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <h2 className="text-sm font-normal text-[#E8E6EB] tracking-wide">
                Wishes & Dreams
              </h2>
            </div>
            <p className="text-xs font-light text-[#929099] mt-0.5">
              Quiet visions you are nurturing for your future.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('dreams')}
            className="min-h-[44px] flex items-center gap-1 text-xs text-[#B8A4D8] font-light hover:underline"
          >
            <span>View all dreams</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {dreams.slice(0, 2).map((dream) => (
            <div
              key={dream.id}
              onClick={() => setActiveTab('dreams')}
              className="p-4 rounded-xl bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/30 transition-all cursor-pointer space-y-2.5 group"
            >
              <div className="flex items-center justify-between text-xs text-[#929099]">
                <span className="capitalize font-light">{dream.category}</span>
                <span className="font-light">{dream.timeframe}</span>
              </div>
              <h3 className="text-xs font-normal text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors leading-snug">
                {dream.title}
              </h3>
              <p className="text-[11px] font-light text-[#929099] line-clamp-2 leading-relaxed">
                {dream.description}
              </p>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-[#929099] font-light">
                  <span>Heart connection</span>
                  <span className="tabular-nums">{dream.progressPercent}%</span>
                </div>
                <div className="w-full h-1 bg-[#151518] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B8A4D8]/70 rounded-full"
                    style={{ width: `${dream.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Letters to Future Self Preview */}
      <section className="p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <h2 className="text-sm font-normal text-[#E8E6EB] tracking-wide">
                Letters to Future Self
              </h2>
            </div>
            <p className="text-xs font-light text-[#929099] mt-0.5">
              Sealed notes waiting to be reopened on quiet horizons.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('letters')}
            className="min-h-[44px] flex items-center gap-1 text-xs text-[#B8A4D8] font-light hover:underline cursor-pointer"
          >
            <span>Open letters</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {futureLetters.slice(0, 2).map((letter) => (
            <div
              key={letter.id}
              onClick={() => setActiveTab('letters')}
              className="p-4 rounded-xl bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/30 transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between text-xs text-[#929099]">
                <span className="flex items-center gap-1 text-[#B8A4D8] font-light text-[11px]">
                  <Lock className="w-3 h-3" />
                  Sealed until {letter.openDate}
                </span>
                {letter.mood && (
                  <span className="text-[10px] capitalize text-[#929099] font-light">
                    {letter.mood}
                  </span>
                )}
              </div>
              <h3 className="text-xs font-normal text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors leading-snug">
                {letter.title}
              </h3>
              <p className="text-[11px] font-light text-[#929099] line-clamp-1 italic">
                “Entrusted to time...”
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Gentle Affirmation Footnote */}
      <footer className="pt-4 pb-12 sm:pb-4 text-center">
        <p className="text-xs font-light text-[#929099] italic tracking-wide">
          “May your quiet hours be gentle, and your sleep peaceful tonight.”
        </p>
      </footer>
    </div>
  );
};
