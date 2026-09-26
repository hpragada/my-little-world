import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Heart,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  X,
  Edit3,
  Trash2,
  Filter,
  Check,
  Compass,
  BookOpen,
  Briefcase,
  Plane,
  GraduationCap,
  Smile,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Dream, DreamCategory, DreamStatus } from '../../types';

const CATEGORIES: { id: DreamCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'Personal', label: 'Personal', icon: Smile },
  { id: 'Career', label: 'Career', icon: Briefcase },
  { id: 'Travel', label: 'Travel', icon: Plane },
  { id: 'Learning', label: 'Learning', icon: GraduationCap },
  { id: 'Experiences', label: 'Experiences', icon: Compass },
  { id: 'Other', label: 'Other', icon: Sparkles },
];

const STATUS_OPTIONS: { id: DreamStatus; label: string; color: string }[] = [
  { id: 'Dreaming', label: 'Dreaming', color: '#929099' },
  { id: 'In Progress', label: 'In Progress', color: '#B8A4D8' },
  { id: 'Completed', label: 'Completed', color: '#34d399' },
];

const COLOR_ACCENTS = [
  { name: 'Lavender', value: '#B8A4D8' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Sky', value: '#38bdf8' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Indigo', value: '#818cf8' },
];

export const DreamsView: React.FC = () => {
  const { dreams, addDream, updateDream, deleteDream, toggleDreamCompleted } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDreamId, setEditingDreamId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<DreamCategory>('Personal');
  const [formStatus, setFormStatus] = useState<DreamStatus>('Dreaming');
  const [formDescription, setFormDescription] = useState('');
  const [formTimeframe, setFormTimeframe] = useState('Within 1 Year');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formProgress, setFormProgress] = useState(25);
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formColorAccent, setFormColorAccent] = useState('#B8A4D8');

  // Delete Confirmation Modal
  const [deletingDream, setDeletingDream] = useState<Dream | null>(null);

  // Success Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open modal for new dream
  const handleOpenAdd = () => {
    setEditingDreamId(null);
    setFormTitle('');
    setFormCategory('Personal');
    setFormStatus('Dreaming');
    setFormDescription('');
    setFormTimeframe('Within 1 Year');
    setFormTargetDate('');
    setFormProgress(25);
    setFormCoverImage('');
    setFormColorAccent('#B8A4D8');
    setIsModalOpen(true);
  };

  // Open modal for editing dream
  const handleOpenEdit = (dream: Dream) => {
    setEditingDreamId(dream.id);
    setFormTitle(dream.title);
    
    // Normalize category
    let cat: DreamCategory = 'Personal';
    if (['Personal', 'Career', 'Travel', 'Learning', 'Experiences', 'Other'].includes(dream.category)) {
      cat = dream.category as DreamCategory;
    } else if (dream.category === 'travel') cat = 'Travel';
    else if (dream.category === 'peace') cat = 'Personal';
    else if (dream.category === 'creative') cat = 'Experiences';

    setFormCategory(cat);
    setFormStatus(dream.status || 'Dreaming');
    setFormDescription(dream.description || '');
    setFormTimeframe(dream.timeframe || 'Someday');
    setFormTargetDate(dream.targetDate || '');
    setFormProgress(dream.progressPercent ?? 30);
    setFormCoverImage(dream.coverImage || '');
    setFormColorAccent('#B8A4D8');
    setIsModalOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSaveDream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingDreamId) {
      updateDream(editingDreamId, {
        title: formTitle.trim(),
        category: formCategory,
        status: formStatus,
        description: formDescription.trim(),
        timeframe: formTimeframe.trim() || 'Someday',
        targetDate: formTargetDate || undefined,
        progressPercent: formStatus === 'Completed' ? 100 : Number(formProgress),
        coverImage: formCoverImage.trim() || undefined,
      });
      showToast('Aspiration updated with gentle care.');
    } else {
      addDream({
        title: formTitle.trim(),
        category: formCategory,
        status: formStatus,
        description: formDescription.trim() || 'A cherished aspiration waiting in patience.',
        timeframe: formTimeframe.trim() || 'Someday',
        targetDate: formTargetDate || undefined,
        progressPercent: formStatus === 'Completed' ? 100 : Number(formProgress),
        coverImage: formCoverImage.trim() || undefined,
        pinnedToHome: true,
      });
      showToast('New dream planted in your sanctuary.');
    }

    setIsModalOpen(false);
  };

  // Handle Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingDream) return;
    deleteDream(deletingDream.id);
    setDeletingDream(null);
    showToast('Aspiration gently released.');
  };

  // Progress calculations
  const totalDreams = dreams.length;
  const completedDreams = dreams.filter((d) => d.status === 'Completed').length;
  const inProgressDreams = dreams.filter((d) => d.status === 'In Progress').length;
  const dreamingCount = dreams.filter((d) => !d.status || d.status === 'Dreaming').length;
  const completionPercentage = totalDreams > 0 ? Math.round((completedDreams / totalDreams) * 100) : 0;

  // Filtered Dreams list
  const filteredDreams = useMemo(() => {
    return dreams.filter((dream) => {
      // Category check
      if (selectedCategory !== 'All') {
        const dCat = dream.category.toLowerCase();
        const sCat = selectedCategory.toLowerCase();
        if (dCat !== sCat) {
          if (sCat === 'personal' && !['personal', 'peace'].includes(dCat)) return false;
          if (sCat === 'experiences' && !['experiences', 'creative'].includes(dCat)) return false;
          if (sCat !== 'personal' && sCat !== 'experiences') return false;
        }
      }

      // Status check
      if (selectedStatus !== 'All') {
        const currentStatus = dream.status || 'Dreaming';
        if (currentStatus !== selectedStatus) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = dream.title.toLowerCase().includes(q);
        const matchesDesc = dream.description?.toLowerCase().includes(q);
        const matchesCat = dream.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }

      return true;
    });
  }, [dreams, selectedCategory, selectedStatus, searchQuery]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272B]">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Aspirations</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Vision Sanctuary</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            Wishes & Quiet Dreams
          </h1>
          <p className="text-xs sm:text-sm font-light text-[#929099] mt-1 max-w-xl">
            Gentle desires for your life, creative journeys, meaningful milestones, and future destinations.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Plant a Dream</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-200 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Progress & Sanctuary Summary Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#151518] border border-[#27272B] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-widest text-[#B8A4D8] font-light">
              Sanctuary Progress
            </span>
            <h2 className="text-base font-normal text-[#E8E6EB] mt-0.5">
              {completedDreams} of {totalDreams} Dreams Fulfilled
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#929099] font-light">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {completedDreams} Completed
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#B8A4D8]" />
              {inProgressDreams} In Progress
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#929099]" />
              {dreamingCount} Dreaming
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2 bg-[#101012] rounded-full overflow-hidden border border-[#27272B]">
            <div
              className="h-full bg-gradient-to-r from-[#B8A4D8] to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#929099] font-light">
            <span>Overall Alignment</span>
            <span className="tabular-nums text-[#E8E6EB]">{completionPercentage}% Completed</span>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="flex-1 flex items-center gap-3 bg-[#151518] border border-[#27272B] rounded-xl px-3.5 py-2.5 focus-within:border-[#B8A4D8]/50 transition-colors">
            <Filter className="w-3.5 h-3.5 text-[#929099]" />
            <input
              type="text"
              placeholder="Search dreams by title, aspirations, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none font-light"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#929099] hover:text-[#E8E6EB]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center bg-[#101012] p-1 rounded-xl border border-[#27272B] shrink-0 text-xs overflow-x-auto">
            <button
              onClick={() => setSelectedStatus('All')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-light ${
                selectedStatus === 'All'
                  ? 'bg-[#151518] text-[#E8E6EB] border border-[#27272B]'
                  : 'text-[#929099] hover:text-[#E8E6EB]'
              }`}
            >
              All Statuses
            </button>
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors font-light whitespace-nowrap ${
                  selectedStatus === st.id
                    ? 'bg-[#151518] text-[#B8A4D8] border border-[#27272B]'
                    : 'text-[#929099] hover:text-[#E8E6EB]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-light whitespace-nowrap transition-colors min-h-[36px] cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-light whitespace-nowrap transition-colors min-h-[36px] cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                    : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dreams Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredDreams.map((dream) => {
          const isCompleted = dream.status === 'Completed';
          const isInProgress = dream.status === 'In Progress';
          const progress = dream.progressPercent ?? (isCompleted ? 100 : 25);

          return (
            <div
              key={dream.id}
              className={`p-5 rounded-2xl bg-[#151518] border transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden ${
                isCompleted
                  ? 'border-emerald-500/30 bg-[#121815]'
                  : 'border-[#27272B] hover:border-[#B8A4D8]/40'
              }`}
            >
              {/* Optional Cover Image Banner */}
              {dream.coverImage && (
                <div className="h-32 -mx-5 -mt-5 mb-1 relative overflow-hidden bg-[#101012]">
                  <img
                    src={dream.coverImage}
                    alt={dream.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151518] via-transparent to-black/20" />
                </div>
              )}

              {/* Top Meta & Actions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#929099]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-[#101012] border border-[#27272B] text-[11px] font-light capitalize text-[#E8E6EB]">
                      {dream.category}
                    </span>
                    <span className="text-[11px] text-[#929099] font-light flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#929099]" />
                      {dream.timeframe}
                    </span>
                    {dream.targetDate && (
                      <span className="text-[11px] text-[#B8A4D8] font-light flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#B8A4D8]" />
                        {dream.targetDate}
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit, Delete */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(dream)}
                      className="p-1.5 rounded-lg hover:text-[#E8E6EB] hover:bg-[#101012] transition-colors"
                      title="Edit dream"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingDream(dream)}
                      className="p-1.5 rounded-lg hover:text-rose-400 hover:bg-[#101012] transition-colors"
                      title="Delete dream"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Dream Title & Status Toggle */}
                <div className="flex items-start gap-2.5 pt-1">
                  <button
                    onClick={() => toggleDreamCompleted(dream.id)}
                    className="mt-0.5 shrink-0 text-[#929099] hover:text-emerald-400 transition-colors"
                    title={isCompleted ? 'Mark as In Progress' : 'Mark as Fulfilled'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#929099] hover:text-[#B8A4D8]" />
                    )}
                  </button>
                  <h3
                    className={`text-sm sm:text-base font-normal leading-snug transition-colors ${
                      isCompleted ? 'text-emerald-300/90 line-through' : 'text-[#E8E6EB]'
                    }`}
                  >
                    {dream.title}
                  </h3>
                </div>

                {/* Description */}
                {dream.description && (
                  <p className="text-xs font-light text-[#929099] leading-relaxed pl-6">
                    {dream.description}
                  </p>
                )}
              </div>

              {/* Bottom Progress Bar */}
              <div className="space-y-1.5 pt-2 border-t border-[#27272B]/60">
                <div className="flex items-center justify-between text-[11px] text-[#929099] font-light">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-400'
                          : isInProgress
                          ? 'bg-[#B8A4D8]'
                          : 'bg-[#929099]'
                      }`}
                    />
                    <span className="capitalize">{dream.status || 'Dreaming'}</span>
                  </span>
                  <span className="tabular-nums text-[#E8E6EB]">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#101012] rounded-full overflow-hidden border border-[#27272B]/50">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCompleted ? 'bg-emerald-400' : 'bg-[#B8A4D8]'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDreams.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-[#101012] border border-dashed border-[#27272B] p-6 space-y-3">
          <Sparkles className="w-7 h-7 text-[#929099] mx-auto opacity-40" />
          <p className="text-xs font-light text-[#E8E6EB]">
            {searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All'
              ? 'No matching aspirations found for these filters.'
              : 'No dreams recorded yet. Every grand journey begins with a quiet wish.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 text-xs font-light text-[#E8E6EB] cursor-pointer"
          >
            Plant First Dream
          </button>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Create / Edit Dream Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg bg-[#151518] border border-[#27272B] rounded-3xl p-5 sm:p-7 max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#B8A4D8]" />
                <h3 className="text-sm font-normal text-[#E8E6EB]">
                  {editingDreamId ? 'Refine Dream' : 'Plant a New Dream'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#929099] hover:text-[#E8E6EB] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDream} className="space-y-4">
              {/* Dream Title */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Aspiration Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Spend a quiet winter month in Kyoto"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              {/* Category and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as DreamCategory)}
                    className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Current Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as DreamStatus)}
                    className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Timeframe and Optional Target Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Timeframe
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Next Year, 2027, In 2 Months"
                    value={formTimeframe}
                    onChange={(e) => setFormTimeframe(e.target.value)}
                    className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Target Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formTargetDate}
                    onChange={(e) => setFormTargetDate(e.target.value)}
                    className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>
              </div>

              {/* Description & Feelings */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Description & Meaning
                </label>
                <textarea
                  rows={3}
                  placeholder="What makes this wish precious to you? How will you feel when it unfolds?"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2.5 text-xs text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8] font-light resize-none leading-relaxed"
                />
              </div>

              {/* Progress Slider */}
              {formStatus !== 'Completed' && (
                <div>
                  <div className="flex justify-between text-xs text-[#929099] mb-1 font-light">
                    <span>Heart Alignment / Preparedness</span>
                    <span className="tabular-nums text-[#E8E6EB]">{formProgress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formProgress}
                    onChange={(e) => setFormProgress(Number(e.target.value))}
                    className="w-full accent-[#B8A4D8]"
                  />
                </div>
              )}

              {/* Optional Cover Image URL */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Optional Cover Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formCoverImage}
                  onChange={(e) => setFormCoverImage(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2 text-xs text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#27272B] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#101012] border border-[#27272B] text-xs font-light text-[#929099] hover:text-[#E8E6EB] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formTitle.trim()}
                  className="min-h-[44px] px-5 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40"
                >
                  {editingDreamId ? 'Save Changes' : 'Plant Dream'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setDeletingDream(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#151518] border border-[#27272B] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-normal text-[#E8E6EB]">
                Release This Dream?
              </h3>
            </div>
            <p className="text-xs font-light text-[#929099] leading-relaxed">
              Are you sure you want to remove &ldquo;{deletingDream.title}&rdquo; from your vision sanctuary?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingDream(null)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#101012] border border-[#27272B] text-xs font-light text-[#929099] hover:text-[#E8E6EB]"
              >
                Keep Dream
              </button>
              <button
                onClick={handleConfirmDelete}
                className="min-h-[40px] px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-medium transition-colors"
              >
                Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
