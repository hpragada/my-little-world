import React, { useState, useRef } from 'react';
import { X, Feather, Image as ImageIcon, CheckCircle, Sparkles, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MOOD_OPTIONS } from '../../data/initialData';
import { MoodType, Task } from '../../types';
import { processImageFile } from '../../services/photoStorage';

import imgDeskJournal from '../../assets/images/aesthetic_desk_journal_1790344269761.jpg';
import imgMorningWindow from '../../assets/images/serene_morning_window_1790344288710.jpg';
import imgStarlitNight from '../../assets/images/starlit_night_sanctuary_1790344300613.jpg';
import imgLavenderDusk from '../../assets/images/lavender_field_dusk_1790344317059.jpg';

export const QuickActionsModal: React.FC = () => {
  const {
    quickActionModal,
    setQuickActionModal,
    addTask,
    addJournalEntry,
    addMemory,
    userProfile,
  } = useApp();

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState<Task['category']>('gentle');

  // Journal form state
  const [journalTitle, setJournalTitle] = useState('');
  const [journalContent, setJournalContent] = useState('');
  const [journalMood, setJournalMood] = useState<MoodType>(userProfile.currentMood);
  const [journalTag, setJournalTag] = useState('Quiet Thoughts');

  // Memory form state
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryCaption, setMemoryCaption] = useState('');
  const [memoryLocation, setMemoryLocation] = useState('Personal Sanctuary');
  const [memoryImage, setMemoryImage] = useState(imgMorningWindow);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!quickActionModal) return null;

  const handleClose = () => {
    setQuickActionModal(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const { dataUrl } = await processImageFile(file);
      setMemoryImage(dataUrl);
      if (!memoryTitle.trim()) {
        setMemoryTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Unsupported image format');
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    addTask(taskTitle.trim(), taskCategory);
    setTaskTitle('');
    handleClose();
  };

  const handleCreateJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalTitle.trim() || !journalContent.trim()) return;
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    addJournalEntry({
      title: journalTitle.trim(),
      content: journalContent.trim(),
      date: dateFormatted,
      mood: journalMood,
      tags: [journalTag],
      readTimeMinutes: Math.max(1, Math.round(journalContent.split(' ').length / 80)),
    });
    setJournalTitle('');
    setJournalContent('');
    handleClose();
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryTitle.trim()) return;
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    await addMemory({
      title: memoryTitle.trim(),
      caption: memoryCaption.trim() || 'A cherished quiet memory.',
      date: dateFormatted,
      location: memoryLocation.trim() || 'Sanctuary',
      imageSrc: memoryImage,
      category: 'Quiet Moments',
      aspect: 'landscape',
    });
    setMemoryTitle('');
    setMemoryCaption('');
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="absolute inset-0"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-lg bg-[#101012] border border-[#27272B] rounded-2xl p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272B] mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#B8A4D8] font-light">
              Quick Action
            </span>
            <span className="text-[#929099]">·</span>
            <h3 className="text-sm font-normal text-[#E8E6EB]">
              {quickActionModal === 'task' && 'Add Today’s Intention'}
              {quickActionModal === 'journal' && 'Write a Gentle Reflection'}
              {quickActionModal === 'memory' && 'Capture a Quiet Memory'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-[#929099] hover:text-[#E8E6EB]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Task Form */}
        {quickActionModal === 'task' && (
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                What gentle intention would you like to set?
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Sip herbal tea by the window..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['gentle', 'ritual', 'focus', 'rest'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTaskCategory(cat)}
                    className={`py-2 px-2 text-xs rounded-lg border capitalize transition-colors min-h-[44px] ${
                      taskCategory === cat
                        ? 'bg-[#151518] border-[#B8A4D8] text-[#B8A4D8]'
                        : 'bg-[#101012] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-light text-[#929099] hover:text-[#E8E6EB] min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!taskTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40 min-h-[44px]"
              >
                Add Intention
              </button>
            </div>
          </form>
        )}

        {/* Journal Form */}
        {quickActionModal === 'journal' && (
          <form onSubmit={handleCreateJournal} className="space-y-4">
            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                Title of your reflection
              </label>
              <input
                type="text"
                autoFocus
                placeholder="A quiet moment today..."
                value={journalTitle}
                onChange={(e) => setJournalTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1.5">
                  Mood
                </label>
                <select
                  value={journalMood}
                  onChange={(e) => setJournalMood(e.target.value as MoodType)}
                  className="w-full px-3 py-2 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                >
                  {MOOD_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.symbol} {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-light text-[#929099] mb-1.5">
                  Tag
                </label>
                <input
                  type="text"
                  value={journalTag}
                  onChange={(e) => setJournalTag(e.target.value)}
                  placeholder="e.g. Gratitude"
                  className="w-full px-3 py-2 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                Your thoughts (unhurried and free)
              </label>
              <textarea
                rows={4}
                placeholder="Write whatever is on your heart today..."
                value={journalContent}
                onChange={(e) => setJournalContent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50 resize-none font-light leading-relaxed"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-light text-[#929099] hover:text-[#E8E6EB] min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!journalTitle.trim() || !journalContent.trim()}
                className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40 min-h-[44px]"
              >
                Save Reflection
              </button>
            </div>
          </form>
        )}

        {/* Memory Form */}
        {quickActionModal === 'memory' && (
          <form onSubmit={handleCreateMemory} className="space-y-4">
            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                Memory Title
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Afternoon tea in the garden"
                value={memoryTitle}
                onChange={(e) => setMemoryTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                Caption or Feeling
              </label>
              <input
                type="text"
                placeholder="A gentle sentence describing this memory..."
                value={memoryCaption}
                onChange={(e) => setMemoryCaption(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50"
              />
            </div>

            <div>
              <label className="block text-xs font-light text-[#929099] mb-1.5">
                Location or Setting
              </label>
              <input
                type="text"
                placeholder="e.g. Home sanctuary, Kyoto, Balcony"
                value={memoryLocation}
                onChange={(e) => setMemoryLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#151518] border border-[#27272B] text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none focus:border-[#B8A4D8]/50"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-light text-[#929099]">
                  Photo Choice
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[#B8A4D8] hover:underline flex items-center gap-1 font-light"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload from device</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
                onChange={handleFileChange}
              />

              {uploadError && (
                <p className="text-[11px] text-rose-300 mb-2">{uploadError}</p>
              )}

              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'desk', src: imgDeskJournal, label: 'Journal' },
                  { id: 'window', src: imgMorningWindow, label: 'Window' },
                  { id: 'night', src: imgStarlitNight, label: 'Starlight' },
                  { id: 'lavender', src: imgLavenderDusk, label: 'Lavender' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMemoryImage(item.src)}
                    className={`relative rounded-xl overflow-hidden border aspect-4/3 transition-all min-h-[44px] ${
                      memoryImage === item.src
                        ? 'border-[#B8A4D8] ring-2 ring-[#B8A4D8]/30'
                        : 'border-[#27272B] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.src}
                      alt={item.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {memoryImage === item.src && (
                      <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#B8A4D8] text-[#080809] flex items-center justify-center text-[10px]">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-light text-[#929099] hover:text-[#E8E6EB] min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!memoryTitle.trim()}
                className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] text-xs font-medium hover:bg-[#c7b6e4] transition-colors disabled:opacity-40 min-h-[44px]"
              >
                Preserve Memory
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
