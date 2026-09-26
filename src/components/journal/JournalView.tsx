import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Clock,
  Trash2,
  X,
  Feather,
  Pin,
  Edit3,
  Check,
  Tag,
  Smile,
  AlertCircle,
  Eye,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { JournalEntry, MoodType } from '../../types';
import { MOOD_OPTIONS } from '../../data/initialData';

const PREDEFINED_TAGS = [
  'Personal',
  'Career',
  'Gratitude',
  'Difficult Day',
  'Happiness',
  'Custom',
];

export const JournalView: React.FC = () => {
  const {
    journalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    togglePinJournalEntry,
    userProfile,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedMood, setSelectedMood] = useState<string>('All');
  const [viewFilter, setViewFilter] = useState<'all' | 'pinned'>('all');

  // Reader Modal State
  const [readingEntry, setReadingEntry] = useState<JournalEntry | null>(null);

  // Editor Modal State (Create or Edit)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formTime, setFormTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [formMood, setFormMood] = useState<MoodType>('serene');
  const [formTags, setFormTags] = useState<string[]>(['Personal']);
  const [customTagInput, setCustomTagInput] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingEntry, setDeletingEntry] = useState<JournalEntry | null>(null);

  // Open editor for creating new entry
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setFormMood('serene');
    setFormTags(['Personal']);
    setCustomTagInput('');
    setFormPinned(false);
    setIsEditorOpen(true);
  };

  // Open editor for modifying existing entry
  const handleOpenEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setFormTitle(entry.title);
    setFormContent(entry.content);

    // Parse date if possible
    let isoDate = new Date().toISOString().split('T')[0];
    try {
      const parsed = new Date(entry.date);
      if (!isNaN(parsed.getTime())) {
        isoDate = parsed.toISOString().split('T')[0];
      }
    } catch {
      // keep fallback
    }

    setFormDate(isoDate);
    setFormTime(entry.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setFormMood(entry.mood || 'serene');
    setFormTags(entry.tags || ['Personal']);
    setCustomTagInput('');
    setFormPinned(!!entry.isPinned);
    setReadingEntry(null);
    setIsEditorOpen(true);
  };

  // Toggle tag selection in editor
  const handleToggleTag = (tag: string) => {
    setFormTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Add custom tag
  const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    const clean = customTagInput.trim().replace(/^#/, '');
    if (clean && !formTags.includes(clean)) {
      setFormTags((prev) => [...prev, clean]);
      setCustomTagInput('');
    }
  };

  // Save entry (create or update)
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    // Calculate approximate read time
    const wordCount = formContent.trim().split(/\s+/).length;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));

    // Format human-readable date
    let displayDate = formDate;
    try {
      const [year, month, day] = formDate.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      displayDate = d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      displayDate = formDate;
    }

    if (editingId) {
      updateJournalEntry(editingId, {
        title: formTitle.trim(),
        content: formContent.trim(),
        date: displayDate,
        time: formTime,
        mood: formMood,
        tags: formTags.length > 0 ? formTags : ['Personal'],
        readTimeMinutes,
        isPinned: formPinned,
      });
      setSaveSuccessMsg('Reflection updated gently.');
    } else {
      addJournalEntry({
        title: formTitle.trim(),
        content: formContent.trim(),
        date: displayDate,
        time: formTime,
        mood: formMood,
        tags: formTags.length > 0 ? formTags : ['Personal'],
        readTimeMinutes,
        isPinned: formPinned,
      });
      setSaveSuccessMsg('Reflection saved to your sanctuary.');
    }

    setIsEditorOpen(false);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Delete entry confirmed
  const handleConfirmDelete = () => {
    if (!deletingEntry) return;
    deleteJournalEntry(deletingEntry.id);
    if (readingEntry?.id === deletingEntry.id) {
      setReadingEntry(null);
    }
    setDeletingEntry(null);
  };

  // Collect all available tags across all entries
  const allTags = useMemo(() => {
    const set = new Set<string>(['All', ...PREDEFINED_TAGS]);
    journalEntries.forEach((entry) => {
      entry.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [journalEntries]);

  // Filter and sort entries: Pinned entries first, then chronological/recent
  const filteredAndSortedEntries = useMemo(() => {
    return journalEntries
      .filter((entry) => {
        if (viewFilter === 'pinned' && !entry.isPinned) return false;

        const matchesSearch =
          entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesTag = selectedTag === 'All' || entry.tags?.includes(selectedTag);
        const matchesMood = selectedMood === 'All' || entry.mood === selectedMood;

        return matchesSearch && matchesTag && matchesMood;
      })
      .sort((a, b) => {
        // Pinned always bubble to top if in general view
        if (viewFilter === 'all') {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
        }

        // Chronological descending by createdAt or date
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
  }, [journalEntries, searchQuery, selectedTag, viewFilter]);

  // Group entries by Date string for chronological date sections
  const groupedEntries = useMemo(() => {
    const groups: { date: string; entries: JournalEntry[] }[] = [];
    filteredAndSortedEntries.forEach((entry) => {
      const existing = groups.find((g) => g.date === entry.date);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.push({ date: entry.date, entries: [entry] });
      }
    });
    return groups;
  }, [filteredAndSortedEntries]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-7 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272B]">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Reflections</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Personal Sanctuary</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            Private Journal
          </h1>
          <p className="text-xs sm:text-sm font-light text-[#929099] mt-1 max-w-xl">
            Unhurried thoughts, quiet days, and honest inner truths captured in words.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium flex items-center justify-center gap-2 shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Save Success Toast */}
      {saveSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-200 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="px-4 py-2.5 rounded-xl bg-[#101012] border border-[#27272B] flex items-center justify-between text-xs text-[#929099] font-light">
        <div className="flex items-center gap-2">
          {userProfile.journalAwareAI ? (
            <Eye className="w-3.5 h-3.5 text-[#B8A4D8]" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-[#B8A4D8]" />
          )}
          <span>
            {userProfile.journalAwareAI
              ? 'Journal-Aware Mode active: Aria may gently reflect on recent thoughts.'
              : 'Strict privacy: Your entries remain strictly local and private.'}
          </span>
        </div>
        <span className="text-[11px] text-[#929099]/80 hidden sm:inline">
          {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'} stored
        </span>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="flex-1 flex items-center gap-3 bg-[#151518] border border-[#27272B] rounded-xl px-3.5 py-2.5 focus-within:border-[#B8A4D8]/50 transition-colors">
            <Search className="w-4 h-4 text-[#929099]" />
            <input
              type="text"
              placeholder="Search entries by title, feelings, or content..."
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

          {/* All vs Pinned Toggle */}
          <div className="flex items-center bg-[#101012] p-1 rounded-xl border border-[#27272B] shrink-0 text-xs">
            <button
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-light ${
                viewFilter === 'all'
                  ? 'bg-[#151518] text-[#E8E6EB] border border-[#27272B]'
                  : 'text-[#929099] hover:text-[#E8E6EB]'
              }`}
            >
              All Entries
            </button>
            <button
              onClick={() => setViewFilter('pinned')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-light flex items-center gap-1.5 ${
                viewFilter === 'pinned'
                  ? 'bg-[#151518] text-[#B8A4D8] border border-[#27272B]'
                  : 'text-[#929099] hover:text-[#E8E6EB]'
              }`}
            >
              <Pin className="w-3 h-3 text-[#B8A4D8]" />
              <span>Pinned</span>
            </button>
          </div>
        </div>

        {/* Tag Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-light whitespace-nowrap transition-colors min-h-[36px] cursor-pointer ${
                selectedTag === tag
                  ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                  : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
              }`}
            >
              {tag === 'All' ? 'All Tags' : `#${tag}`}
            </button>
          ))}
        </div>

        {/* Mood Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-[#929099]/80 shrink-0 font-light mr-1">Mood:</span>
          <button
            onClick={() => setSelectedMood('All')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-light whitespace-nowrap transition-colors min-h-[32px] cursor-pointer ${
              selectedMood === 'All'
                ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
            }`}
          >
            All Moods
          </button>
          {MOOD_OPTIONS.map((mood) => (
            <button
              key={mood.id}
              onClick={() => setSelectedMood(mood.id)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-light whitespace-nowrap transition-colors min-h-[32px] cursor-pointer flex items-center gap-1.5 ${
                selectedMood === mood.id
                  ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                  : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
              }`}
            >
              <span>{mood.symbol}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chronological Entries by Date */}
      <div className="space-y-6">
        {groupedEntries.map((group) => (
          <div key={group.date} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-light text-[#929099] pt-2">
              <Calendar className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="text-[#E8E6EB]">{group.date}</span>
              <span>·</span>
              <span>
                {group.entries.length} {group.entries.length === 1 ? 'reflection' : 'reflections'}
              </span>
            </div>

            <div className="space-y-3">
              {group.entries.map((entry) => {
                const moodObj = MOOD_OPTIONS.find((m) => m.id === entry.mood);
                return (
                  <article
                    key={entry.id}
                    className={`p-5 sm:p-6 rounded-2xl bg-[#151518] border transition-all cursor-pointer group space-y-3 relative ${
                      entry.isPinned
                        ? 'border-[#B8A4D8]/40 bg-[#16151a]'
                        : 'border-[#27272B] hover:border-[#B8A4D8]/30'
                    }`}
                    onClick={() => setReadingEntry(entry)}
                  >
                    <div className="flex items-center justify-between text-xs text-[#929099]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.isPinned && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#B8A4D8]/15 text-[#B8A4D8] border border-[#B8A4D8]/30 flex items-center gap-1">
                            <Pin className="w-2.5 h-2.5" /> Pinned
                          </span>
                        )}
                        {entry.time && <span>{entry.time}</span>}
                        <span>·</span>
                        <span>{entry.readTimeMinutes} min read</span>
                        {moodObj && (
                          <>
                            <span>·</span>
                            <span className="text-[#B8A4D8]">
                              {moodObj.symbol} {moodObj.label}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[#929099]"
                      >
                        <button
                          onClick={() => togglePinJournalEntry(entry.id)}
                          className={`p-1.5 rounded-lg hover:text-[#E8E6EB] transition-colors ${
                            entry.isPinned ? 'text-[#B8A4D8]' : ''
                          }`}
                          title={entry.isPinned ? 'Unpin' : 'Pin to top'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(entry)}
                          className="p-1.5 rounded-lg hover:text-[#E8E6EB] transition-colors"
                          title="Edit reflection"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingEntry(entry)}
                          className="p-1.5 rounded-lg hover:text-rose-400 transition-colors"
                          title="Delete reflection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h2 className="text-base font-normal text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors leading-snug">
                      {entry.title}
                    </h2>

                    <p className="text-xs font-light text-[#929099] leading-relaxed line-clamp-3">
                      {entry.content}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {entry.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] font-light px-2 py-0.5 rounded-md bg-[#101012] border border-[#27272B] text-[#929099]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-[#B8A4D8] font-light group-hover:underline">
                        Read entry →
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredAndSortedEntries.length === 0 && (
          <div className="py-16 text-center rounded-2xl bg-[#101012] border border-dashed border-[#27272B] p-6 space-y-3">
            <Feather className="w-7 h-7 text-[#929099] mx-auto opacity-40" />
            <p className="text-xs font-light text-[#E8E6EB]">
              {searchQuery || selectedTag !== 'All' || viewFilter === 'pinned'
                ? 'No matching reflections found for these filters.'
                : 'No reflections recorded yet. Your sanctuary is open.'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 text-xs font-light text-[#E8E6EB] cursor-pointer"
            >
              Write First Reflection
            </button>
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* Entry Editor Modal (Create or Edit) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setIsEditorOpen(false)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-[#151518] border border-[#27272B] rounded-3xl p-5 sm:p-7 max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#B8A4D8]" />
                <h3 className="text-sm font-normal text-[#E8E6EB]">
                  {editingId ? 'Edit Journal Entry' : 'New Journal Entry'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-[#929099] hover:text-[#E8E6EB] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Give your thoughts a gentle name..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              {/* Date & Time Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Date (Backdate or Today)
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="e.g. 08:30 AM"
                    className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3.5 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>
              </div>

              {/* Mood Selector */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1.5">
                  Inner Mood
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormMood(m.id)}
                      className={`p-2 rounded-xl border text-center transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                        formMood === m.id
                          ? 'bg-[#101012] border-[#B8A4D8] text-[#B8A4D8]'
                          : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                      }`}
                    >
                      <span className="text-xs">{m.symbol}</span>
                      <span className="text-[10px] font-light truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Selector & Custom Tag */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1.5">
                  Tags & Categories
                </label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {PREDEFINED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-light transition-colors cursor-pointer ${
                        formTags.includes(tag)
                          ? 'bg-[#B8A4D8]/15 border-[#B8A4D8] text-[#B8A4D8]'
                          : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                  {/* Selected custom tags not in predefined */}
                  {formTags
                    .filter((t) => !PREDEFINED_TAGS.includes(t))
                    .map((custom) => (
                      <span
                        key={custom}
                        className="px-2.5 py-1 rounded-lg bg-[#B8A4D8]/15 border border-[#B8A4D8] text-[#B8A4D8] text-xs font-light flex items-center gap-1"
                      >
                        #{custom}
                        <button
                          type="button"
                          onClick={() => handleToggleTag(custom)}
                          className="hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add custom tag (e.g. Dreams, Sunset, Kyoto)..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    className="flex-1 bg-[#101012] border border-[#27272B] rounded-xl px-3 py-1.5 text-xs text-[#E8E6EB] placeholder-[#929099]/50 focus:outline-none focus:border-[#B8A4D8]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-3 py-1.5 rounded-xl bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs text-[#E8E6EB] transition-colors"
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              {/* Multiline Content */}
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Reflection Content
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder="Pour your unhurried thoughts here..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-2xl p-4 text-xs sm:text-sm text-[#E8E6EB] placeholder-[#929099]/50 leading-relaxed focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              {/* Pin Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinEntry"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#B8A4D8] cursor-pointer"
                />
                <label htmlFor="pinEntry" className="text-xs font-light text-[#E8E6EB] cursor-pointer">
                  Pin this reflection to the top of your journal
                </label>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#27272B]">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs text-[#929099] hover:text-[#E8E6EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-[#B8A4D8] hover:bg-[#c7b6e4] text-[#080809] font-medium rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {editingId ? 'Save Changes' : 'Save Reflection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Entry Reader Dialog */}
      {readingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setReadingEntry(null)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-[#151518] border border-[#27272B] rounded-3xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#27272B]">
              <div className="flex items-center gap-2 text-xs font-light text-[#929099] flex-wrap">
                <span>{readingEntry.date}</span>
                {readingEntry.time && <span>· {readingEntry.time}</span>}
                <span>·</span>
                <span>{readingEntry.readTimeMinutes} min read</span>
                <span>·</span>
                <span className="text-[#B8A4D8]">
                  {MOOD_OPTIONS.find((m) => m.id === readingEntry.mood)?.label}
                </span>
                {readingEntry.isPinned && (
                  <span className="text-[#B8A4D8] flex items-center gap-1 text-[11px]">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
              </div>
              <button
                onClick={() => setReadingEntry(null)}
                className="text-[#929099] hover:text-[#E8E6EB] p-1"
                aria-label="Close reader"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-light text-[#E8E6EB] tracking-wide leading-snug">
                {readingEntry.title}
              </h2>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {readingEntry.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] text-[#929099] font-light px-2 py-0.5 rounded bg-[#101012] border border-[#27272B]"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 text-xs sm:text-sm font-light text-[#E8E6EB]/90 leading-relaxed space-y-4 whitespace-pre-line border-t border-[#27272B]/60">
              {readingEntry.content}
            </div>

            <div className="pt-5 border-t border-[#27272B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(readingEntry)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#101012] hover:bg-[#18181d] border border-[#27272B] text-xs font-light text-[#E8E6EB] flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#B8A4D8]" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setDeletingEntry(readingEntry)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#101012] hover:bg-[#18181d] border border-[#27272B] text-xs font-light text-rose-300 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <button
                onClick={() => setReadingEntry(null)}
                className="px-4 py-2 rounded-xl bg-[#101012] hover:bg-[#18181d] border border-[#27272B] text-xs font-light text-[#E8E6EB]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-[#151518] border border-[#27272B] p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-normal text-[#E8E6EB]">Delete Reflection?</h3>
            </div>
            <p className="text-xs text-[#929099] font-light leading-relaxed">
              Are you sure you want to delete <strong className="text-[#E8E6EB]">"{deletingEntry.title}"</strong>? This will permanently remove it from your sanctuary.
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                className="px-3.5 py-1.5 text-xs text-[#929099] hover:text-[#E8E6EB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
