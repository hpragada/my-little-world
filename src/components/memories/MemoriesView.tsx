import React, { useState, useRef, useMemo } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Calendar,
  MapPin,
  Trash2,
  X,
  Plus,
  AlertCircle,
  Check,
  Grid,
  Clock,
  Search,
  Edit3,
  HardDrive,
  Info,
  Maximize2,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  CheckCircle2,
  CloudUpload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Memory } from '../../types';
import { processImageFile, updateMemoryDriveMeta } from '../../services/photoStorage';
import {
  backupMemoriesToDrive,
  restoreMemoriesFromDrive,
  BackupProgress,
} from '../../services/googleDriveBackup';

interface StagedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  caption: string;
  date: string;
  location: string;
  category: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MemoriesView: React.FC = () => {
  const {
    memories,
    addMultipleMemories,
    updateMemory,
    deleteMemory,
    driveAuthState,
    connectDrive,
    disconnectDrive,
  } = useApp();

  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [driveActionNotice, setDriveActionNotice] = useState<string | null>(null);

  // Active Lightbox / Preview
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  // Edit Memory Details State
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSaveNotice, setEditSaveNotice] = useState<string | null>(null);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Upload & Staging state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Common staging date & location
  const todayStr = new Date().toISOString().split('T')[0];
  const [batchDate, setBatchDate] = useState(todayStr);
  const [batchLocation, setBatchLocation] = useState('Personal Sanctuary');
  const [batchCategory, setBatchCategory] = useState('Quiet Moments');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract all categories
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(memories.map((m) => m.category || 'Quiet Moments')))];
  }, [memories]);

  // Extract available years from memory dates
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    memories.forEach((m) => {
      const match = m.date.match(/\b(20\d\d)\b/);
      if (match) years.add(match[1]);
    });
    return ['All', ...Array.from(years).sort().reverse()];
  }, [memories]);

  // Handle files selected from file picker or drag-drop
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsProcessing(true);

    const newlyStaged: StagedPhoto[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { dataUrl } = await processImageFile(file);
        newlyStaged.push({
          id: `stage-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          previewUrl: dataUrl,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          caption: '',
          date: batchDate,
          location: batchLocation,
          category: batchCategory,
        });
      } catch (err: any) {
        errors.push(`${file.name}: ${err?.message || 'Unsupported format'}`);
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' • '));
    }

    if (newlyStaged.length > 0) {
      setStagedPhotos((prev) => [...prev, ...newlyStaged]);
      setIsUploadModalOpen(true);
    }

    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveStagedPhoto = (id: string) => {
    setStagedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateStagedField = (
    id: string,
    field: keyof StagedPhoto,
    value: string
  ) => {
    setStagedPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleApplyBatchDate = (newDate: string) => {
    setBatchDate(newDate);
    setStagedPhotos((prev) => prev.map((p) => ({ ...p, date: newDate })));
  };

  // Save all staged photos to IndexedDB
  const handleSaveAllPhotos = async () => {
    if (stagedPhotos.length === 0) return;

    const formattedItems = stagedPhotos.map((photo) => {
      let displayDate = photo.date;
      try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(photo.date)) {
          const [y, m, d] = photo.date.split('-');
          const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          displayDate = dt.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          });
        }
      } catch {
        displayDate = photo.date;
      }

      return {
        title: photo.title.trim() || 'A cherished memory',
        caption: photo.caption.trim() || 'A quiet, unhurried moment held in memory.',
        date: displayDate,
        location: photo.location.trim() || undefined,
        imageSrc: photo.previewUrl,
        category: photo.category.trim() || 'Quiet Moments',
        aspect: 'landscape' as const,
      };
    });

    await addMultipleMemories(formattedItems);
    setStagedPhotos([]);
    setIsUploadModalOpen(false);
  };

  // Open Edit Details modal for an existing memory
  const handleOpenEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setEditTitle(memory.title);
    setEditCaption(memory.caption);

    // Parse date into ISO format if possible
    let iso = todayStr;
    try {
      const parsed = new Date(memory.date);
      if (!isNaN(parsed.getTime())) {
        iso = parsed.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
    setEditDate(iso);
    setEditLocation(memory.location || '');
    setEditCategory(memory.category || 'Quiet Moments');
  };

  // Save edits to existing memory
  const handleSaveMemoryEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory) return;

    let displayDate = editDate;
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(editDate)) {
        const [y, m, d] = editDate.split('-');
        const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        displayDate = dt.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      displayDate = editDate;
    }

    const updated = {
      title: editTitle.trim() || 'A cherished memory',
      caption: editCaption.trim(),
      date: displayDate,
      location: editLocation.trim() || undefined,
      category: editCategory.trim() || 'Quiet Moments',
    };

    await updateMemory(editingMemory.id, updated);

    // Also update selectedMemory in lightbox if viewing
    if (selectedMemory && selectedMemory.id === editingMemory.id) {
      setSelectedMemory({ ...selectedMemory, ...updated });
    }

    setEditingMemory(null);
    setEditSaveNotice('Memory details updated safely in your private storage.');
    setTimeout(() => setEditSaveNotice(null), 3000);
  };

  const handleDeleteConfirmed = async (id: string) => {
    await deleteMemory(id);
    setConfirmDeleteId(null);
    setSelectedMemory(null);
    if (editingMemory?.id === id) {
      setEditingMemory(null);
    }
  };

  // Filter memories with category, year, month, and search query
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      // Category filter
      if (selectedCategory !== 'All' && m.category !== selectedCategory) return false;

      // Year filter
      if (selectedYear !== 'All') {
        if (!m.date.includes(selectedYear)) return false;
      }

      // Month filter
      if (selectedMonth !== 'All') {
        const lowerDate = m.date.toLowerCase();
        if (!lowerDate.includes(selectedMonth.toLowerCase())) return false;
      }

      // Search caption & title & location
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          m.title.toLowerCase().includes(q) ||
          m.caption.toLowerCase().includes(q) ||
          (m.location && m.location.toLowerCase().includes(q)) ||
          m.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [memories, selectedCategory, selectedYear, selectedMonth, searchQuery]);

  // Group memories by date for Timeline view
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, Memory[]> = {};
    for (const m of filteredMemories) {
      const d = m.date || 'Unspecified Date';
      if (!grouped[d]) {
        grouped[d] = [];
      }
      grouped[d].push(m);
    }
    return grouped;
  }, [filteredMemories]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-7 animate-in fade-in duration-300">
      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272B]">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Visual Archive</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Keepsakes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            Memories & Keepsakes
          </h1>
          <p className="text-xs sm:text-sm font-light text-[#929099] mt-1 max-w-xl">
            A quiet visual archive of real moments, stored safely and persistently in your browser's private database.
          </p>
        </div>

        {/* Upload Photos Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isProcessing ? 'Processing Photos...' : 'Upload Photos'}</span>
          </button>
        </div>
      </div>

      {/* Google Drive & Storage Status Card */}
      <div className="px-4 py-3.5 rounded-2xl bg-[#151518] border border-[#27272B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#1A1A1E] border border-[#27272B] shrink-0">
            {driveAuthState.status === 'connected' ? (
              <Cloud className="w-4 h-4 text-emerald-400" />
            ) : driveAuthState.status === 'expired' ? (
              <CloudOff className="w-4 h-4 text-amber-400" />
            ) : (
              <HardDrive className="w-4 h-4 text-[#B8A4D8]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-[#E8E6EB] font-normal">
                {driveAuthState.status === 'connected'
                  ? 'Google Drive Connected'
                  : driveAuthState.status === 'expired'
                  ? 'Drive Session Expired'
                  : driveAuthState.status === 'connecting'
                  ? 'Connecting to Google Drive...'
                  : 'Private Local Storage (IndexedDB)'}
              </strong>
              {driveAuthState.status === 'connected' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300">
                  {driveAuthState.user?.email || 'drive.file scope active'}
                </span>
              )}
              {driveAuthState.status === 'expired' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 border border-amber-800/60 text-amber-300">
                  Re-auth required
                </span>
              )}
            </div>
            <p className="text-[#929099] font-light mt-0.5 text-[11px] leading-relaxed">
              {driveAuthState.status === 'connected'
                ? 'Your Google Drive is linked for memories backup. Photos are preserved locally in IndexedDB and ready for cloud backup.'
                : 'All photos are preserved on your device in IndexedDB. Connect Google Drive to prepare for cross-device cloud backup.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          {driveAuthState.status === 'connected' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDriveActionNotice('Google Drive service is connected and ready. Live photo upload will be enabled upon Phase D authorization.');
                  setTimeout(() => setDriveActionNotice(null), 5000);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#202024] hover:bg-[#25252A] border border-[#2F2F36] text-[#E8E6EB] text-xs font-light flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Backup pending explicit authorization"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span>Backup to Drive</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await disconnectDrive();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-transparent hover:bg-rose-950/20 text-[#929099] hover:text-rose-300 text-xs font-light transition-colors cursor-pointer"
                title="Disconnect Google Drive"
              >
                Disconnect
              </button>
            </>
          ) : driveAuthState.status === 'expired' ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsConnectingDrive(true);
                  await connectDrive(true);
                } finally {
                  setIsConnectingDrive(false);
                }
              }}
              disabled={isConnectingDrive}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-light flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConnectingDrive ? 'animate-spin' : ''}`} />
              <span>Re-authenticate</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsConnectingDrive(true);
                  await connectDrive(true);
                } catch (e: any) {
                  // Handled by auth manager error state
                } finally {
                  setIsConnectingDrive(false);
                }
              }}
              disabled={isConnectingDrive}
              className="px-3.5 py-1.5 rounded-xl bg-[#1D1D22] hover:bg-[#27272E] border border-[#2F2F36] text-[#E8E6EB] text-xs font-light flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span>{isConnectingDrive ? 'Connecting...' : 'Connect Google Drive'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Drive Action Notice */}
      {driveActionNotice && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50 flex items-center gap-2 text-xs text-indigo-200 animate-in fade-in duration-200">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{driveActionNotice}</span>
        </div>
      )}

      {/* Edit Success Toast */}
      {editSaveNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{editSaveNotice}</span>
        </div>
      )}

      {/* Upload Error Banner if any */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-start gap-3 text-xs text-rose-200 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-normal block mb-0.5">Upload Notice</span>
            <p className="text-rose-200/90 font-light">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-400 hover:text-rose-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar & Month / Year Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Search Input */}
        <div className="sm:col-span-6 flex items-center gap-2.5 bg-[#151518] border border-[#27272B] rounded-xl px-3.5 py-2 focus-within:border-[#B8A4D8]/50 transition-colors">
          <Search className="w-4 h-4 text-[#929099]" />
          <input
            type="text"
            placeholder="Search captions, moments, or locations..."
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

        {/* Year Select */}
        <div className="sm:col-span-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] font-light rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#B8A4D8]/50 cursor-pointer"
          >
            <option value="All">All Years</option>
            {availableYears.filter((y) => y !== 'All').map((yr) => (
              <option key={yr} value={yr} className="bg-[#151518]">
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Month Select */}
        <div className="sm:col-span-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] font-light rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#B8A4D8]/50 cursor-pointer"
          >
            <option value="All">All Months</option>
            {MONTH_NAMES.map((m) => (
              <option key={m} value={m} className="bg-[#151518]">
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode Toggle: Timeline vs Grid */}
        <div className="sm:col-span-2 flex justify-end">
          <div className="flex items-center gap-1 bg-[#101012] p-1 rounded-xl border border-[#27272B]">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 rounded-lg text-xs font-light flex items-center gap-1 transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-[#151518] text-[#E8E6EB] border border-[#27272B]'
                  : 'text-[#929099] hover:text-[#E8E6EB]'
              }`}
              title="Timeline view"
            >
              <Clock className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="hidden sm:inline">Timeline</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-light flex items-center gap-1 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#151518] text-[#E8E6EB] border border-[#27272B]'
                  : 'text-[#929099] hover:text-[#E8E6EB]'
              }`}
              title="Grid view"
            >
              <Grid className="w-3.5 h-3.5 text-[#B8A4D8]" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-light whitespace-nowrap transition-colors min-h-[36px] cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#101012] border-[#B8A4D8] text-[#E8E6EB]'
                : 'bg-[#151518] border-[#27272B] text-[#929099] hover:text-[#E8E6EB]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Date-wise Timeline View */}
      {viewMode === 'timeline' && (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([dateLabel, dateMemories]) => (
            <section key={dateLabel} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-normal text-[#E8E6EB] tracking-wide">
                <Calendar className="w-3.5 h-3.5 text-[#B8A4D8]" />
                <span>{dateLabel}</span>
                <span className="text-[11px] text-[#929099] font-light">
                  ({dateMemories.length} {dateMemories.length === 1 ? 'memory' : 'memories'})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateMemories.map((mem) => (
                  <MemoryCard
                    key={mem.id}
                    memory={mem}
                    onClick={() => setSelectedMemory(mem)}
                    onEdit={() => handleOpenEdit(mem)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Classic Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMemories.map((mem) => (
            <MemoryCard
              key={mem.id}
              memory={mem}
              onClick={() => setSelectedMemory(mem)}
              onEdit={() => handleOpenEdit(mem)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredMemories.length === 0 && (
        <div className="py-16 text-center rounded-2xl bg-[#101012] border border-[#27272B] p-6 space-y-3">
          <ImageIcon className="w-8 h-8 text-[#929099] mx-auto opacity-40" />
          <p className="text-xs font-light text-[#E8E6EB]">
            No memories match the selected filters or search.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#E8E6EB] cursor-pointer"
          >
            Upload a Photo
          </button>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Multi-Photo Staging Modal Before Saving */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setIsUploadModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-3xl bg-[#151518] border border-[#27272B] rounded-3xl p-5 sm:p-7 max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#27272B] mb-4">
              <div>
                <h3 className="text-sm font-normal text-[#E8E6EB]">
                  Review & Save Photos ({stagedPhotos.length})
                </h3>
                <p className="text-xs text-[#929099] font-light">
                  Add captions, confirm dates, and save permanently to your private sanctuary.
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-[#929099] hover:text-[#E8E6EB] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Global Date Bar */}
            <div className="p-3 rounded-2xl bg-[#101012] border border-[#27272B] mb-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-[#929099] font-light">Apply date to all:</span>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => handleApplyBatchDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-auto px-3 py-1.5 rounded-xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#E8E6EB] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#B8A4D8]" />
                <span>Add More Photos</span>
              </button>
            </div>

            {/* Staged Items List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {stagedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="p-3.5 rounded-2xl bg-[#101012] border border-[#27272B] flex flex-col sm:flex-row gap-4 relative group"
                >
                  {/* Thumbnail */}
                  <div className="w-full sm:w-36 h-28 bg-[#080809] rounded-xl overflow-hidden shrink-0 border border-[#27272B]/60">
                    <img
                      src={photo.previewUrl}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-[#929099] font-light mb-1">
                          Memory Title
                        </label>
                        <input
                          type="text"
                          value={photo.title}
                          onChange={(e) =>
                            handleUpdateStagedField(photo.id, 'title', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-[#929099] font-light mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={photo.date}
                          onChange={(e) =>
                            handleUpdateStagedField(photo.id, 'date', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#929099] font-light mb-1">
                        Caption or Reflection Note
                      </label>
                      <input
                        type="text"
                        placeholder="What made this moment special or calm?"
                        value={photo.caption}
                        onChange={(e) =>
                          handleUpdateStagedField(photo.id, 'caption', e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 rounded-xl bg-[#151518] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]/50"
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveStagedPhoto(photo.id)}
                    className="sm:self-start p-1.5 text-[#929099] hover:text-rose-400"
                    title="Remove from upload"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-4 border-t border-[#27272B] flex items-center justify-between">
              <span className="text-xs text-[#929099] font-light">
                {stagedPhotos.length} {stagedPhotos.length === 1 ? 'photo' : 'photos'} ready
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-light text-[#929099] hover:text-[#E8E6EB]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllPhotos}
                  disabled={stagedPhotos.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors text-xs font-medium shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  Save to Memories
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Existing Memory Details Modal */}
      {editingMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => setEditingMemory(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-[#151518] border border-[#27272B] rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#B8A4D8]" />
                <h3 className="text-sm font-normal text-[#E8E6EB]">Edit Memory Details</h3>
              </div>
              <button
                onClick={() => setEditingMemory(null)}
                className="text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMemoryEdits} className="space-y-3.5">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#101012] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Date of Memory
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#101012] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-light text-[#929099] mb-1">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Balcony, Kyoto Garden"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#101012] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  placeholder="e.g. Quiet Moments, Travel, Nature"
                  className="w-full px-3 py-2 rounded-xl bg-[#101012] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Caption & Feeling Notes
                </label>
                <textarea
                  rows={4}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Reflect on this moment..."
                  className="w-full p-3 rounded-2xl bg-[#101012] border border-[#27272B] text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27272B]">
                <button
                  type="button"
                  onClick={() => setEditingMemory(null)}
                  className="px-4 py-2 text-xs text-[#929099] hover:text-[#E8E6EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Large Image Preview Modal */}
      {selectedMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="absolute inset-0"
            onClick={() => {
              setSelectedMemory(null);
              setConfirmDeleteId(null);
            }}
          />
          <div className="relative z-10 w-full max-w-3xl bg-[#151518] border border-[#27272B] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Image Preview Area */}
            <div className="relative max-h-[58vh] min-h-[240px] w-full bg-[#080809] flex items-center justify-center p-2">
              <img
                src={selectedMemory.imageSrc}
                alt={selectedMemory.title}
                className="max-h-[55vh] max-w-full object-contain rounded-xl"
              />
              <button
                onClick={() => {
                  setSelectedMemory(null);
                  setConfirmDeleteId(null);
                }}
                aria-label="Close memory modal"
                className="absolute top-4 right-4 min-h-[40px] min-w-[40px] rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details & Actions */}
            <div className="p-5 sm:p-6 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-light text-[#929099] flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#B8A4D8]" />
                  <span className="text-[#E8E6EB]">{selectedMemory.date}</span>
                  {selectedMemory.location && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#B8A4D8]" />
                        {selectedMemory.location}
                      </span>
                    </>
                  )}
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#101012] border border-[#27272B] text-[#B8A4D8]">
                  {selectedMemory.category}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-normal text-[#E8E6EB]">
                {selectedMemory.title}
              </h2>

              <p className="text-xs sm:text-sm font-light text-[#929099] leading-relaxed whitespace-pre-line">
                {selectedMemory.caption}
              </p>

              {/* Storage & Drive Metadata status */}
              <div className="p-3 rounded-xl bg-[#101012] border border-[#27272B] flex items-center justify-between text-[11px] text-[#929099] font-light">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-[#B8A4D8]" />
                  <span>IndexedDB Local Storage: Preserved</span>
                </div>
                <div>
                  {selectedMemory.driveFileId ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Cloud className="w-3 h-3" /> Drive Linked
                    </span>
                  ) : (
                    <span className="text-[#929099] flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-[#B8A4D8]" /> Local Only
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar: Edit, Delete, Close */}
              <div className="pt-4 border-t border-[#27272B] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(selectedMemory)}
                    className="px-3.5 py-2 rounded-xl bg-[#101012] hover:bg-[#1c1c22] border border-[#27272B] text-xs font-light text-[#E8E6EB] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#B8A4D8]" />
                    <span>Edit Details</span>
                  </button>

                  {confirmDeleteId === selectedMemory.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDeleteConfirmed(selectedMemory.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-900/60 border border-rose-500/50 text-xs font-light text-rose-200 hover:bg-rose-900"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs text-[#929099] hover:text-[#E8E6EB]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(selectedMemory.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-light text-[#929099] hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedMemory(null);
                    setConfirmDeleteId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#101012] hover:bg-[#1a1a20] border border-[#27272B] text-xs font-light text-[#E8E6EB]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Reusable aesthetic memory card with quick edit button
 */
const MemoryCard: React.FC<{
  memory: Memory;
  onClick: () => void;
  onEdit: () => void;
}> = ({ memory, onClick, onEdit }) => {
  return (
    <div
      onClick={onClick}
      className="group rounded-2xl bg-[#151518] border border-[#27272B] hover:border-[#B8A4D8]/40 transition-all overflow-hidden cursor-pointer flex flex-col relative"
    >
      <div className="relative aspect-4/3 w-full bg-[#101012] overflow-hidden">
        <img
          src={memory.imageSrc}
          alt={memory.title}
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Sync Status Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
          {memory.driveFileId ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-light text-emerald-300 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-full border border-emerald-500/30">
              <Cloud className="w-2.5 h-2.5 text-emerald-400" />
              <span>Drive Synced</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-light text-[#C4C2CC] bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/10">
              <HardDrive className="w-2.5 h-2.5 text-[#B8A4D8]" />
              <span>Local Only</span>
            </span>
          )}
        </div>

        {memory.location && (
          <div className="absolute bottom-2.5 left-2.5 text-[11px] font-light text-white/90 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#B8A4D8]" />
            <span>{memory.location}</span>
          </div>
        )}

        {/* Quick Edit Overlay button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-opacity opacity-0 group-hover:opacity-100"
          title="Edit caption and date"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#929099] font-light">
            <span>{memory.date}</span>
            <span>{memory.category}</span>
          </div>
          <h3 className="text-xs sm:text-sm font-normal text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors line-clamp-1 mt-0.5">
            {memory.title}
          </h3>
          <p className="text-[11px] font-light text-[#929099] line-clamp-2 leading-relaxed mt-0.5">
            {memory.caption}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-[#27272B]/50 text-[11px] text-[#929099] font-light">
          <span>View memory</span>
          <span className="text-[#B8A4D8] group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </div>
      </div>
    </div>
  );
};
