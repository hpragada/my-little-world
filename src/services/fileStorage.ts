import {
  FileItem,
  FolderItem,
  VaultConfig,
  VaultEncryptedRecord,
} from '../types';

const DB_NAME = 'my_little_world_files_db';
const DB_VERSION = 1;

const STORES = {
  FOLDERS: 'folders',
  FILES: 'files',
  VAULT_META: 'vault_meta',
  VAULT_ITEMS: 'vault_items',
} as const;

export const DEFAULT_FOLDERS: FolderItem[] = [
  {
    id: 'folder-documents',
    name: 'My Documents',
    parentId: null,
    isDefault: true,
    color: '#B8A4D8',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'folder-projects',
    name: 'My Projects',
    parentId: null,
    isDefault: true,
    color: '#8EA7E9',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'folder-career',
    name: 'Career & Certificates',
    parentId: null,
    isDefault: true,
    color: '#A0D8B3',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'folder-personal',
    name: 'Personal',
    parentId: null,
    isDefault: true,
    color: '#F4B183',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_FILES: FileItem[] = [
  {
    id: 'file-welcome-guide',
    name: 'Welcome to My Files.md',
    folderId: 'folder-documents',
    size: 1420,
    mimeType: 'text/markdown',
    extension: 'md',
    dataUrl:
      'data:text/markdown;base64,' +
      btoa(
        `# Welcome to My Files\n\nYour safe, personal file sanctuary inside **My Little World**.\n\n### What you can do here:\n- Organize your life into custom folders & subfolders\n- Upload documents, PDFs, photos, and project archives safely\n- Store files securely in your browser's private database\n- Access your separate **Private Vault** with client-side AES-GCM 256-bit encryption for sensitive records\n\nEverything stays private on your device.`
      ),
    createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(),
  },
  {
    id: 'file-career-roadmap',
    name: 'Career & Growth Roadmap.txt',
    folderId: 'folder-career',
    size: 890,
    mimeType: 'text/plain',
    extension: 'txt',
    dataUrl:
      'data:text/plain;base64,' +
      btoa(
        `Personal Career Sanctuary:\n- Q1: Consolidate core skills & build personal portfolio\n- Q2: Explore modern cloud architecture & systems\n- Q3: Certification & creative projects\n\nRemember: Gentle consistency brings enduring growth.`
      ),
    createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000 * 24 * 5).toISOString(),
  },
];

/**
 * Open or upgrade Files IndexedDB
 */
export function openFilesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this browser.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
        const folderStore = db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
        folderStore.createIndex('parentId', 'parentId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.FILES)) {
        const fileStore = db.createObjectStore(STORES.FILES, { keyPath: 'id' });
        fileStore.createIndex('folderId', 'folderId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.VAULT_META)) {
        db.createObjectStore(STORES.VAULT_META, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.VAULT_ITEMS)) {
        db.createObjectStore(STORES.VAULT_ITEMS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open Files database'));
    };
  });
}

/**
 * Initialize default folders and starter files if DB is fresh
 */
export async function initFilesStorage(): Promise<{
  folders: FolderItem[];
  files: FileItem[];
}> {
  const db = await openFilesDB();

  // Check folders
  const currentFolders = await new Promise<FolderItem[]>((resolve) => {
    const tx = db.transaction(STORES.FOLDERS, 'readonly');
    const store = tx.objectStore(STORES.FOLDERS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as FolderItem[]) || []);
    req.onerror = () => resolve([]);
  });

  let folders = currentFolders;
  if (folders.length === 0) {
    // Seed default folders
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.FOLDERS, 'readwrite');
      const store = tx.objectStore(STORES.FOLDERS);
      DEFAULT_FOLDERS.forEach((f) => store.put(f));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    folders = [...DEFAULT_FOLDERS];
  }

  // Check files
  const currentFiles = await new Promise<FileItem[]>((resolve) => {
    const tx = db.transaction(STORES.FILES, 'readonly');
    const store = tx.objectStore(STORES.FILES);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as FileItem[]) || []);
    req.onerror = () => resolve([]);
  });

  let files = currentFiles;
  if (files.length === 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.FILES, 'readwrite');
      const store = tx.objectStore(STORES.FILES);
      INITIAL_FILES.forEach((file) => store.put(file));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    files = [...INITIAL_FILES];
  }

  return { folders, files };
}

// ================= FOLDER OPERATIONS =================

export async function getAllFolders(): Promise<FolderItem[]> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FOLDERS, 'readonly');
    const store = tx.objectStore(STORES.FOLDERS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as FolderItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFolder(folder: FolderItem): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FOLDERS, 'readwrite');
    const store = tx.objectStore(STORES.FOLDERS);
    const req = store.put(folder);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function renameFolder(id: string, newName: string): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FOLDERS, 'readwrite');
    const store = tx.objectStore(STORES.FOLDERS);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const folder = getReq.result as FolderItem;
      if (folder) {
        folder.name = newName;
        store.put(folder);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFolderAndContents(
  id: string
): Promise<{ deletedFolderIds: string[]; deletedFileIds: string[] }> {
  const db = await openFilesDB();

  // Find all descendant folders recursively
  const allFolders = await getAllFolders();
  const folderIdsToDelete = new Set<string>([id]);

  let addedMore = true;
  while (addedMore) {
    addedMore = false;
    for (const f of allFolders) {
      if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
        folderIdsToDelete.add(f.id);
        addedMore = true;
      }
    }
  }

  // Delete all folders and associated files
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.FOLDERS, STORES.FILES], 'readwrite');
    const folderStore = tx.objectStore(STORES.FOLDERS);
    const fileStore = tx.objectStore(STORES.FILES);
    const deletedFileIds: string[] = [];

    folderIdsToDelete.forEach((fId) => {
      folderStore.delete(fId);
    });

    // Delete files in those folders
    const fileReq = fileStore.getAll();
    fileReq.onsuccess = () => {
      const files = (fileReq.result as FileItem[]) || [];
      files.forEach((f) => {
        if (folderIdsToDelete.has(f.folderId)) {
          fileStore.delete(f.id);
          deletedFileIds.push(f.id);
        }
      });
    };

    tx.oncomplete = () =>
      resolve({
        deletedFolderIds: Array.from(folderIdsToDelete),
        deletedFileIds,
      });
    tx.onerror = () => reject(tx.error);
  });
}

// ================= FILE OPERATIONS =================

export async function getAllFiles(): Promise<FileItem[]> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readonly');
    const store = tx.objectStore(STORES.FILES);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as FileItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(file: FileItem): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);
    const req = store.put(file);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveMultipleFiles(files: FileItem[]): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);
    files.forEach((f) => store.put(f));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function renameFile(id: string, newName: string): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const file = getReq.result as FileItem;
      if (file) {
        file.name = newName;
        file.updatedAt = new Date().toISOString();
        const parts = newName.split('.');
        if (parts.length > 1) {
          file.extension = parts.pop()?.toLowerCase() || file.extension;
        }
        store.put(file);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a single file by ID from IndexedDB
 */
export async function getFileById(id: string): Promise<FileItem | null> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readonly');
    const store = tx.objectStore(STORES.FILES);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as FileItem) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update ONLY Drive metadata fields on an existing file.
 * STRICT SAFEGUARD: Never modifies, overwrites, or deletes existing dataUrl or binary content.
 */
export async function updateFileDriveMeta(
  id: string,
  meta: {
    driveFileId?: string;
    driveSyncedAt?: string;
    driveStatus?: FileItem['driveStatus'];
    updatedAt?: string;
  }
): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as FileItem | undefined;
      if (!existing) {
        return resolve();
      }

      // Preserve existing dataUrl, size, mimeType, etc. untouched
      const updated: FileItem = {
        ...existing,
        ...(meta.driveFileId !== undefined ? { driveFileId: meta.driveFileId } : {}),
        ...(meta.driveSyncedAt !== undefined ? { driveSyncedAt: meta.driveSyncedAt } : {}),
        ...(meta.driveStatus !== undefined ? { driveStatus: meta.driveStatus } : {}),
        updatedAt: meta.updatedAt || new Date().toISOString(),
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Update Drive metadata fields on a folder.
 */
export async function updateFolderDriveMeta(
  id: string,
  meta: {
    driveFolderId?: string;
    driveSyncedAt?: string;
    updatedAt?: string;
  }
): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.FOLDERS, 'readwrite');
    const store = tx.objectStore(STORES.FOLDERS);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as FolderItem | undefined;
      if (!existing) {
        return resolve();
      }

      const updated: FolderItem = {
        ...existing,
        ...(meta.driveFolderId !== undefined ? { driveFolderId: meta.driveFolderId } : {}),
        ...(meta.driveSyncedAt !== undefined ? { driveSyncedAt: meta.driveSyncedAt } : {}),
        updatedAt: meta.updatedAt || new Date().toISOString(),
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}


// ================= VAULT OPERATIONS =================

export async function getVaultConfig(): Promise<VaultConfig | null> {
  const db = await openFilesDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.VAULT_META, 'readonly');
    const store = tx.objectStore(STORES.VAULT_META);
    const req = store.get('config');
    req.onsuccess = () => {
      const result = req.result;
      if (result && result.config) {
        resolve(result.config as VaultConfig);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

export async function saveVaultConfig(config: VaultConfig): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.VAULT_META, 'readwrite');
    const store = tx.objectStore(STORES.VAULT_META);
    const req = store.put({ id: 'config', config });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllVaultEncryptedRecords(): Promise<VaultEncryptedRecord[]> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.VAULT_ITEMS, 'readonly');
    const store = tx.objectStore(STORES.VAULT_ITEMS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as VaultEncryptedRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVaultEncryptedRecord(record: VaultEncryptedRecord): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.VAULT_ITEMS, 'readwrite');
    const store = tx.objectStore(STORES.VAULT_ITEMS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveMultipleVaultRecords(records: VaultEncryptedRecord[]): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.VAULT_ITEMS, 'readwrite');
    const store = tx.objectStore(STORES.VAULT_ITEMS);
    records.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteVaultEncryptedRecord(id: string): Promise<void> {
  const db = await openFilesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.VAULT_ITEMS, 'readwrite');
    const store = tx.objectStore(STORES.VAULT_ITEMS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ================= UTILITIES =================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

/**
 * Reads a File object safely into a base64 DataURL
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Merges remote folder records into IndexedDB without overwriting local modifications
 */
export async function mergeRemoteFolders(
  cloudFolders: FolderItem[],
  isTombstoned?: (id: string) => boolean
): Promise<void> {
  const db = await openFilesDB();
  const tx = db.transaction(STORES.FOLDERS, 'readwrite');
  const store = tx.objectStore(STORES.FOLDERS);

  for (const cf of cloudFolders) {
    if (isTombstoned && isTombstoned(cf.id)) {
      store.delete(cf.id);
      continue;
    }
    store.put(cf);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Merges remote file metadata into IndexedDB while strictly preserving original local binary dataUrl
 */
export async function mergeRemoteFilesMetadata(
  cloudFiles: FileItem[],
  isTombstoned?: (id: string) => boolean,
  isFolderTombstoned?: (folderId: string) => boolean
): Promise<void> {
  const localFiles = await getAllFiles();
  const localMap = new Map(localFiles.map((f) => [f.id, f]));
  const db = await openFilesDB();
  const tx = db.transaction(STORES.FILES, 'readwrite');
  const store = tx.objectStore(STORES.FILES);

  for (const cf of cloudFiles) {
    if (
      (isTombstoned && isTombstoned(cf.id)) ||
      (cf.folderId && isFolderTombstoned && isFolderTombstoned(cf.folderId))
    ) {
      store.delete(cf.id);
      continue;
    }
    const local = localMap.get(cf.id);
    const merged: FileItem = {
      ...cf,
      // STRICT SAFEGUARD: Never overwrite or wipe local binary dataUrl
      dataUrl: local?.dataUrl || cf.dataUrl,
    };
    store.put(merged);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Downloads a data URL or blob safely to device
 */
export function triggerFileDownload(filename: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
