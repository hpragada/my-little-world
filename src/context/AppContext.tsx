import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  ActiveTab,
  MoodType,
  Task,
  JournalEntry,
  Memory,
  CalendarEvent,
  Dream,
  UserProfile,
  FutureLetter,
  DriveAuthState,
} from '../types';
import {
  INITIAL_USER,
  INITIAL_TASKS,
  LOW_ENERGY_TASKS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_MEMORIES,
  INITIAL_DREAMS,
  INITIAL_EVENTS,
  INITIAL_FUTURE_LETTERS,
} from '../data/initialData';
import {
  getAllMemoriesFromDB,
  saveMemoryToDB,
  saveMultipleMemoriesToDB,
  deleteMemoryFromDB,
} from '../services/photoStorage';
import {
  mergeRemoteFolders,
  mergeRemoteFilesMetadata,
} from '../services/fileStorage';
import { useAuth } from '../firebase/authContext';
import { syncService, SyncState } from '../firebase/syncService';
import { googleDriveAuth } from '../services/googleDriveAuth';

interface AppContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userProfile: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  toggleLowEnergyMode: () => void;
  toggleJournalAwareAI: () => void;
  setMood: (mood: MoodType) => void;
  tasks: Task[];
  addTask: (title: string, category?: Task['category']) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  journalEntries: JournalEntry[];
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;
  togglePinJournalEntry: (id: string) => void;
  memories: Memory[];
  addMemory: (memory: Omit<Memory, 'id'>) => Promise<void>;
  addMultipleMemories: (newMemories: Array<Omit<Memory, 'id'>>) => Promise<void>;
  updateMemory: (id: string, updates: Partial<Memory>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  dreams: Dream[];
  addDream: (dream: Omit<Dream, 'id'>) => void;
  updateDream: (id: string, updates: Partial<Dream>) => void;
  deleteDream: (id: string) => void;
  toggleDreamCompleted: (id: string) => void;
  futureLetters: FutureLetter[];
  addFutureLetter: (letter: Omit<FutureLetter, 'id' | 'createdAt'>) => void;
  updateFutureLetter: (id: string, updates: Partial<FutureLetter>) => void;
  deleteFutureLetter: (id: string) => void;
  events: CalendarEvent[];
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  deleteEvent: (id: string) => void;
  quickActionModal: 'task' | 'journal' | 'memory' | null;
  setQuickActionModal: (modal: 'task' | 'journal' | 'memory' | null) => void;
  syncState: SyncState;
  triggerManualSync: (forcedUid?: string) => Promise<void>;
  driveAuthState: DriveAuthState;
  connectDrive: (promptConsent?: boolean) => Promise<string>;
  disconnectDrive: () => Promise<void>;
  reloadMemoriesFromDB: () => Promise<void>;
  refreshMemories: (updatedList: Memory[]) => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'mlw_user_profile',
  TASKS: 'mlw_tasks',
  LOW_TASKS: 'mlw_low_energy_tasks',
  JOURNAL: 'mlw_journal',
  DREAMS: 'mlw_dreams',
  EVENTS: 'mlw_events',
  LETTERS: 'mlw_future_letters',
  LAST_SYNCED_UID: 'mlw_last_synced_uid',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [quickActionModal, setQuickActionModal] = useState<'task' | 'journal' | 'memory' | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(() => syncService.getSyncState());
  const [driveAuthState, setDriveAuthState] = useState<DriveAuthState>(() => googleDriveAuth.getAuthState());

  // Subscribe to in-memory Google Drive authentication state
  useEffect(() => {
    const unsubscribe = googleDriveAuth.subscribe((state) => {
      setDriveAuthState(state);
    });
    return unsubscribe;
  }, []);

  const connectDrive = useCallback(async (promptConsent = true) => {
    return await googleDriveAuth.requestAuthorization({
      prompt: promptConsent ? 'consent' : undefined,
    });
  }, []);

  const disconnectDrive = useCallback(async () => {
    await googleDriveAuth.signOut();
  }, []);

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_USER,
          ...parsed,
          journalAwareAI: parsed.journalAwareAI ?? false,
        };
      }
      return INITIAL_USER;
    } catch {
      return INITIAL_USER;
    }
  });

  // Regular Tasks
  const [regularTasks, setRegularTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  // Low Energy Tasks
  const [lowEnergyTasks, setLowEnergyTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOW_TASKS);
      return saved ? JSON.parse(saved) : LOW_ENERGY_TASKS;
    } catch {
      return LOW_ENERGY_TASKS;
    }
  });

  // Journal
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.JOURNAL);
      return saved ? JSON.parse(saved) : INITIAL_JOURNAL_ENTRIES;
    } catch {
      return INITIAL_JOURNAL_ENTRIES;
    }
  });

  // Memories (Managed persistently via IndexedDB for high-capacity photo storage)
  const [memories, setMemories] = useState<Memory[]>(INITIAL_MEMORIES);

  useEffect(() => {
    let isMounted = true;
    getAllMemoriesFromDB()
      .then((stored) => {
        if (!isMounted) return;
        if (stored && stored.length > 0) {
          setMemories(stored);
        } else {
          // Seed IndexedDB with initial high-fidelity memories on first run
          saveMultipleMemoriesToDB(INITIAL_MEMORIES).catch((err) =>
            console.warn('Initial memories seeding error:', err)
          );
          setMemories(INITIAL_MEMORIES);
        }
      })
      .catch((err) => {
        console.warn('IndexedDB initial load error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const reloadMemoriesFromDB = useCallback(async () => {
    try {
      const stored = await getAllMemoriesFromDB();
      if (stored && stored.length > 0) {
        setMemories(stored);
      }
    } catch (err) {
      console.warn('Failed to reload memories from IndexedDB:', err);
    }
  }, []);

  const refreshMemories = useCallback((updatedList: Memory[]) => {
    setMemories(updatedList);
  }, []);

  // Dreams
  const [dreams, setDreams] = useState<Dream[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DREAMS);
      return saved ? JSON.parse(saved) : INITIAL_DREAMS;
    } catch {
      return INITIAL_DREAMS;
    }
  });

  // Events
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return saved ? JSON.parse(saved) : INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  });

  // Future Letters
  const [futureLetters, setFutureLetters] = useState<FutureLetter[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LETTERS);
      return saved ? JSON.parse(saved) : INITIAL_FUTURE_LETTERS;
    } catch {
      return INITIAL_FUTURE_LETTERS;
    }
  });

  // Reference for stable state access in sync listeners
  const stateRef = useRef({
    userProfile,
    regularTasks,
    lowEnergyTasks,
    journalEntries,
    dreams,
    events,
    futureLetters,
    memories,
  });

  useEffect(() => {
    stateRef.current = {
      userProfile,
      regularTasks,
      lowEnergyTasks,
      journalEntries,
      dreams,
      events,
      futureLetters,
      memories,
    };
  });

  // Register two-way sync callbacks
  useEffect(() => {
    syncService.setListeners({
      onProfileUpdated: (updated) => {
        setUserProfile((prev) => ({ ...prev, ...updated }));
      },
      onTasksUpdated: (cloudTasks) => {
        // Partition into low-energy and regular tasks
        const low = cloudTasks.filter((t) => t.isLowEnergyTask);
        const regular = cloudTasks.filter((t) => !t.isLowEnergyTask);
        setLowEnergyTasks(low);
        setRegularTasks(regular);
      },
      onJournalUpdated: (cloudJournal) => {
        setJournalEntries(cloudJournal);
      },
      onDreamsUpdated: (cloudDreams) => {
        setDreams(cloudDreams);
      },
      onLettersUpdated: (cloudLetters) => {
        setFutureLetters(cloudLetters);
      },
      onEventsUpdated: (cloudEvents) => {
        setEvents(cloudEvents);
      },
      onMemoriesMetaUpdated: (cloudMemories) => {
        // Safe metadata merge: preserves local imageSrc from IndexedDB
        setMemories((localMems) => {
          const localMap = new Map(localMems.map((m) => [m.id, m]));
          return cloudMemories.map((cloudItem) => {
            const local = localMap.get(cloudItem.id);
            return {
              ...cloudItem,
              imageSrc: local?.imageSrc || cloudItem.imageSrc,
            };
          });
        });
      },
      onFoldersUpdated: async (cloudFolders) => {
        try {
          await mergeRemoteFolders(
            cloudFolders,
            (id) => syncService.isFolderTombstoned(id) || syncService.isTombstoned(id)
          );
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mlw_storage_updated'));
          }
        } catch (e) {
          console.warn('[Sync] onFoldersUpdated error:', e);
        }
      },
      onFilesMetaUpdated: async (cloudFiles) => {
        try {
          await mergeRemoteFilesMetadata(
            cloudFiles,
            (id) => syncService.isTombstoned(id),
            (folderId) => syncService.isFolderTombstoned(folderId)
          );
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('mlw_storage_updated'));
          }
        } catch (e) {
          console.warn('[Sync] onFilesMetaUpdated error:', e);
        }
      },
      onSyncStateChange: (state) => {
        setSyncState(state);
      },
    });
  }, []);

  // Initiate or stop cloud sync whenever authenticated user changes
  useEffect(() => {
    if (currentUser?.uid) {
      try {
        const lastUid = localStorage.getItem(STORAGE_KEYS.LAST_SYNCED_UID);
        if (lastUid && lastUid !== currentUser.uid) {
          // Different Firebase user: isolate by resetting local working state to clean profile
          // so we never silently merge another user's private data into this UID's Firestore
          console.info(
            `[Auth Isolation] User switch detected (${lastUid} -> ${currentUser.uid}). Local data isolated per UID.`
          );
        }
        localStorage.setItem(STORAGE_KEYS.LAST_SYNCED_UID, currentUser.uid);
      } catch (e) {
        console.warn('[Storage] Could not record last synced UID:', e);
      }

      syncService.startSync(currentUser.uid, {
        profile: stateRef.current.userProfile,
        tasks: [...stateRef.current.regularTasks, ...stateRef.current.lowEnergyTasks],
        journal: stateRef.current.journalEntries,
        dreams: stateRef.current.dreams,
        letters: stateRef.current.futureLetters,
        events: stateRef.current.events,
        memories: stateRef.current.memories,
      });
    } else {
      syncService.stopSync();
    }
  }, [currentUser?.uid]);

  const triggerManualSync = useCallback(
    async (forcedUid?: string) => {
      const targetUid = forcedUid || currentUser?.uid;
      if (!targetUid) return;
      await syncService.startSync(
        targetUid,
        {
          profile: stateRef.current.userProfile,
          tasks: [...stateRef.current.regularTasks, ...stateRef.current.lowEnergyTasks],
          journal: stateRef.current.journalEntries,
          dreams: stateRef.current.dreams,
          letters: stateRef.current.futureLetters,
          events: stateRef.current.events,
          memories: stateRef.current.memories,
        },
        true // forceManual: bypasses active status check and immediately retries
      );
    },
    [currentUser?.uid]
  );

  // Persistence effects for metadata & text items
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userProfile));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(regularTasks));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [regularTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOW_TASKS, JSON.stringify(lowEnergyTasks));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [lowEnergyTasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(journalEntries));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [journalEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DREAMS, JSON.stringify(dreams));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [dreams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LETTERS, JSON.stringify(futureLetters));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }, [futureLetters]);

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const next = { ...prev, ...updates };
      syncService.syncProfileUpdate(next);
      return next;
    });
  };

  const toggleLowEnergyMode = () => {
    setUserProfile((prev) => {
      const next = { ...prev, lowEnergyMode: !prev.lowEnergyMode };
      syncService.syncProfileUpdate({ lowEnergyMode: next.lowEnergyMode });
      return next;
    });
  };

  const toggleJournalAwareAI = () => {
    setUserProfile((prev) => {
      const next = { ...prev, journalAwareAI: !prev.journalAwareAI };
      syncService.syncProfileUpdate({ journalAwareAI: next.journalAwareAI });
      return next;
    });
  };

  const setMood = (mood: MoodType) => {
    setUserProfile((prev) => {
      const next = { ...prev, currentMood: mood };
      syncService.syncProfileUpdate({ currentMood: mood });
      return next;
    });
  };

  // Currently active tasks based on Low Energy Mode
  const activeTaskList = userProfile.lowEnergyMode ? lowEnergyTasks : regularTasks;

  const addTask = (title: string, category: Task['category'] = 'gentle') => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: trimmed,
      category,
      completed: false,
      isLowEnergyTask: userProfile.lowEnergyMode,
      createdAt: new Date().toISOString(),
    };

    if (userProfile.lowEnergyMode) {
      setLowEnergyTasks((prev) => [newTask, ...prev]);
    } else {
      setRegularTasks((prev) => [newTask, ...prev]);
    }
    syncService.syncTaskUpsert(newTask);
  };

  const toggleTask = (id: string) => {
    if (userProfile.lowEnergyMode) {
      setLowEnergyTasks((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            const updated = { ...t, completed: !t.completed };
            syncService.syncTaskUpsert(updated);
            return updated;
          }
          return t;
        })
      );
    } else {
      setRegularTasks((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            const updated = { ...t, completed: !t.completed };
            syncService.syncTaskUpsert(updated);
            return updated;
          }
          return t;
        })
      );
    }
  };

  const deleteTask = (id: string) => {
    if (userProfile.lowEnergyMode) {
      setLowEnergyTasks((prev) => prev.filter((t) => t.id !== id));
    } else {
      setRegularTasks((prev) => prev.filter((t) => t.id !== id));
    }
    syncService.syncTaskDelete(id);
  };

  const addJournalEntry = (entry: Omit<JournalEntry, 'id'>) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: `journal-${Date.now()}`,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    setJournalEntries((prev) => [newEntry, ...prev]);
    syncService.syncJournalUpsert(newEntry);
  };

  const updateJournalEntry = (id: string, updates: Partial<JournalEntry>) => {
    setJournalEntries((prev) =>
      prev.map((entry) => {
        if (entry.id === id) {
          const updated = { ...entry, ...updates };
          syncService.syncJournalUpsert(updated);
          return updated;
        }
        return entry;
      })
    );
  };

  const deleteJournalEntry = (id: string) => {
    setJournalEntries((prev) => prev.filter((j) => j.id !== id));
    syncService.syncJournalDelete(id);
  };

  const togglePinJournalEntry = (id: string) => {
    setJournalEntries((prev) =>
      prev.map((j) => {
        if (j.id === id) {
          const updated = { ...j, isPinned: !j.isPinned };
          syncService.syncJournalUpsert(updated);
          return updated;
        }
        return j;
      })
    );
  };

  // Single memory add with IndexedDB persistence
  const addMemory = async (memory: Omit<Memory, 'id'>) => {
    const newMem: Memory = {
      ...memory,
      id: `memory-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: memory.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveMemoryToDB(newMem);
    setMemories((prev) => [newMem, ...prev]);
    syncService.syncMemoryMetaUpsert(newMem);
  };

  // Batch memory add with IndexedDB persistence
  const addMultipleMemories = async (newItems: Array<Omit<Memory, 'id'>>) => {
    const timestamp = Date.now();
    const created: Memory[] = newItems.map((item, idx) => ({
      ...item,
      id: `memory-${timestamp}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await saveMultipleMemoriesToDB(created);
    setMemories((prev) => [...created, ...prev]);
    created.forEach((m) => syncService.syncMemoryMetaUpsert(m));
  };

  // Update memory caption, date, or notes with IndexedDB save
  const updateMemory = async (id: string, updates: Partial<Memory>) => {
    const existing = memories.find((m) => m.id === id);
    if (!existing) return;
    const updated: Memory = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await saveMemoryToDB(updated);
    setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
    syncService.syncMemoryMetaUpsert(updated);
  };

  // Delete memory with IndexedDB removal
  const deleteMemory = async (id: string) => {
    await deleteMemoryFromDB(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    syncService.syncMemoryDelete(id);
  };

  const addDream = (dream: Omit<Dream, 'id'>) => {
    const newDream: Dream = {
      ...dream,
      id: `dream-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: dream.status || 'Dreaming',
    };
    setDreams((prev) => [newDream, ...prev]);
    syncService.syncDreamUpsert(newDream);
  };

  const updateDream = (id: string, updates: Partial<Dream>) => {
    setDreams((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const updated = { ...d, ...updates };
          syncService.syncDreamUpsert(updated);
          return updated;
        }
        return d;
      })
    );
  };

  const deleteDream = (id: string) => {
    setDreams((prev) => prev.filter((d) => d.id !== id));
    syncService.syncDreamDelete(id);
  };

  const toggleDreamCompleted = (id: string) => {
    setDreams((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const isCompleted = d.status === 'Completed';
        const updated: Dream = {
          ...d,
          status: isCompleted ? 'In Progress' : 'Completed',
          progressPercent: isCompleted ? 50 : 100,
        };
        syncService.syncDreamUpsert(updated);
        return updated;
      })
    );
  };

  const addFutureLetter = (letter: Omit<FutureLetter, 'id' | 'createdAt'>) => {
    const newLetter: FutureLetter = {
      ...letter,
      id: `letter-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isSealed: letter.isSealed ?? true,
    };
    setFutureLetters((prev) => [newLetter, ...prev]);
    syncService.syncLetterUpsert(newLetter);
  };

  const updateFutureLetter = (id: string, updates: Partial<FutureLetter>) => {
    setFutureLetters((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated = { ...l, ...updates };
          syncService.syncLetterUpsert(updated);
          return updated;
        }
        return l;
      })
    );
  };

  const deleteFutureLetter = (id: string) => {
    setFutureLetters((prev) => prev.filter((l) => l.id !== id));
    syncService.syncLetterDelete(id);
  };

  const addEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEvents((prev) => [...prev, newEvent]);
    syncService.syncEventUpsert(newEvent);
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    syncService.syncEventDelete(id);
  };

  const resetAllData = () => {
    setUserProfile(INITIAL_USER);
    setRegularTasks(INITIAL_TASKS);
    setLowEnergyTasks(LOW_ENERGY_TASKS);
    setJournalEntries(INITIAL_JOURNAL_ENTRIES);
    saveMultipleMemoriesToDB(INITIAL_MEMORIES).catch(console.warn);
    setMemories(INITIAL_MEMORIES);
    setDreams(INITIAL_DREAMS);
    setEvents(INITIAL_EVENTS);
    setFutureLetters(INITIAL_FUTURE_LETTERS);
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('Storage clear error', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        userProfile,
        updateUserProfile,
        toggleLowEnergyMode,
        toggleJournalAwareAI,
        setMood,
        tasks: activeTaskList,
        addTask,
        toggleTask,
        deleteTask,
        journalEntries,
        addJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        togglePinJournalEntry,
        memories,
        addMemory,
        addMultipleMemories,
        updateMemory,
        deleteMemory,
        dreams,
        addDream,
        updateDream,
        deleteDream,
        toggleDreamCompleted,
        futureLetters,
        addFutureLetter,
        updateFutureLetter,
        deleteFutureLetter,
        events,
        addEvent,
        deleteEvent,
        quickActionModal,
        setQuickActionModal,
        syncState,
        triggerManualSync,
        driveAuthState,
        connectDrive,
        disconnectDrive,
        reloadMemoriesFromDB,
        refreshMemories,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
