import { Memory } from '../types';

const DB_NAME = 'my_little_world_db';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

/**
 * Initialize IndexedDB for persistent photo storage
 */
export function openMemoriesDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Get all stored memories from IndexedDB
 */
export async function getAllMemoriesFromDB(): Promise<Memory[]> {
  try {
    const db = await openMemoriesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as Memory[]) || []);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to retrieve memories from DB'));
      };
    });
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
    return [];
  }
}

/**
 * Save or update a single memory in IndexedDB
 */
export async function saveMemoryToDB(memory: Memory): Promise<void> {
  const db = await openMemoriesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(memory);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to save memory to DB'));
  });
}

/**
 * Save multiple memories in a single transaction
 */
export async function saveMultipleMemoriesToDB(memories: Memory[]): Promise<void> {
  const db = await openMemoriesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const mem of memories) {
      store.put(mem);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to batch save memories to DB'));
  });
}

/**
 * Delete a memory by ID from IndexedDB
 */
export async function deleteMemoryFromDB(id: string): Promise<void> {
  const db = await openMemoriesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to delete memory from DB'));
  });
}

/**
 * Get a single memory by ID from IndexedDB
 */
export async function getMemoryById(id: string): Promise<Memory | null> {
  const db = await openMemoriesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as Memory) || null);
    request.onerror = () => reject(request.error || new Error(`Failed to get memory ${id}`));
  });
}

/**
 * Update ONLY Drive metadata fields on an existing memory.
 * STRICT SAFEGUARD: Never modifies, overwrites, or deletes existing imageSrc or binary data.
 */
export async function updateMemoryDriveMeta(
  id: string,
  meta: {
    driveFileId?: string;
    driveSyncedAt?: string;
    driveStatus?: Memory['driveStatus'];
    updatedAt?: string;
  }
): Promise<void> {
  const db = await openMemoriesDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as Memory | undefined;
      if (!existing) {
        // Record does not exist locally; resolve without overwriting
        return resolve();
      }

      // Preserve existing imageSrc and all other fields untouched
      const updated: Memory = {
        ...existing,
        ...(meta.driveFileId !== undefined ? { driveFileId: meta.driveFileId } : {}),
        ...(meta.driveSyncedAt !== undefined ? { driveSyncedAt: meta.driveSyncedAt } : {}),
        ...(meta.driveStatus !== undefined ? { driveStatus: meta.driveStatus } : {}),
        updatedAt: meta.updatedAt || new Date().toISOString(),
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error || new Error(`Failed to update drive meta for ${id}`));
    };

    getReq.onerror = () => reject(getReq.error || new Error(`Failed to fetch memory ${id}`));
  });
}


/**
 * Helper to compress and convert uploaded image files (JPG, PNG, WEBP)
 * to high-quality Data URLs, safeguarding against excessive memory usage
 * while keeping sharp resolution.
 */
export function processImageFile(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.88
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      return reject(
        new Error(
          `Unsupported file format (${file.type || 'unknown'}). Please choose JPG, JPEG, PNG, or WEBP.`
        )
      );
    }

    // Maximum file size limit: 25 MB before compression
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return reject(
        new Error(
          `File size exceeds 25 MB (${(file.size / (1024 * 1024)).toFixed(
            1
          )} MB). Please select a smaller photo.`
        )
      );
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect-preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not initialize canvas context for photo processing.'));
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output MIME type: preserve PNG transparency if PNG, else use image/jpeg
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, quality);

        resolve({ dataUrl, width, height });
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image "${file.name}". The file may be corrupt.`));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file "${file.name}".`));
    };

    reader.readAsDataURL(file);
  });
}
