/**
 * Non-Destructive Firestore Two-Way Sync Service
 *
 * Mandatory Principles:
 * 1. ZERO DATA LOSS: Never delete, reset, or overwrite local storage on sign-in, sign-out, or sync.
 * 2. Strict UID Isolation: All operations scoped to `/users/{userId}/...`
 * 3. Idempotent Merge & Conflict Resolution:
 *    - Reconciles local items and cloud items by unique ID.
 *    - Uses timestamps (updatedAt / createdAt) to resolve conflicts without discarding non-conflicting items.
 * 4. Offline First: Multi-tab persistence handles offline queuing; local state always responds instantly.
 * 5. Loop Prevention: Ignores snapshots with `metadata.hasPendingWrites` to prevent listener-write cycles.
 * 6. Explicitly scopes to: UserProfile, Tasks, Journal, Dreams, FutureLetters, and CalendarEvents.
 *    (Memories binaries and Private Vault are handled in subsequent dedicated steps).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import {
  UserProfile,
  Task,
  JournalEntry,
  Dream,
  FutureLetter,
  CalendarEvent,
  Memory,
  FileItem,
  FolderItem,
  TombstoneRecord,
} from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  errorReason?: 'network' | 'quota' | 'auth' | 'general' | null;
  retryAttempt?: number;
  nextRetryMs?: number | null;
}

export interface CloudSyncListeners {
  onProfileUpdated?: (profile: UserProfile) => void;
  onTasksUpdated?: (tasks: Task[]) => void;
  onJournalUpdated?: (entries: JournalEntry[]) => void;
  onDreamsUpdated?: (dreams: Dream[]) => void;
  onLettersUpdated?: (letters: FutureLetter[]) => void;
  onEventsUpdated?: (events: CalendarEvent[]) => void;
  onMemoriesMetaUpdated?: (memories: Memory[]) => void;
  onFoldersUpdated?: (folders: FolderItem[]) => void;
  onFilesMetaUpdated?: (files: FileItem[]) => void;
  onSyncStateChange?: (state: SyncState) => void;
}

// Phase D1 Safe Permanent Tombstones (Never automatically expired or purged)
const TOMBSTONE_STORAGE_PREFIX = 'mlw_tombstones_';

class FirestoreSyncService {
  private activeUnsubscribers: Unsubscribe[] = [];
  private currentUserId: string | null = null;
  private isApplyingRemoteUpdate = false;
  private isSyncInProgress = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private lastLocalState: {
    userId: string;
    localState: any;
  } | null = null;
  private syncState: SyncState = {
    status: 'idle',
    lastSyncedAt: null,
    errorMessage: null,
    errorReason: null,
    retryAttempt: 0,
    nextRetryMs: null,
  };
  private listeners: CloudSyncListeners = {};
  private tombstones: Map<string, TombstoneRecord> = new Map();

  constructor() {
    // In-memory initialized; user-scoped tombstones loaded on startSync
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (
          this.currentUserId &&
          (this.syncState.status === 'offline' || this.syncState.status === 'error')
        ) {
          console.log('[Firestore Sync] Device back online, retrying sync immediately...');
          if (this.lastLocalState) {
            this.startSync(this.lastLocalState.userId, this.lastLocalState.localState, true);
          }
        }
      });
    }
  }

  private loadTombstones(userId: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      this.tombstones.clear();
      const raw = localStorage.getItem(`${TOMBSTONE_STORAGE_PREFIX}${userId}`);
      if (raw) {
        const parsed: Record<string, TombstoneRecord> = JSON.parse(raw);
        for (const [id, record] of Object.entries(parsed)) {
          this.tombstones.set(id, record);
        }
      }
    } catch (err) {
      console.warn('[Firestore Sync] Failed to load durable tombstones:', err);
    }
  }

  private saveTombstones(userId: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const obj: Record<string, TombstoneRecord> = {};
      this.tombstones.forEach((record, id) => {
        obj[id] = record;
      });
      localStorage.setItem(`${TOMBSTONE_STORAGE_PREFIX}${userId}`, JSON.stringify(obj));
    } catch (err) {
      console.warn('[Firestore Sync] Failed to save durable tombstones:', err);
    }
  }

  public recordTombstone(record: TombstoneRecord): void {
    this.tombstones.set(record.id, record);
    if (this.currentUserId) {
      this.saveTombstones(this.currentUserId);
    }
  }

  public isTombstoned(id: string): boolean {
    return this.tombstones.has(id);
  }

  public isFolderTombstoned(folderId: string): boolean {
    return this.tombstones.has(folderId);
  }

  public getTombstone(id: string): TombstoneRecord | undefined {
    return this.tombstones.get(id);
  }

  /**
   * Reconcile durable tombstones with Firestore
   * Ensures offline/stale devices never recreate a deleted record
   */
  private async reconcileTombstones(userId: string): Promise<void> {
    this.loadTombstones(userId);
    try {
      const tombstonesCol = collection(db, 'users', userId, 'tombstones');
      const snap = await getDocs(tombstonesCol);
      let changed = false;
      snap.forEach((d) => {
        const data = d.data() as TombstoneRecord;
        const id = data.id || d.id;
        const existing = this.tombstones.get(id);
        if (!existing || data.deletedAtMs > existing.deletedAtMs) {
          this.tombstones.set(id, { ...data, id });
          changed = true;
        }
      });
      if (changed) {
        this.saveTombstones(userId);
      }
    } catch (err) {
      console.warn('[Firestore Sync] Tombstone reconciliation notice (offline cache active):', err);
    }
  }

  public setListeners(listeners: CloudSyncListeners) {
    this.listeners = listeners;
  }

  public getSyncState(): SyncState {
    return { ...this.syncState };
  }

  private updateSyncState(updates: Partial<SyncState>) {
    this.syncState = { ...this.syncState, ...updates };
    if (this.listeners.onSyncStateChange) {
      this.listeners.onSyncStateChange(this.syncState);
    }
  }

  /**
   * Compare timestamps safely to determine whether item A is newer than item B
   */
  private isNewer(itemA: any, itemB: any): boolean {
    const timeA = new Date(itemA.updatedAt || itemA.createdAt || 0).getTime();
    const timeB = new Date(itemB.updatedAt || itemB.createdAt || 0).getTime();
    return timeA > timeB;
  }

  private stopListenersOnly(): void {
    this.activeUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.warn('[Firestore Sync] Unsubscribe error:', e);
      }
    });
    this.activeUnsubscribers = [];
  }

  /**
   * Start two-way synchronization for authenticated user
   */
  public async startSync(
    userId: string,
    localState: {
      profile: UserProfile;
      tasks: Task[];
      journal: JournalEntry[];
      dreams: Dream[];
      letters: FutureLetter[];
      events: CalendarEvent[];
      memories?: Memory[];
      folders?: FolderItem[];
      files?: FileItem[];
    },
    forceManual: boolean = false
  ): Promise<void> {
    // 1. Prevent duplicate concurrent sync execution loops
    if (this.isSyncInProgress) {
      console.log('[Firestore Sync] Sync already in progress, request coalesced.');
      return;
    }

    // 2. If already healthy and synced for this user and not a forced manual retry, skip redundant initial work
    if (
      !forceManual &&
      this.currentUserId === userId &&
      this.activeUnsubscribers.length > 0 &&
      this.syncState.status === 'synced'
    ) {
      return;
    }

    // Clear any pending retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Clean up previous listeners and set in-progress flag
    this.stopListenersOnly();
    this.currentUserId = userId;
    this.isSyncInProgress = true;
    this.lastLocalState = { userId, localState };

    this.updateSyncState({
      status: 'syncing',
      errorMessage: null,
      errorReason: null,
      nextRetryMs: null,
    });

    try {
      // Phase 0: Reconcile durable tombstones first to prevent stale-device resurrection
      await this.reconcileTombstones(userId);

      // Phase 1: Non-destructive initial merge (Reconcile local + remote)
      await this.reconcileProfile(userId, localState.profile);
      await this.reconcileTasks(userId, localState.tasks);
      await this.reconcileJournal(userId, localState.journal);
      await this.reconcileDreams(userId, localState.dreams);
      await this.reconcileLetters(userId, localState.letters);
      await this.reconcileEvents(userId, localState.events);

      // Phase 1B: Reconcile lightweight metadata for memories, folders, files
      if (localState.memories && localState.memories.length > 0) {
        await this.reconcileMemories(userId, localState.memories);
      }
      if (localState.folders && localState.folders.length > 0) {
        await this.reconcileFolders(userId, localState.folders);
      }
      if (localState.files && localState.files.length > 0) {
        await this.reconcileFiles(userId, localState.files);
      }

      // Phase 2: Attach realtime snapshot listeners
      this.attachRealtimeListeners(userId);

      // Reset retry count on successful sync
      this.retryCount = 0;

      this.updateSyncState({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        errorMessage: null,
        errorReason: null,
        retryAttempt: 0,
        nextRetryMs: null,
      });
    } catch (err: any) {
      console.warn('[Firestore Sync] Sync issue encountered:', err);

      const isNetwork =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err?.code === 'unavailable' ||
        err?.code === 'deadline-exceeded' ||
        err?.message?.includes('offline') ||
        err?.message?.includes('network') ||
        err?.message?.includes('Failed to fetch');

      const isQuota =
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('quota') ||
        err?.message?.includes('RESOURCE_EXHAUSTED') ||
        err?.message?.includes('429');

      const isAuth =
        err?.code === 'permission-denied' ||
        err?.code === 'unauthenticated' ||
        err?.message?.includes('permission') ||
        err?.message?.includes('unauthorized');

      const errorReason: 'network' | 'quota' | 'auth' | 'general' = isNetwork
        ? 'network'
        : isQuota
        ? 'quota'
        : isAuth
        ? 'auth'
        : 'general';

      let friendlyMessage = 'Sync encountered a temporary issue.';
      if (isNetwork) {
        friendlyMessage = 'Network connection offline. Changes saved locally; will sync when reconnected.';
      } else if (isQuota) {
        friendlyMessage = 'Firestore database quota limit reached. Sync paused; will automatically retry.';
      } else if (isAuth) {
        friendlyMessage = 'Cloud access permissions or session expired. Please sign in again.';
      } else if (err?.message) {
        friendlyMessage = err.message;
      }

      // Exponential backoff for retryable errors (network, quota, transient errors)
      const isRetryable = isNetwork || isQuota || (!isAuth && this.retryCount < 5);
      let nextRetryMs: number | null = null;

      if (isRetryable && this.lastLocalState) {
        const delay = Math.min(2000 * Math.pow(2, this.retryCount), 60000) + Math.random() * 500;
        this.retryCount++;
        nextRetryMs = Date.now() + delay;

        this.retryTimer = setTimeout(() => {
          if (this.lastLocalState && this.currentUserId) {
            this.startSync(this.lastLocalState.userId, this.lastLocalState.localState, true);
          }
        }, delay);
      }

      this.updateSyncState({
        status: isNetwork ? 'offline' : 'error',
        errorMessage: friendlyMessage,
        errorReason,
        retryAttempt: this.retryCount,
        nextRetryMs,
      });
    } finally {
      this.isSyncInProgress = false;
    }
  }

  /**
   * Stop listeners upon sign out.
   * NOTE: Never alters or wipes local state or storage.
   */
  public stopSync(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryCount = 0;
    this.lastLocalState = null;
    this.isSyncInProgress = false;

    this.stopListenersOnly();
    this.currentUserId = null;
    this.tombstones.clear();
    this.updateSyncState({
      status: 'idle',
      errorMessage: null,
      errorReason: null,
      retryAttempt: 0,
      nextRetryMs: null,
    });
  }

  // ================= RECONCILIATION METHODS =================

  /**
   * Reconcile User Profile:
   * Merges remote profile fields without discarding local values
   */
  private async reconcileProfile(userId: string, localProfile: UserProfile): Promise<void> {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const remoteData = snap.data() as Partial<UserProfile> & { updatedAt?: string };
      const merged: UserProfile = {
        ...localProfile,
        ...remoteData,
        // Preserve defined local settings if remote is empty
        name: remoteData.name || localProfile.name,
        subtitle: remoteData.subtitle || localProfile.subtitle,
        currentMood: remoteData.currentMood || localProfile.currentMood,
        lowEnergyMode: remoteData.lowEnergyMode ?? localProfile.lowEnergyMode,
        journalAwareAI: remoteData.journalAwareAI ?? localProfile.journalAwareAI,
      };

      this.isApplyingRemoteUpdate = true;
      if (this.listeners.onProfileUpdated) {
        this.listeners.onProfileUpdated(merged);
      }
      this.isApplyingRemoteUpdate = false;

      // Only write to cloud if merged values differ from remote data to prevent redundant writes
      const hasChanges =
        remoteData.name !== merged.name ||
        remoteData.subtitle !== merged.subtitle ||
        remoteData.currentMood !== merged.currentMood ||
        remoteData.lowEnergyMode !== merged.lowEnergyMode ||
        remoteData.avatarSeed !== merged.avatarSeed ||
        remoteData.journalAwareAI !== merged.journalAwareAI;

      if (hasChanges) {
        await setDoc(userDocRef, { ...merged, uid: userId, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } else {
      // Remote does not exist yet: Seed remote with current local profile
      await setDoc(userDocRef, {
        uid: userId,
        name: localProfile.name,
        subtitle: localProfile.subtitle,
        currentMood: localProfile.currentMood,
        lowEnergyMode: localProfile.lowEnergyMode,
        avatarSeed: localProfile.avatarSeed,
        journalAwareAI: localProfile.journalAwareAI ?? false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
  }

  /**
   * Reconcile Tasks:
   * Preserves all items. If ID exists in both, picks newer or merges.
   */
  private async reconcileTasks(userId: string, localTasks: Task[]): Promise<void> {
    const tasksCol = collection(db, 'users', userId, 'tasks');
    const snap = await getDocs(tasksCol);
    const remoteMap = new Map<string, Task>();

    snap.forEach((d) => {
      const data = d.data() as Task;
      remoteMap.set(data.id || d.id, { ...data, id: data.id || d.id });
    });

    const mergedMap = new Map<string, Task>();

    // Add all remote items
    remoteMap.forEach((remoteItem, id) => {
      mergedMap.set(id, remoteItem);
    });

    // Merge or upload local items
    for (const localItem of localTasks) {
      const remoteItem = mergedMap.get(localItem.id);
      if (!remoteItem) {
        // Exists locally only -> Upload to Firestore
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(tasksCol, localItem.id), {
          ...localItem,
          updatedAt: (localItem as any).updatedAt || localItem.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        // Exists in both -> Conflict resolution by timestamp
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(tasksCol, localItem.id), {
            ...localItem,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onTasksUpdated) {
      this.listeners.onTasksUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Journal Entries:
   * Non-destructive union. Preserves reflections written locally or on other devices.
   */
  private async reconcileJournal(userId: string, localEntries: JournalEntry[]): Promise<void> {
    const journalCol = collection(db, 'users', userId, 'journal');
    const snap = await getDocs(journalCol);
    const remoteMap = new Map<string, JournalEntry>();

    snap.forEach((d) => {
      const data = d.data() as JournalEntry;
      remoteMap.set(data.id || d.id, { ...data, id: data.id || d.id });
    });

    const mergedMap = new Map<string, JournalEntry>();

    remoteMap.forEach((item, id) => {
      mergedMap.set(id, item);
    });

    for (const localItem of localEntries) {
      const remoteItem = mergedMap.get(localItem.id);
      if (!remoteItem) {
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(journalCol, localItem.id), {
          ...localItem,
          updatedAt: (localItem as any).updatedAt || localItem.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(journalCol, localItem.id), {
            ...localItem,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onJournalUpdated) {
      this.listeners.onJournalUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Dreams
   */
  private async reconcileDreams(userId: string, localDreams: Dream[]): Promise<void> {
    const dreamsCol = collection(db, 'users', userId, 'dreams');
    const snap = await getDocs(dreamsCol);
    const remoteMap = new Map<string, Dream>();

    snap.forEach((d) => {
      const data = d.data() as Dream;
      remoteMap.set(data.id || d.id, { ...data, id: data.id || d.id });
    });

    const mergedMap = new Map<string, Dream>();
    remoteMap.forEach((item, id) => mergedMap.set(id, item));

    for (const localItem of localDreams) {
      const remoteItem = mergedMap.get(localItem.id);
      if (!remoteItem) {
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(dreamsCol, localItem.id), {
          ...localItem,
          updatedAt: (localItem as any).updatedAt || localItem.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(dreamsCol, localItem.id), {
            ...localItem,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onDreamsUpdated) {
      this.listeners.onDreamsUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Future Letters
   */
  private async reconcileLetters(userId: string, localLetters: FutureLetter[]): Promise<void> {
    const lettersCol = collection(db, 'users', userId, 'letters');
    const snap = await getDocs(lettersCol);
    const remoteMap = new Map<string, FutureLetter>();

    snap.forEach((d) => {
      const data = d.data() as FutureLetter;
      remoteMap.set(data.id || d.id, { ...data, id: data.id || d.id });
    });

    const mergedMap = new Map<string, FutureLetter>();
    remoteMap.forEach((item, id) => mergedMap.set(id, item));

    for (const localItem of localLetters) {
      const remoteItem = mergedMap.get(localItem.id);
      if (!remoteItem) {
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(lettersCol, localItem.id), {
          ...localItem,
          updatedAt: (localItem as any).updatedAt || localItem.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(lettersCol, localItem.id), {
            ...localItem,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onLettersUpdated) {
      this.listeners.onLettersUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Calendar Events:
   * Durable deletion protection: ignores and cleans up remote events that have local tombstones.
   * Compares timestamps for events present in both. Preserves existing IDs.
   */
  private async reconcileEvents(userId: string, localEvents: CalendarEvent[]): Promise<void> {
    const eventsCol = collection(db, 'users', userId, 'events');
    const snap = await getDocs(eventsCol);
    const remoteMap = new Map<string, CalendarEvent>();
    const deletePromises: Promise<void>[] = [];

    snap.forEach((d) => {
      const data = d.data() as CalendarEvent;
      const id = data.id || d.id;

      // Durable tombstone check: if user deleted this event, do NOT resurrect it!
      if (this.isTombstoned(id)) {
        deletePromises.push(
          deleteDoc(doc(eventsCol, id)).catch((err) =>
            console.warn('[Firestore Sync] Cloud tombstone cleanup warning:', err)
          )
        );
        return;
      }

      remoteMap.set(id, { ...data, id });
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }

    const mergedMap = new Map<string, CalendarEvent>();
    remoteMap.forEach((item, id) => mergedMap.set(id, item));

    for (const localItem of localEvents) {
      // If event was deleted locally or tombstoned remotely, do not resurrect
      if (this.isTombstoned(localItem.id)) {
        continue;
      }

      const remoteItem = mergedMap.get(localItem.id);
      if (!remoteItem) {
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(eventsCol, localItem.id), {
          ...localItem,
          updatedAt: (localItem as any).updatedAt || localItem.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(eventsCol, localItem.id), {
            ...localItem,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onEventsUpdated) {
      this.listeners.onEventsUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Memories Metadata
   * STRICT SAFEGUARD: imageSrc (Base64 / Blob) is NEVER written to Firestore.
   * Only lightweight metadata (id, title, caption, date, location, category, driveFileId, timestamps) is synced.
   */
  private async reconcileMemories(userId: string, localMemories: Memory[]): Promise<void> {
    const memoriesCol = collection(db, 'users', userId, 'memories');
    const snap = await getDocs(memoriesCol);
    const remoteMap = new Map<string, Memory>();

    snap.forEach((d) => {
      const data = d.data() as Partial<Memory>;
      const id = data.id || d.id;
      // Skip tombstoned memories
      if (this.isTombstoned(id)) return;

      remoteMap.set(id, {
        id,
        title: data.title || '',
        caption: data.caption || '',
        date: data.date || '',
        location: data.location || '',
        category: data.category || 'General',
        aspect: data.aspect || 'square',
        imageSrc: '', // Placeholder: binary remains in IndexedDB or Drive
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        driveFileId: data.driveFileId,
        driveSyncedAt: data.driveSyncedAt,
        driveStatus: data.driveStatus,
      });
    });

    const mergedMap = new Map<string, Memory>();
    remoteMap.forEach((item, id) => mergedMap.set(id, item));

    for (const localItem of localMemories) {
      // If memory was deleted/tombstoned, never resurrect metadata
      if (this.isTombstoned(localItem.id)) {
        continue;
      }

      const remoteItem = mergedMap.get(localItem.id);
      // Strictly exclude imageSrc from Firestore payload
      const { imageSrc, ...metadataOnly } = localItem;

      if (!remoteItem) {
        // Exists locally only -> Upload metadata to Firestore
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(memoriesCol, localItem.id), {
          ...metadataOnly,
          updatedAt: metadataOnly.updatedAt || metadataOnly.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          // Local metadata is newer -> update Firestore
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(memoriesCol, localItem.id), {
            ...metadataOnly,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } else {
          // Remote metadata is newer -> merge remote fields while PRESERVING local binary imageSrc
          mergedMap.set(localItem.id, {
            ...remoteItem,
            imageSrc: localItem.imageSrc || remoteItem.imageSrc,
          });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onMemoriesMetaUpdated) {
      this.listeners.onMemoriesMetaUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Folders
   */
  private async reconcileFolders(userId: string, localFolders: FolderItem[]): Promise<void> {
    const foldersCol = collection(db, 'users', userId, 'folders');
    const snap = await getDocs(foldersCol);
    const remoteMap = new Map<string, FolderItem>();

    snap.forEach((d) => {
      const data = d.data() as FolderItem;
      const id = data.id || d.id;
      // Skip tombstoned folders
      if (this.isTombstoned(id)) return;

      remoteMap.set(id, { ...data, id });
    });

    const mergedMap = new Map<string, FolderItem>();
    remoteMap.forEach((item, id) => mergedMap.set(id, item));

    for (const localItem of localFolders) {
      // If folder is tombstoned, never recreate on Firestore
      if (this.isTombstoned(localItem.id)) {
        continue;
      }

      const remoteItem = mergedMap.get(localItem.id);
      if (!remoteItem) {
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(foldersCol, localItem.id), {
          ...localItem,
          updatedAt: localItem.updatedAt || localItem.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(foldersCol, localItem.id), {
            ...localItem,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onFoldersUpdated) {
      this.listeners.onFoldersUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  /**
   * Reconcile Files Metadata
   * STRICT SAFEGUARD: dataUrl / binary payload is NEVER written to Firestore.
   * Only lightweight metadata (id, name, folderId, size, mimeType, extension, driveFileId, timestamps) is synced.
   */
  private async reconcileFiles(userId: string, localFiles: FileItem[]): Promise<void> {
    const filesCol = collection(db, 'users', userId, 'files');
    const snap = await getDocs(filesCol);
    const remoteMap = new Map<string, FileItem>();

    snap.forEach((d) => {
      const data = d.data() as Partial<FileItem>;
      const id = data.id || d.id;
      // Skip tombstoned files or files in tombstoned folders
      if (this.isTombstoned(id) || (data.folderId && this.isFolderTombstoned(data.folderId))) {
        return;
      }

      remoteMap.set(id, {
        id,
        name: data.name || 'Untitled',
        folderId: data.folderId || 'folder-documents',
        size: data.size || 0,
        mimeType: data.mimeType || 'application/octet-stream',
        extension: data.extension || 'bin',
        dataUrl: undefined, // Binary remains in IndexedDB or Drive
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        driveFileId: data.driveFileId,
        driveSyncedAt: data.driveSyncedAt,
        driveStatus: data.driveStatus,
      });
    });

    const mergedMap = new Map<string, FileItem>();
    remoteMap.forEach((item, id) => mergedMap.set(id, item));

    for (const localItem of localFiles) {
      // If file or its folder was deleted, never resurrect
      if (this.isTombstoned(localItem.id) || (localItem.folderId && this.isFolderTombstoned(localItem.folderId))) {
        continue;
      }

      const remoteItem = mergedMap.get(localItem.id);
      // Strictly exclude dataUrl / binary from Firestore write
      const { dataUrl, ...metadataOnly } = localItem;

      if (!remoteItem) {
        mergedMap.set(localItem.id, localItem);
        await setDoc(doc(filesCol, localItem.id), {
          ...metadataOnly,
          updatedAt: metadataOnly.updatedAt || metadataOnly.createdAt || new Date().toISOString(),
        }, { merge: true });
      } else {
        if (this.isNewer(localItem, remoteItem)) {
          mergedMap.set(localItem.id, localItem);
          await setDoc(doc(filesCol, localItem.id), {
            ...metadataOnly,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } else {
          // Remote metadata wins, PRESERVING local binary dataUrl if present
          mergedMap.set(localItem.id, {
            ...remoteItem,
            dataUrl: localItem.dataUrl,
          });
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    this.isApplyingRemoteUpdate = true;
    if (this.listeners.onFilesMetaUpdated) {
      this.listeners.onFilesMetaUpdated(mergedList);
    }
    this.isApplyingRemoteUpdate = false;
  }

  // ================= REALTIME SNAPSHOT LISTENERS =================

  private handleListenerError(name: string, err: any): void {
    console.warn(`[Firestore Sync] ${name} listener issue:`, err);
    const isNetwork =
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      err?.code === 'unavailable' ||
      err?.message?.includes('offline') ||
      err?.message?.includes('network');

    const isQuota =
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('quota') ||
      err?.message?.includes('RESOURCE_EXHAUSTED') ||
      err?.message?.includes('429');

    const isAuth =
      err?.code === 'permission-denied' ||
      err?.code === 'unauthenticated';

    const errorReason: 'network' | 'quota' | 'auth' | 'general' = isNetwork
      ? 'network'
      : isQuota
      ? 'quota'
      : isAuth
      ? 'auth'
      : 'general';

    const errorMessage = isQuota
      ? 'Firestore database quota limit reached. Realtime updates paused.'
      : isAuth
      ? 'Cloud access permissions or session expired. Please sign in again.'
      : isNetwork
      ? 'Network connection offline. Realtime updates paused.'
      : (err?.message || 'Realtime sync connection interrupted.');

    this.updateSyncState({
      status: isNetwork ? 'offline' : 'error',
      errorMessage,
      errorReason,
    });
  }

  /**
   * Attach realtime listeners to receive updates made on other tabs or devices
   */
  private attachRealtimeListeners(userId: string): void {
    // 1. User Profile listener
    const userDocRef = doc(db, 'users', userId);
    const unsubProfile = onSnapshot(
      userDocRef,
      { includeMetadataChanges: true },
      (snap) => {
        // Skip local uncommitted writes to prevent loops
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        if (snap.exists() && this.listeners.onProfileUpdated) {
          const data = snap.data() as Partial<UserProfile>;
          this.isApplyingRemoteUpdate = true;
          this.listeners.onProfileUpdated(data as UserProfile);
          this.isApplyingRemoteUpdate = false;
        }
      },
      (err) => this.handleListenerError('Profile', err)
    );
    this.activeUnsubscribers.push(unsubProfile);

    // 2. Tasks listener
    const tasksCol = collection(db, 'users', userId, 'tasks');
    const unsubTasks = onSnapshot(
      tasksCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const tasks: Task[] = [];
        snap.forEach((d) => tasks.push(d.data() as Task));
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onTasksUpdated) {
          this.listeners.onTasksUpdated(tasks);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Tasks', err)
    );
    this.activeUnsubscribers.push(unsubTasks);

    // 3. Journal listener
    const journalCol = collection(db, 'users', userId, 'journal');
    const unsubJournal = onSnapshot(
      journalCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const entries: JournalEntry[] = [];
        snap.forEach((d) => entries.push(d.data() as JournalEntry));
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onJournalUpdated) {
          this.listeners.onJournalUpdated(entries);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Journal', err)
    );
    this.activeUnsubscribers.push(unsubJournal);

    // 4. Dreams listener
    const dreamsCol = collection(db, 'users', userId, 'dreams');
    const unsubDreams = onSnapshot(
      dreamsCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const dreams: Dream[] = [];
        snap.forEach((d) => dreams.push(d.data() as Dream));
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onDreamsUpdated) {
          this.listeners.onDreamsUpdated(dreams);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Dreams', err)
    );
    this.activeUnsubscribers.push(unsubDreams);

    // 5. Future Letters listener
    const lettersCol = collection(db, 'users', userId, 'letters');
    const unsubLetters = onSnapshot(
      lettersCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const letters: FutureLetter[] = [];
        snap.forEach((d) => letters.push(d.data() as FutureLetter));
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onLettersUpdated) {
          this.listeners.onLettersUpdated(letters);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Letters', err)
    );
    this.activeUnsubscribers.push(unsubLetters);

    // 6. Events listener
    const eventsCol = collection(db, 'users', userId, 'events');
    const unsubEvents = onSnapshot(
      eventsCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const events: CalendarEvent[] = [];
        snap.forEach((d) => {
          const item = d.data() as CalendarEvent;
          const id = item.id || d.id;
          // Filter out tombstones to prevent resurrecting deleted events from stale snapshots
          if (!this.isTombstoned(id)) {
            events.push({ ...item, id });
          }
        });
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onEventsUpdated) {
          this.listeners.onEventsUpdated(events);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Events', err)
    );
    this.activeUnsubscribers.push(unsubEvents);

    // 7. Memories metadata listener (Metadata only; binary stays in IndexedDB/Drive)
    const memoriesCol = collection(db, 'users', userId, 'memories');
    const unsubMemories = onSnapshot(
      memoriesCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const memories: Memory[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<Memory>;
          const id = data.id || d.id;
          if (this.isTombstoned(id)) return;
          memories.push({
            id,
            title: data.title || '',
            caption: data.caption || '',
            date: data.date || '',
            location: data.location || '',
            category: data.category || 'General',
            aspect: data.aspect || 'square',
            imageSrc: '', // Binary is loaded locally or on-demand
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            driveFileId: data.driveFileId,
            driveSyncedAt: data.driveSyncedAt,
            driveStatus: data.driveStatus,
          });
        });
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onMemoriesMetaUpdated) {
          this.listeners.onMemoriesMetaUpdated(memories);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Memories', err)
    );
    this.activeUnsubscribers.push(unsubMemories);

    // 8. Folders listener
    const foldersCol = collection(db, 'users', userId, 'folders');
    const unsubFolders = onSnapshot(
      foldersCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const folders: FolderItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as FolderItem;
          const id = data.id || d.id;
          if (this.isTombstoned(id)) return;
          folders.push({ ...data, id });
        });
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onFoldersUpdated) {
          this.listeners.onFoldersUpdated(folders);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Folders', err)
    );
    this.activeUnsubscribers.push(unsubFolders);

    // 9. Files metadata listener (Metadata only; binary stays in IndexedDB/Drive)
    const filesCol = collection(db, 'users', userId, 'files');
    const unsubFiles = onSnapshot(
      filesCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites || this.isApplyingRemoteUpdate) return;
        const files: FileItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as Partial<FileItem>;
          const id = data.id || d.id;
          if (this.isTombstoned(id) || (data.folderId && this.isFolderTombstoned(data.folderId))) {
            return;
          }
          files.push({
            id,
            name: data.name || 'Untitled',
            folderId: data.folderId || 'folder-documents',
            size: data.size || 0,
            mimeType: data.mimeType || 'application/octet-stream',
            extension: data.extension || 'bin',
            dataUrl: undefined, // Binary remains in IndexedDB or Drive
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            driveFileId: data.driveFileId,
            driveSyncedAt: data.driveSyncedAt,
            driveStatus: data.driveStatus,
          });
        });
        this.isApplyingRemoteUpdate = true;
        if (this.listeners.onFilesMetaUpdated) {
          this.listeners.onFilesMetaUpdated(files);
        }
        this.isApplyingRemoteUpdate = false;
      },
      (err) => this.handleListenerError('Files', err)
    );
    this.activeUnsubscribers.push(unsubFiles);

    // 10. Realtime Tombstones listener across multi-devices
    const tombstonesCol = collection(db, 'users', userId, 'tombstones');
    const unsubTombstones = onSnapshot(
      tombstonesCol,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.hasPendingWrites) return;
        let changed = false;
        snap.forEach((d) => {
          const data = d.data() as TombstoneRecord;
          const id = data.id || d.id;
          if (!this.tombstones.has(id)) {
            this.tombstones.set(id, { ...data, id });
            changed = true;
          }
        });
        if (changed && this.currentUserId) {
          this.saveTombstones(this.currentUserId);
        }
      },
      (err) => this.handleListenerError('Tombstones', err)
    );
    this.activeUnsubscribers.push(unsubTombstones);
  }

  // ================= MUTATION SYNC DISPATCHERS =================

  public async syncProfileUpdate(updates: Partial<UserProfile>): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const userRef = doc(db, 'users', this.currentUserId);
      await setDoc(userRef, {
        ...updates,
        uid: this.currentUserId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push profile update:', e);
    }
  }

  public async syncTaskUpsert(task: Task): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const taskRef = doc(db, 'users', this.currentUserId, 'tasks', task.id);
      await setDoc(taskRef, {
        ...task,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push task upsert:', e);
    }
  }

  public async syncTaskDelete(taskId: string): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const taskRef = doc(db, 'users', this.currentUserId, 'tasks', taskId);
      await deleteDoc(taskRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push task delete:', e);
    }
  }

  public async syncJournalUpsert(entry: JournalEntry): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const entryRef = doc(db, 'users', this.currentUserId, 'journal', entry.id);
      await setDoc(entryRef, {
        ...entry,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push journal upsert:', e);
    }
  }

  public async syncJournalDelete(entryId: string): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const entryRef = doc(db, 'users', this.currentUserId, 'journal', entryId);
      await deleteDoc(entryRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push journal delete:', e);
    }
  }

  public async syncDreamUpsert(dream: Dream): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const dreamRef = doc(db, 'users', this.currentUserId, 'dreams', dream.id);
      await setDoc(dreamRef, {
        ...dream,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push dream upsert:', e);
    }
  }

  public async syncDreamDelete(dreamId: string): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const dreamRef = doc(db, 'users', this.currentUserId, 'dreams', dreamId);
      await deleteDoc(dreamRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push dream delete:', e);
    }
  }

  public async syncLetterUpsert(letter: FutureLetter): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const letterRef = doc(db, 'users', this.currentUserId, 'letters', letter.id);
      await setDoc(letterRef, {
        ...letter,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push letter upsert:', e);
    }
  }

  public async syncLetterDelete(letterId: string): Promise<void> {
    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const letterRef = doc(db, 'users', this.currentUserId, 'letters', letterId);
      await deleteDoc(letterRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push letter delete:', e);
    }
  }

  public async syncEventUpsert(event: CalendarEvent): Promise<void> {
    const existingTombstone = this.tombstones.get(event.id);
    if (existingTombstone) {
      const eventTime = new Date(event.updatedAt || event.createdAt || 0).getTime();
      // If the event update is older than or equal to the deletion, ignore it (deletion wins)
      if (eventTime <= existingTombstone.deletedAtMs) {
        return;
      }
      this.tombstones.delete(event.id);
      if (this.currentUserId) {
        this.saveTombstones(this.currentUserId);
        deleteDoc(doc(db, 'users', this.currentUserId, 'tombstones', event.id)).catch(console.warn);
      }
    }

    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const eventRef = doc(db, 'users', this.currentUserId, 'events', event.id);
      await setDoc(eventRef, {
        ...event,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push event upsert:', e);
    }
  }

  public async syncEventDelete(eventId: string): Promise<void> {
    if (!this.currentUserId) return;
    // 1. Record durable tombstone immediately to prevent resurrection
    const tombstone: TombstoneRecord = {
      id: eventId,
      itemType: 'event',
      deletedAt: new Date().toISOString(),
      deletedAtMs: Date.now(),
      uid: this.currentUserId,
    };
    this.recordTombstone(tombstone);

    try {
      const tombstoneRef = doc(db, 'users', this.currentUserId, 'tombstones', eventId);
      await setDoc(tombstoneRef, tombstone, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push event tombstone:', e);
    }

    try {
      const eventRef = doc(db, 'users', this.currentUserId, 'events', eventId);
      await deleteDoc(eventRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push event delete:', e);
    }
  }

  /**
   * Sync Memory Metadata Upsert
   * STRICT SAFEGUARD: imageSrc (Base64 / binary) is NEVER sent to Firestore.
   */
  public async syncMemoryMetaUpsert(memory: Memory): Promise<void> {
    const existingTombstone = this.tombstones.get(memory.id);
    if (existingTombstone) {
      const memTime = new Date(memory.updatedAt || memory.createdAt || 0).getTime();
      if (memTime <= existingTombstone.deletedAtMs) {
        return;
      }
      this.tombstones.delete(memory.id);
      if (this.currentUserId) {
        this.saveTombstones(this.currentUserId);
        deleteDoc(doc(db, 'users', this.currentUserId, 'tombstones', memory.id)).catch(console.warn);
      }
    }

    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const { imageSrc, ...metadataOnly } = memory;
      const memoryRef = doc(db, 'users', this.currentUserId, 'memories', memory.id);
      await setDoc(memoryRef, {
        ...metadataOnly,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push memory metadata upsert:', e);
    }
  }

  public async syncMemoryDelete(memoryId: string): Promise<void> {
    if (!this.currentUserId) return;
    const tombstone: TombstoneRecord = {
      id: memoryId,
      itemType: 'memory',
      deletedAt: new Date().toISOString(),
      deletedAtMs: Date.now(),
      uid: this.currentUserId,
    };
    this.recordTombstone(tombstone);

    try {
      const tombstoneRef = doc(db, 'users', this.currentUserId, 'tombstones', memoryId);
      await setDoc(tombstoneRef, tombstone, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push memory tombstone:', e);
    }

    try {
      const memoryRef = doc(db, 'users', this.currentUserId, 'memories', memoryId);
      await deleteDoc(memoryRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push memory delete:', e);
    }
  }

  /**
   * Sync Folder Upsert
   */
  public async syncFolderUpsert(folder: FolderItem): Promise<void> {
    const existingTombstone = this.tombstones.get(folder.id);
    if (existingTombstone) {
      const folderTime = new Date(folder.updatedAt || folder.createdAt || 0).getTime();
      if (folderTime <= existingTombstone.deletedAtMs) {
        return;
      }
      this.tombstones.delete(folder.id);
      if (this.currentUserId) {
        this.saveTombstones(this.currentUserId);
        deleteDoc(doc(db, 'users', this.currentUserId, 'tombstones', folder.id)).catch(console.warn);
      }
    }

    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const folderRef = doc(db, 'users', this.currentUserId, 'folders', folder.id);
      await setDoc(folderRef, {
        ...folder,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push folder upsert:', e);
    }
  }

  public async syncFolderDelete(
    folderId: string,
    childFolderIds: string[] = [],
    childFileIds: string[] = []
  ): Promise<void> {
    if (!this.currentUserId) return;
    const now = Date.now();
    const nowIso = new Date().toISOString();

    const allFolderIds = Array.from(new Set([folderId, ...childFolderIds]));
    for (const fId of allFolderIds) {
      const fTombstone: TombstoneRecord = {
        id: fId,
        itemType: 'folder',
        deletedAt: nowIso,
        deletedAtMs: now,
        uid: this.currentUserId,
      };
      this.recordTombstone(fTombstone);
      setDoc(doc(db, 'users', this.currentUserId, 'tombstones', fId), fTombstone, { merge: true }).catch(console.warn);
      deleteDoc(doc(db, 'users', this.currentUserId, 'folders', fId)).catch(console.warn);
    }

    for (const fileId of childFileIds) {
      const fileTombstone: TombstoneRecord = {
        id: fileId,
        itemType: 'file',
        deletedAt: nowIso,
        deletedAtMs: now,
        uid: this.currentUserId,
        parentFolderId: folderId,
      };
      this.recordTombstone(fileTombstone);
      setDoc(doc(db, 'users', this.currentUserId, 'tombstones', fileId), fileTombstone, { merge: true }).catch(console.warn);
      deleteDoc(doc(db, 'users', this.currentUserId, 'files', fileId)).catch(console.warn);
    }
  }

  /**
   * Sync File Metadata Upsert
   * STRICT SAFEGUARD: dataUrl (Base64 / binary) is NEVER sent to Firestore.
   */
  public async syncFileMetaUpsert(file: FileItem): Promise<void> {
    const existingTombstone = this.tombstones.get(file.id);
    if (existingTombstone) {
      const fileTime = new Date(file.updatedAt || file.createdAt || 0).getTime();
      if (fileTime <= existingTombstone.deletedAtMs) {
        return;
      }
      this.tombstones.delete(file.id);
      if (this.currentUserId) {
        this.saveTombstones(this.currentUserId);
        deleteDoc(doc(db, 'users', this.currentUserId, 'tombstones', file.id)).catch(console.warn);
      }
    }

    // If file's parent folder is tombstoned, do not resurrect
    if (file.folderId && this.isFolderTombstoned(file.folderId)) {
      return;
    }

    if (!this.currentUserId || this.isApplyingRemoteUpdate) return;
    try {
      const { dataUrl, ...metadataOnly } = file;
      const fileRef = doc(db, 'users', this.currentUserId, 'files', file.id);
      await setDoc(fileRef, {
        ...metadataOnly,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push file metadata upsert:', e);
    }
  }

  public async syncFileDelete(fileId: string, parentFolderId?: string): Promise<void> {
    if (!this.currentUserId) return;
    const tombstone: TombstoneRecord = {
      id: fileId,
      itemType: 'file',
      deletedAt: new Date().toISOString(),
      deletedAtMs: Date.now(),
      uid: this.currentUserId,
      parentFolderId,
    };
    this.recordTombstone(tombstone);

    try {
      const tombstoneRef = doc(db, 'users', this.currentUserId, 'tombstones', fileId);
      await setDoc(tombstoneRef, tombstone, { merge: true });
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push file tombstone:', e);
    }

    try {
      const fileRef = doc(db, 'users', this.currentUserId, 'files', fileId);
      await deleteDoc(fileRef);
    } catch (e) {
      console.warn('[Firestore Sync] Failed to push file delete:', e);
    }
  }
}

export const syncService = new FirestoreSyncService();
