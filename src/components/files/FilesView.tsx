import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  File,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Lock,
  Download,
  Trash2,
  Edit3,
  Search,
  Grid,
  List,
  ArrowUpDown,
  Check,
  X,
  AlertCircle,
  HardDrive,
  UploadCloud,
  ChevronRight,
  Eye,
  Copy,
  Clock,
  ExternalLink,
  Shield,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FileItem, FolderItem } from '../../types';
import { syncService } from '../../firebase/syncService';
import {
  initFilesStorage,
  getAllFolders,
  getAllFiles,
  saveFolder,
  renameFolder,
  deleteFolderAndContents,
  saveMultipleFiles,
  renameFile,
  deleteFile,
  formatFileSize,
  readFileAsDataURL,
  triggerFileDownload,
} from '../../services/fileStorage';

type SortField = 'name' | 'date' | 'size' | 'type';
type SortOrder = 'asc' | 'desc';

export const FilesView: React.FC = () => {
  const { setActiveTab, driveAuthState, connectDrive, disconnectDrive } = useApp();

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Drag and Drop
  const [isDragging, setIsDragging] = useState(false);

  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [folderRenameInput, setFolderRenameInput] = useState('');

  const [deletingFolder, setDeletingFolder] = useState<FolderItem | null>(null);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [fileRenameInput, setFileRenameInput] = useState('');
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);

  const [copiedPreview, setCopiedPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from IndexedDB
  const refreshStorage = async () => {
    try {
      const data = await initFilesStorage();
      setFolders(data.folders);
      setFiles(data.files);
    } catch (err) {
      console.error('Failed to load files storage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStorage();
    const handleStorageUpdate = () => {
      refreshStorage();
    };
    window.addEventListener('mlw_storage_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('mlw_storage_updated', handleStorageUpdate);
    };
  }, []);

  // Current folder object
  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;

  // Breadcrumbs path
  const getBreadcrumbs = (): FolderItem[] => {
    const crumbs: FolderItem[] = [];
    let cur = currentFolder;
    while (cur) {
      crumbs.unshift(cur);
      cur = cur.parentId ? folders.find((f) => f.id === cur?.parentId) || null : null;
    }
    return crumbs;
  };

  // Subfolders in current folder
  const currentSubfolders = folders.filter((f) =>
    currentFolderId === null ? f.parentId === null : f.parentId === currentFolderId
  );

  // Files in current folder
  const currentFiles = files.filter((f) =>
    currentFolderId === null ? f.folderId === 'root' || !f.folderId : f.folderId === currentFolderId
  );

  // Filtered & sorted files
  const filteredFiles = files
    .filter((file) => {
      if (searchQuery.trim()) {
        return file.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return currentFolderId === null
        ? file.folderId === 'root' || !file.folderId
        : file.folderId === currentFolderId;
    })
    .sort((a, b) => {
      let result = 0;
      if (sortField === 'name') {
        result = a.name.localeCompare(b.name);
      } else if (sortField === 'date') {
        result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'size') {
        result = a.size - b.size;
      } else if (sortField === 'type') {
        result = (a.extension || '').localeCompare(b.extension || '');
      }
      return sortOrder === 'asc' ? result : -result;
    });

  // Calculate storage stats
  const totalFilesCount = files.length;
  const totalSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  // Handle Multi-file Upload
  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const targetFolderId = currentFolderId || 'folder-documents';

    const newFiles: FileItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      try {
        const dataUrl = await readFileAsDataURL(f);
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        newFiles.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: f.name,
          folderId: targetFolderId,
          size: f.size,
          mimeType: f.type || 'application/octet-stream',
          extension: ext,
          dataUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Error reading ${f.name}:`, err);
      }
    }

    if (newFiles.length > 0) {
      await saveMultipleFiles(newFiles);
      const allF = await getAllFiles();
      setFiles(allF);
      newFiles.forEach((f) => syncService.syncFileMetaUpsert(f));
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      await handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newF: FolderItem = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: newFolderName.trim(),
      parentId: currentFolderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: '#B8A4D8',
    };

    await saveFolder(newF);
    const updated = await getAllFolders();
    setFolders(updated);
    setNewFolderName('');
    setShowNewFolderModal(false);
    syncService.syncFolderUpsert(newF);
  };

  // Rename Folder
  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !folderRenameInput.trim()) return;
    await renameFolder(editingFolder.id, folderRenameInput.trim());
    const updated = await getAllFolders();
    setFolders(updated);
    const updatedF = updated.find((f) => f.id === editingFolder.id);
    if (updatedF) {
      syncService.syncFolderUpsert(updatedF);
    }
    setEditingFolder(null);
  };

  // Delete Folder
  const handleDeleteFolderConfirm = async () => {
    if (!deletingFolder) return;
    const targetFolderId = deletingFolder.id;
    const { deletedFolderIds, deletedFileIds } = await deleteFolderAndContents(targetFolderId);
    const [updatedFolders, updatedFiles] = await Promise.all([getAllFolders(), getAllFiles()]);
    setFolders(updatedFolders);
    setFiles(updatedFiles);
    if (currentFolderId === targetFolderId) {
      setCurrentFolderId(deletingFolder.parentId);
    }
    syncService.syncFolderDelete(targetFolderId, deletedFolderIds, deletedFileIds);
    setDeletingFolder(null);
  };

  // Rename File
  const handleRenameFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile || !fileRenameInput.trim()) return;
    await renameFile(editingFile.id, fileRenameInput.trim());
    const updated = await getAllFiles();
    setFiles(updated);
    const updatedFile = updated.find((f) => f.id === editingFile.id);
    if (updatedFile) {
      syncService.syncFileMetaUpsert(updatedFile);
    }
    setEditingFile(null);
  };

  // Delete File
  const handleDeleteFileConfirm = async () => {
    if (!deletingFile) return;
    const fileId = deletingFile.id;
    const folderId = deletingFile.folderId;
    await deleteFile(fileId);
    const updated = await getAllFiles();
    setFiles(updated);
    if (previewFile?.id === fileId) {
      setPreviewFile(null);
    }
    syncService.syncFileDelete(fileId, folderId);
    setDeletingFile(null);
  };

  // File Icon Selector
  const getFileIcon = (mimeType: string, ext: string) => {
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-[#B8A4D8]" />;
    }
    if (ext === 'pdf') {
      return <FileText className="w-5 h-5 text-rose-400" />;
    }
    if (['doc', 'docx', 'txt', 'rtf', 'md', 'markdown'].includes(ext)) {
      return <FileText className="w-5 h-5 text-indigo-300" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'sh'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-teal-300" />;
    }
    return <File className="w-5 h-5 text-[#929099]" />;
  };

  // Safe file preview text extraction
  const getPreviewText = (dataUrl?: string): string => {
    if (!dataUrl) return '';
    try {
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        if (parts.length > 1) {
          return atob(parts[1]);
        }
      }
      return '';
    } catch {
      return 'Preview unavailable for this format. You can download the file to open it safely.';
    }
  };

  const isTextPreviewable = (ext: string, mime: string) => {
    return (
      ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'csv', 'py', 'sh', 'xml', 'yaml', 'yml'].includes(ext) ||
      mime.startsWith('text/')
    );
  };

  const isImagePreviewable = (ext: string, mime: string) => {
    return mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`max-w-6xl mx-auto px-4 sm:px-6 py-6 transition-colors ${
        isDragging ? 'bg-[#151518]/60 ring-2 ring-[#B8A4D8] rounded-3xl' : ''
      }`}
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#27272B]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-light tracking-wide text-[#E8E6EB]">
              My Files
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#151518] border border-[#27272B] text-[#B8A4D8] font-light flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-[#B8A4D8]" />
              <span>IndexedDB Storage</span>
            </span>

            {/* Google Drive Status Badge / Connect Button */}
            {driveAuthState.status === 'connected' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 text-xs">
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  Drive: {driveAuthState.user?.email || 'Connected'}
                </span>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await disconnectDrive();
                  }}
                  className="text-emerald-400 hover:text-emerald-200 ml-1 text-[11px] underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
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
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/70 border border-amber-800/60 text-amber-200 text-xs hover:bg-amber-900/50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                <span>Drive Session Expired (Re-auth)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsConnectingDrive(true);
                    await connectDrive(true);
                  } catch (e) {
                    // Handled by auth manager error state
                  } finally {
                    setIsConnectingDrive(false);
                  }
                }}
                disabled={isConnectingDrive}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#151518] hover:bg-[#1f1f26] border border-[#27272B] hover:border-[#B8A4D8]/40 text-[#929099] hover:text-[#E8E6EB] text-xs cursor-pointer transition-colors"
              >
                <Cloud className="w-3.5 h-3.5 text-[#B8A4D8]" />
                <span>{isConnectingDrive ? 'Connecting...' : 'Connect Google Drive'}</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#929099] font-light mt-1">
            Organize personal documents, certificates, code, and project files with quiet ease.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151518] hover:bg-[#1a1a1f] border border-[#27272B] hover:border-[#B8A4D8]/40 text-[#E8E6EB] text-xs font-light flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#B8A4D8]" />
            <span>New Folder</span>
          </button>

          <label className="min-h-[40px] px-4 py-2 rounded-xl bg-[#B8A4D8] hover:bg-[#c4b3e3] text-[#080809] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer shadow-sm">
            <UploadCloud className="w-4 h-4 text-[#080809]" />
            <span>Upload Files</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleUploadFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Storage Information Bar & Search Controls */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-[#929099] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all files and folders..."
            className="w-full bg-[#101012] border border-[#27272B] rounded-xl pl-9 pr-8 py-2 text-xs font-light text-[#E8E6EB] placeholder-[#929099] focus:outline-none focus:border-[#B8A4D8]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#929099] hover:text-[#E8E6EB]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort & View Mode */}
        <div className="md:col-span-6 flex items-center justify-between md:justify-end gap-2 text-xs font-light">
          {/* Storage stats badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101012] border border-[#27272B] text-[#929099] text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-[#B8A4D8]" />
            <span>
              {totalFilesCount} files · {formatFileSize(totalSizeBytes)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#101012] border border-[#27272B] rounded-xl p-1">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-transparent text-xs text-[#E8E6EB] font-light px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="date" className="bg-[#151518]">Date</option>
              <option value="name" className="bg-[#151518]">Name</option>
              <option value="size" className="bg-[#151518]">Size</option>
              <option value="type" className="bg-[#151518]">Type</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              className="p-1 hover:text-[#E8E6EB] text-[#929099] rounded transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#101012] border border-[#27272B] rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-[#151518] text-[#B8A4D8]' : 'text-[#929099]'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-[#151518] text-[#B8A4D8]' : 'text-[#929099]'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-[#929099] overflow-x-auto py-1">
        <button
          onClick={() => {
            setCurrentFolderId(null);
            setSearchQuery('');
          }}
          className={`hover:text-[#E8E6EB] transition-colors whitespace-nowrap ${
            currentFolderId === null ? 'text-[#E8E6EB] font-normal' : ''
          }`}
        >
          My Files
        </button>

        {getBreadcrumbs().map((folder, index, arr) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="w-3.5 h-3.5 text-[#27272B] shrink-0" />
            <button
              onClick={() => {
                setCurrentFolderId(folder.id);
                setSearchQuery('');
              }}
              className={`hover:text-[#E8E6EB] transition-colors whitespace-nowrap ${
                index === arr.length - 1 ? 'text-[#E8E6EB] font-normal' : ''
              }`}
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Folders Section (Only show when not actively searching) */}
      {!searchQuery && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-light uppercase tracking-wider text-[#929099]">
              Folders ({currentSubfolders.length + (currentFolderId === null ? 1 : 0)})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Private Vault Folder Card - Always displayed at Root */}
            {currentFolderId === null && (
              <div
                onClick={() => setActiveTab('vault')}
                className="group p-3.5 rounded-2xl bg-gradient-to-b from-[#151518] to-[#121215] border border-[#B8A4D8]/30 hover:border-[#B8A4D8] transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-[#B8A4D8]/10 border border-[#B8A4D8]/20 flex items-center justify-center text-[#B8A4D8]">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#B8A4D8]/15 text-[#B8A4D8] border border-[#B8A4D8]/30">
                    Encrypted
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-xs font-normal text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors truncate">
                    Private Vault
                  </h3>
                  <p className="text-[11px] text-[#929099] font-light mt-0.5 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#B8A4D8]" /> Separate PIN Lock
                  </p>
                </div>
              </div>
            )}

            {/* Normal Folders */}
            {currentSubfolders.map((folder) => {
              const fileCount = files.filter((f) => f.folderId === folder.id).length;
              return (
                <div
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="group p-3.5 rounded-2xl bg-[#151518] hover:bg-[#18181d] border border-[#27272B] hover:border-[#B8A4D8]/40 transition-all cursor-pointer relative flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: `${folder.color || '#B8A4D8'}15`,
                        color: folder.color || '#B8A4D8',
                      }}
                    >
                      <Folder className="w-4 h-4" />
                    </div>

                    {/* Context menu for custom folders */}
                    {!folder.isDefault && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <button
                          onClick={() => {
                            setEditingFolder(folder);
                            setFolderRenameInput(folder.name);
                          }}
                          className="p-1 hover:text-[#E8E6EB] text-[#929099]"
                          title="Rename Folder"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingFolder(folder)}
                          className="p-1 hover:text-rose-400 text-[#929099]"
                          title="Delete Folder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <h3 className="text-xs font-light text-[#E8E6EB] group-hover:text-[#B8A4D8] transition-colors truncate">
                      {folder.name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-[#929099] font-light mt-0.5">
                      <span>{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                      {folder.driveFolderId ? (
                        <span className="text-emerald-400 text-[10px] flex items-center gap-0.5" title="Folder synced in Google Drive">
                          <Cloud className="w-2.5 h-2.5" /> Synced
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-light uppercase tracking-wider text-[#929099]">
            {searchQuery ? `Search Results (${filteredFiles.length})` : `Files (${filteredFiles.length})`}
          </h2>
          {currentFolder && (
            <span className="text-[11px] text-[#929099] font-light">
              in {currentFolder.name}
            </span>
          )}
        </div>

        {/* Empty State */}
        {filteredFiles.length === 0 && (
          <div className="p-8 text-center rounded-2xl bg-[#101012] border border-dashed border-[#27272B] my-4">
            <UploadCloud className="w-8 h-8 text-[#929099] mx-auto mb-2 opacity-50" />
            <p className="text-xs font-light text-[#E8E6EB]">No files here yet</p>
            <p className="text-[11px] text-[#929099] font-light mt-1 max-w-sm mx-auto">
              Drag and drop files from your computer or Android device, or click "Upload Files" to store documents, notes, or archives.
            </p>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && filteredFiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredFiles.map((file) => {
              const isImg = isImagePreviewable(file.extension, file.mimeType);
              return (
                <div
                  key={file.id}
                  onClick={() => setPreviewFile(file)}
                  className="group p-3.5 rounded-2xl bg-[#151518] hover:bg-[#18181d] border border-[#27272B] hover:border-[#B8A4D8]/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  {/* Thumbnail / Icon */}
                  <div className="w-full h-28 rounded-xl bg-[#101012] border border-[#27272B]/60 flex items-center justify-center overflow-hidden relative">
                    {isImg && file.dataUrl ? (
                      <img
                        src={file.dataUrl}
                        alt={file.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center p-2">
                        {getFileIcon(file.mimeType, file.extension)}
                        <span className="text-[10px] font-mono uppercase text-[#929099]">
                          .{file.extension || 'file'}
                        </span>
                      </div>
                    )}

                    {/* Quick Action Overlay */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#080809]/80 backdrop-blur-sm p-1 rounded-lg border border-[#27272B]"
                    >
                      <button
                        onClick={() => triggerFileDownload(file.name, file.dataUrl || '')}
                        title="Download"
                        className="p-1 hover:text-[#B8A4D8] text-[#929099]"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingFile(file);
                          setFileRenameInput(file.name);
                        }}
                        title="Rename"
                        className="p-1 hover:text-[#E8E6EB] text-[#929099]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingFile(file)}
                        title="Delete"
                        className="p-1 hover:text-rose-400 text-[#929099]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-3">
                    <h3
                      className="text-xs font-light text-[#E8E6EB] truncate group-hover:text-[#B8A4D8] transition-colors"
                      title={file.name}
                    >
                      {file.name}
                    </h3>
                    <div className="flex items-center justify-between text-[11px] text-[#929099] font-light mt-1">
                      <span>{formatFileSize(file.size)}</span>
                      {file.driveFileId ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[10px]" title="Synced to Google Drive">
                          <Cloud className="w-2.5 h-2.5" /> Synced
                        </span>
                      ) : (
                        <span className="text-[#929099] flex items-center gap-1 text-[10px]" title="Stored locally in IndexedDB">
                          <HardDrive className="w-2.5 h-2.5 text-[#B8A4D8]" /> Local
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && filteredFiles.length > 0 && (
          <div className="rounded-2xl border border-[#27272B] bg-[#151518] overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-light text-[#929099] border-b border-[#27272B] uppercase tracking-wider">
              <div className="col-span-6">Name</div>
              <div className="col-span-2">Format</div>
              <div className="col-span-2">Size & Sync</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-[#27272B]/60">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setPreviewFile(file)}
                  className="grid grid-cols-12 px-4 py-3 items-center text-xs font-light text-[#E8E6EB] hover:bg-[#18181d] transition-colors cursor-pointer group"
                >
                  <div className="col-span-6 flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="shrink-0">{getFileIcon(file.mimeType, file.extension)}</div>
                    <span className="truncate group-hover:text-[#B8A4D8] transition-colors">
                      {file.name}
                    </span>
                  </div>

                  <div className="col-span-2 text-[11px] text-[#929099] uppercase font-mono truncate">
                    {file.extension || 'file'}
                  </div>

                  <div className="col-span-2 text-[11px] text-[#929099] flex items-center gap-2">
                    <span>{formatFileSize(file.size)}</span>
                    {file.driveFileId ? (
                      <span className="text-emerald-400 text-[10px] flex items-center gap-0.5" title="Synced to Google Drive">
                        <Cloud className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-[#929099] text-[10px] flex items-center gap-0.5" title="Stored locally in IndexedDB">
                        <HardDrive className="w-2.5 h-2.5 text-[#B8A4D8]" />
                      </span>
                    )}
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="col-span-2 flex items-center justify-end gap-2 text-[#929099]"
                  >
                    <button
                      onClick={() => triggerFileDownload(file.name, file.dataUrl || '')}
                      title="Download"
                      className="p-1 hover:text-[#B8A4D8]"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFile(file);
                        setFileRenameInput(file.name);
                      }}
                      title="Rename"
                      className="p-1 hover:text-[#E8E6EB]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingFile(file)}
                      title="Delete"
                      className="p-1 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* Create Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-[#080809]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#151518] border border-[#27272B] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <h3 className="text-sm font-normal text-[#E8E6EB]">Create New Folder</h3>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Travel Memories, Tax 2026..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3 py-2 text-xs text-[#E8E6EB] placeholder-[#929099] focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3.5 py-1.5 text-xs text-[#929099] hover:text-[#E8E6EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#B8A4D8] hover:bg-[#c4b3e3] text-[#080809] font-medium rounded-xl transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <div className="fixed inset-0 z-50 bg-[#080809]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#151518] border border-[#27272B] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <h3 className="text-sm font-normal text-[#E8E6EB]">Rename Folder</h3>
              <button
                onClick={() => setEditingFolder(null)}
                className="text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameFolder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  New Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={folderRenameInput}
                  onChange={(e) => setFolderRenameInput(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFolder(null)}
                  className="px-3.5 py-1.5 text-xs text-[#929099] hover:text-[#E8E6EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#B8A4D8] hover:bg-[#c4b3e3] text-[#080809] font-medium rounded-xl transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Folder Confirmation */}
      {deletingFolder && (
        <div className="fixed inset-0 z-50 bg-[#080809]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#151518] border border-[#27272B] p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-normal text-[#E8E6EB]">Delete Folder?</h3>
            </div>
            <p className="text-xs text-[#929099] font-light leading-relaxed">
              Are you sure you want to delete <strong className="text-[#E8E6EB]">"{deletingFolder.name}"</strong>? All files and subfolders inside it will also be deleted.
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                className="px-3.5 py-1.5 text-xs text-[#929099] hover:text-[#E8E6EB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFolderConfirm}
                className="px-4 py-1.5 text-xs bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 bg-[#080809]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#151518] border border-[#27272B] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272B]">
              <h3 className="text-sm font-normal text-[#E8E6EB]">Rename File</h3>
              <button
                onClick={() => setEditingFile(null)}
                className="text-[#929099] hover:text-[#E8E6EB]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameFile} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-light text-[#929099] mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={fileRenameInput}
                  onChange={(e) => setFileRenameInput(e.target.value)}
                  className="w-full bg-[#101012] border border-[#27272B] rounded-xl px-3 py-2 text-xs text-[#E8E6EB] focus:outline-none focus:border-[#B8A4D8]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="px-3.5 py-1.5 text-xs text-[#929099] hover:text-[#E8E6EB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-[#B8A4D8] hover:bg-[#c4b3e3] text-[#080809] font-medium rounded-xl transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete File Confirmation */}
      {deletingFile && (
        <div className="fixed inset-0 z-50 bg-[#080809]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#151518] border border-[#27272B] p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-normal text-[#E8E6EB]">Delete File?</h3>
            </div>
            <p className="text-xs text-[#929099] font-light leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-[#E8E6EB]">"{deletingFile.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeletingFile(null)}
                className="px-3.5 py-1.5 text-xs text-[#929099] hover:text-[#E8E6EB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFileConfirm}
                className="px-4 py-1.5 text-xs bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-[#080809]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-[#151518] border border-[#27272B] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#27272B] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(previewFile.mimeType, previewFile.extension)}
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-normal text-[#E8E6EB] truncate">
                    {previewFile.name}
                  </h3>
                  <p className="text-[11px] text-[#929099] font-light">
                    {formatFileSize(previewFile.size)} · {previewFile.mimeType}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => triggerFileDownload(previewFile.name, previewFile.dataUrl || '')}
                  className="px-3 py-1.5 rounded-xl bg-[#101012] hover:bg-[#1a1a1f] border border-[#27272B] text-xs text-[#E8E6EB] font-light flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#B8A4D8]" />
                  <span className="hidden sm:inline">Download</span>
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 text-[#929099] hover:text-[#E8E6EB] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Storage & Drive Metadata bar */}
            <div className="px-5 py-2 bg-[#101012] border-b border-[#27272B] flex items-center justify-between text-[11px] text-[#929099] font-light">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-[#B8A4D8]" />
                IndexedDB Local Storage: Preserved
              </span>
              <span>
                {previewFile.driveFileId ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> Drive Linked
                  </span>
                ) : (
                  <span className="text-[#929099]">Local Only</span>
                )}
              </span>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-[300px] flex items-center justify-center">
              {isImagePreviewable(previewFile.extension, previewFile.mimeType) ? (
                <div className="w-full h-full max-h-[70vh] flex items-center justify-center">
                  <img
                    src={previewFile.dataUrl}
                    alt={previewFile.name}
                    className="max-h-[65vh] max-w-full object-contain rounded-xl"
                  />
                </div>
              ) : isTextPreviewable(previewFile.extension, previewFile.mimeType) ? (
                <div className="w-full h-full">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-[#929099]">Safe Text Viewer</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(getPreviewText(previewFile.dataUrl));
                        setCopiedPreview(true);
                        setTimeout(() => setCopiedPreview(false), 2000);
                      }}
                      className="text-[11px] text-[#929099] hover:text-[#E8E6EB] flex items-center gap-1"
                    >
                      {copiedPreview ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPreview ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-2xl bg-[#080809] border border-[#27272B] text-xs font-mono text-[#E8E6EB] whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto leading-relaxed">
                    {getPreviewText(previewFile.dataUrl)}
                  </pre>
                </div>
              ) : (
                <div className="text-center p-8 max-w-md">
                  <div className="w-12 h-12 rounded-2xl bg-[#101012] border border-[#27272B] flex items-center justify-center mx-auto mb-3">
                    {getFileIcon(previewFile.mimeType, previewFile.extension)}
                  </div>
                  <h4 className="text-sm font-normal text-[#E8E6EB]">Binary File Format</h4>
                  <p className="text-xs text-[#929099] font-light mt-1.5 leading-relaxed">
                    This file is stored safely. To inspect or edit proprietary formats like spreadsheets, archives, or presentations, download it directly to your device.
                  </p>
                  <button
                    onClick={() => triggerFileDownload(previewFile.name, previewFile.dataUrl || '')}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#B8A4D8] hover:bg-[#c4b3e3] text-[#080809] text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download {previewFile.name}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
