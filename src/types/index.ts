export type ActiveTab =
  | 'home'
  | 'journal'
  | 'memories'
  | 'letters'
  | 'calendar'
  | 'dreams'
  | 'aifriend'
  | 'career'
  | 'files'
  | 'vault'
  | 'settings';

export type MoodType =
  | 'serene'
  | 'grateful'
  | 'calm'
  | 'reflective'
  | 'soft'
  | 'tired'
  | 'hopeful';

export interface MoodOption {
  id: MoodType;
  label: string;
  symbol: string;
  description: string;
}

export interface Task {
  id: string;
  title: string;
  category: 'gentle' | 'ritual' | 'focus' | 'rest';
  completed: boolean;
  isLowEnergyTask?: boolean;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  createdAt?: string;
  time?: string;
  mood: MoodType;
  tags: string[];
  readTimeMinutes: number;
  isPinned?: boolean;
}

export interface Memory {
  id: string;
  title: string;
  caption: string;
  date: string;
  location?: string;
  imageSrc: string;
  category: string;
  aspect?: 'square' | 'portrait' | 'landscape';
  createdAt?: string;
  updatedAt?: string;
  driveFileId?: string;
  driveSyncedAt?: string;
  driveStatus?: DriveSyncItemStatus;
}

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  date: string; // YYYY-MM-DD
  type: 'ritual' | 'personal' | 'career' | 'rest';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DreamCategory =
  | 'Personal'
  | 'Career'
  | 'Travel'
  | 'Learning'
  | 'Experiences'
  | 'Other'
  | 'travel'
  | 'creative'
  | 'personal'
  | 'peace';

export type DreamStatus = 'Dreaming' | 'In Progress' | 'Completed';

export interface Dream {
  id: string;
  title: string;
  category: DreamCategory;
  description: string;
  progressPercent: number;
  timeframe: string;
  targetDate?: string;
  coverImage?: string;
  status?: DreamStatus;
  pinnedToHome?: boolean;
  createdAt?: string;
}

export interface FutureLetter {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  openDate: string; // YYYY-MM-DD format
  mood?: MoodType;
  isSealed?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  error?: boolean;
}

export interface UserProfile {
  name: string;
  subtitle: string;
  lowEnergyMode: boolean;
  currentMood: MoodType;
  avatarSeed: string;
  journalAwareAI?: boolean;
}

export interface FileItem {
  id: string;
  name: string;
  folderId: string;
  size: number;
  mimeType: string;
  extension: string;
  dataUrl?: string;
  createdAt: string;
  updatedAt: string;
  driveFileId?: string;
  driveSyncedAt?: string;
  driveStatus?: DriveSyncItemStatus;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  isDefault?: boolean;
  color?: string;
  createdAt: string;
  updatedAt?: string;
  driveFolderId?: string;
  driveSyncedAt?: string;
}

export interface VaultConfig {
  isConfigured: boolean;
  salt: string;
  authCheckCiphertext: string;
  authCheckIV: string;
  autoLockMinutes: number;
}

export interface VaultEncryptedRecord {
  id: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

export type VaultItemType = 'folder' | 'file' | 'note';

export interface VaultDecryptedItem {
  id: string;
  name: string;
  itemType: VaultItemType;
  folderId: string | null;
  mimeType?: string;
  extension?: string;
  size?: number;
  content?: string;
  tags?: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

// Google Drive Integration Types
export type DriveAuthStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'error';

export interface DriveUserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

export interface DriveAuthState {
  status: DriveAuthStatus;
  user: DriveUserInfo | null;
  errorMessage: string | null;
  expiresAt: number | null;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  parents?: string[];
  appProperties?: Record<string, string>;
  trashed?: boolean;
  createdTime?: string;
  modifiedTime?: string;
}

export type DriveSyncItemStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'offline_queued';

// Phase D1 Safe Firestore Tombstones
export type TombstoneItemType = 'event' | 'memory' | 'file' | 'folder';

export interface TombstoneRecord {
  id: string; // The deleted record ID
  itemType: TombstoneItemType;
  deletedAt: string; // ISO 8601 string
  deletedAtMs: number; // Date.now() timestamp
  uid: string; // Owner UID
  parentFolderId?: string; // Optional parent folder ID for cascading checks
}

