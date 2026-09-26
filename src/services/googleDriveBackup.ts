/**
 * Google Drive Backup & Restoration Service
 * Connects IndexedDB photo storage (memories) and personal user files (FileItem)
 * directly to Google Drive using the in-memory GIS token.
 * 
 * STRICT SAFEGUARDS:
 * 1. Private Vault records, encryption keys, and PBKDF2 salts are EXPLICITLY FORBIDDEN
 *    from ever being backed up to Google Drive.
 * 2. Tokens are strictly in-memory and never written to storage or logs.
 * 3. Local IndexedDB data is never wiped or overwritten destructively.
 */

import { FileItem, FolderItem, Memory } from '../types';
import { googleDriveAuth } from './googleDriveAuth';
import { googleDriveClient } from './googleDriveClient';
import {
  saveMemoryToDB,
  updateMemoryDriveMeta,
  getAllMemoriesFromDB,
} from './photoStorage';
import {
  saveFileToDB,
  updateFileDriveMeta,
  getAllFilesFromDB,
} from './fileStorage';

export interface BackupProgress {
  phase: 'idle' | 'preparing' | 'uploading' | 'downloading' | 'completed' | 'error';
  current: number;
  total: number;
  itemName: string;
  percent: number;
  message: string;
}

export interface BackupSummary {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface RestoreSummary<T> {
  totalFoundOnDrive: number;
  restored: number;
  skippedAlreadyPresent: number;
  failed: number;
  items: T[];
  errors: string[];
}

/**
 * Converts a browser Data URL (base64) to a binary Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Converts a Blob to a browser Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Backs up memory photos from IndexedDB to Google Drive
 */
export async function backupMemoriesToDrive(
  memoriesToBackup: Memory[],
  onProgress?: (progress: BackupProgress) => void
): Promise<BackupSummary> {
  if (!googleDriveAuth.hasValidToken()) {
    throw new Error('Google Drive is not authenticated or the token has expired. Please connect Drive first.');
  }

  const summary: BackupSummary = {
    total: memoriesToBackup.length,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: memoriesToBackup.length,
    itemName: 'Preparing Memories folder...',
    percent: 0,
    message: 'Connecting to Sanctuary Memories folder on Google Drive...',
  });

  const memoriesFolderId = await googleDriveClient.getMemoriesFolder();

  for (let i = 0; i < memoriesToBackup.length; i++) {
    const memory = memoriesToBackup[i];
    const currentNum = i + 1;
    const percent = Math.round((currentNum / memoriesToBackup.length) * 100);

    onProgress?.({
      phase: 'uploading',
      current: currentNum,
      total: memoriesToBackup.length,
      itemName: memory.title,
      percent,
      message: `Uploading "${memory.title}" (${currentNum} of ${memoriesToBackup.length})...`,
    });

    try {
      if (!memory.imageSrc || memory.imageSrc.trim() === '') {
        summary.skipped++;
        continue;
      }

      // If already linked, check if it still exists on Drive
      if (memory.driveFileId) {
        const exists = await googleDriveClient.checkFileExists(memory.driveFileId);
        if (exists) {
          summary.skipped++;
          await updateMemoryDriveMeta(memory.id, {
            driveSyncedAt: new Date().toISOString(),
            driveStatus: 'synced',
          });
          continue;
        }
      }

      const blob = dataUrlToBlob(memory.imageSrc);
      const isPng = memory.imageSrc.startsWith('data:image/png');
      const ext = isPng ? 'png' : 'jpg';
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const sanitizedTitle = (memory.title || 'memory').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${sanitizedTitle}_${memory.id.slice(-6)}.${ext}`;

      const uploaded = await googleDriveClient.uploadMultipart({
        name: filename,
        mimeType,
        blob,
        parentFolderId: memoriesFolderId,
        mlwId: memory.id,
        extraAppProperties: {
          mlw_type: 'memory',
          memoryId: memory.id,
          title: memory.title,
          date: memory.date,
          category: memory.category,
          aspect: memory.aspect,
          caption: memory.caption || '',
          location: memory.location || '',
        },
      });

      // Update local IndexedDB metadata safely without modifying imageSrc
      await updateMemoryDriveMeta(memory.id, {
        driveFileId: uploaded.id,
        driveSyncedAt: new Date().toISOString(),
        driveStatus: 'synced',
      });

      summary.successful++;
    } catch (err: any) {
      console.error(`[Drive Backup] Failed to backup memory "${memory.title}":`, err);
      summary.failed++;
      summary.errors.push(`"${memory.title}": ${err?.message || 'Upload failed'}`);
    }
  }

  onProgress?.({
    phase: 'completed',
    current: memoriesToBackup.length,
    total: memoriesToBackup.length,
    itemName: 'Memories Backup Completed',
    percent: 100,
    message: `Completed: ${summary.successful} uploaded, ${summary.skipped} already current, ${summary.failed} failed.`,
  });

  return summary;
}

/**
 * Restores memories from Google Drive into local IndexedDB
 */
export async function restoreMemoriesFromDrive(
  onProgress?: (progress: BackupProgress) => void
): Promise<RestoreSummary<Memory>> {
  if (!googleDriveAuth.hasValidToken()) {
    throw new Error('Google Drive is not authenticated or the token has expired. Please connect Drive first.');
  }

  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: 0,
    itemName: 'Scanning Google Drive...',
    percent: 0,
    message: 'Scanning Sanctuary Memories folder on Google Drive...',
  });

  const memoriesFolderId = await googleDriveClient.getMemoriesFolder();
  const query = `trashed = false and '${memoriesFolderId}' in parents and appProperties has { key='mlw_app' and value='sanctuary' }`;
  const driveFiles = await googleDriveClient.queryFiles(
    query,
    'files(id, name, mimeType, size, appProperties, createdTime, modifiedTime, trashed)'
  );

  const localMemories = await getAllMemoriesFromDB();
  const localMapById = new Map<string, Memory>();
  const localMapByDriveId = new Map<string, Memory>();

  localMemories.forEach((m) => {
    localMapById.set(m.id, m);
    if (m.driveFileId) localMapByDriveId.set(m.driveFileId, m);
  });

  const summary: RestoreSummary<Memory> = {
    totalFoundOnDrive: driveFiles.length,
    restored: 0,
    skippedAlreadyPresent: 0,
    failed: 0,
    items: [],
    errors: [],
  };

  for (let i = 0; i < driveFiles.length; i++) {
    const file = driveFiles[i];
    const currentNum = i + 1;
    const percent = Math.round((currentNum / driveFiles.length) * 100);
    const mlwId = file.appProperties?.mlw_id || file.appProperties?.memoryId || `memory-drive-${file.id}`;
    const title = file.appProperties?.title || file.name.replace(/\.[^/.]+$/, '');

    onProgress?.({
      phase: 'downloading',
      current: currentNum,
      total: driveFiles.length,
      itemName: title,
      percent,
      message: `Downloading "${title}" from Google Drive (${currentNum} of ${driveFiles.length})...`,
    });

    try {
      // Check if existing local memory already has photo binary
      const existing = localMapByDriveId.get(file.id) || localMapById.get(mlwId);
      if (existing && existing.imageSrc && existing.imageSrc.length > 100) {
        summary.skippedAlreadyPresent++;
        // Keep driveFileId mapped
        if (!existing.driveFileId) {
          await updateMemoryDriveMeta(existing.id, {
            driveFileId: file.id,
            driveSyncedAt: new Date().toISOString(),
            driveStatus: 'synced',
          });
        }
        summary.items.push(existing);
        continue;
      }

      // Download binary from Google Drive
      const blob = await googleDriveClient.downloadBlob(file.id);
      const dataUrl = await blobToDataUrl(blob);

      const restoredMemory: Memory = {
        id: mlwId,
        title: title,
        date: file.appProperties?.date || new Date().toISOString().slice(0, 10),
        location: file.appProperties?.location || undefined,
        category: file.appProperties?.category || 'Moments',
        aspect: (file.appProperties?.aspect as any) || 'square',
        caption: file.appProperties?.caption || '',
        imageSrc: dataUrl,
        driveFileId: file.id,
        driveSyncedAt: new Date().toISOString(),
        driveStatus: 'synced',
        createdAt: file.createdTime || new Date().toISOString(),
        updatedAt: file.modifiedTime || new Date().toISOString(),
      };

      await saveMemoryToDB(restoredMemory);
      summary.restored++;
      summary.items.push(restoredMemory);
    } catch (err: any) {
      console.error(`[Drive Restore] Failed to restore photo "${file.name}":`, err);
      summary.failed++;
      summary.errors.push(`"${file.name}": ${err?.message || 'Download failed'}`);
    }
  }

  onProgress?.({
    phase: 'completed',
    current: driveFiles.length,
    total: driveFiles.length,
    itemName: 'Memories Restoration Completed',
    percent: 100,
    message: `Restored ${summary.restored} photos from Google Drive (${summary.skippedAlreadyPresent} already local).`,
  });

  return summary;
}

/**
 * Backs up personal files from IndexedDB to Google Drive
 */
export async function backupFilesToDrive(
  filesToBackup: FileItem[],
  onProgress?: (progress: BackupProgress) => void
): Promise<BackupSummary> {
  if (!googleDriveAuth.hasValidToken()) {
    throw new Error('Google Drive is not authenticated or the token has expired. Please connect Drive first.');
  }

  const summary: BackupSummary = {
    total: filesToBackup.length,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: filesToBackup.length,
    itemName: 'Preparing Files folder...',
    percent: 0,
    message: 'Connecting to Sanctuary Files folder on Google Drive...',
  });

  const filesFolderId = await googleDriveClient.getFilesFolder();

  for (let i = 0; i < filesToBackup.length; i++) {
    const file = filesToBackup[i];
    const currentNum = i + 1;
    const percent = Math.round((currentNum / filesToBackup.length) * 100);

    onProgress?.({
      phase: 'uploading',
      current: currentNum,
      total: filesToBackup.length,
      itemName: file.name,
      percent,
      message: `Uploading "${file.name}" (${currentNum} of ${filesToBackup.length})...`,
    });

    try {
      if (!file.dataUrl || file.dataUrl.trim() === '') {
        summary.skipped++;
        continue;
      }

      if (file.driveFileId) {
        const exists = await googleDriveClient.checkFileExists(file.driveFileId);
        if (exists) {
          summary.skipped++;
          await updateFileDriveMeta(file.id, {
            driveSyncedAt: new Date().toISOString(),
            driveStatus: 'synced',
          });
          continue;
        }
      }

      const blob = dataUrlToBlob(file.dataUrl);

      const uploaded = await googleDriveClient.uploadMultipart({
        name: file.name,
        mimeType: file.mimeType || 'application/octet-stream',
        blob,
        parentFolderId: filesFolderId,
        mlwId: file.id,
        extraAppProperties: {
          mlw_type: 'file',
          fileId: file.id,
          fileName: file.name,
          folderId: file.folderId,
          extension: file.extension || '',
        },
      });

      await updateFileDriveMeta(file.id, {
        driveFileId: uploaded.id,
        driveSyncedAt: new Date().toISOString(),
        driveStatus: 'synced',
      });

      summary.successful++;
    } catch (err: any) {
      console.error(`[Drive Backup] Failed to upload file "${file.name}":`, err);
      summary.failed++;
      summary.errors.push(`"${file.name}": ${err?.message || 'Upload failed'}`);
    }
  }

  onProgress?.({
    phase: 'completed',
    current: filesToBackup.length,
    total: filesToBackup.length,
    itemName: 'Files Backup Completed',
    percent: 100,
    message: `Completed: ${summary.successful} files uploaded, ${summary.skipped} already current, ${summary.failed} failed.`,
  });

  return summary;
}

/**
 * Restores user files from Google Drive into local IndexedDB
 */
export async function restoreFilesFromDrive(
  onProgress?: (progress: BackupProgress) => void
): Promise<RestoreSummary<FileItem>> {
  if (!googleDriveAuth.hasValidToken()) {
    throw new Error('Google Drive is not authenticated or the token has expired. Please connect Drive first.');
  }

  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: 0,
    itemName: 'Scanning Google Drive files...',
    percent: 0,
    message: 'Scanning Sanctuary Files folder on Google Drive...',
  });

  const filesFolderId = await googleDriveClient.getFilesFolder();
  const query = `trashed = false and '${filesFolderId}' in parents and appProperties has { key='mlw_app' and value='sanctuary' }`;
  const driveFiles = await googleDriveClient.queryFiles(
    query,
    'files(id, name, mimeType, size, appProperties, createdTime, modifiedTime, trashed)'
  );

  const localFiles = await getAllFilesFromDB();
  const localMapById = new Map<string, FileItem>();
  const localMapByDriveId = new Map<string, FileItem>();

  localFiles.forEach((f) => {
    localMapById.set(f.id, f);
    if (f.driveFileId) localMapByDriveId.set(f.driveFileId, f);
  });

  const summary: RestoreSummary<FileItem> = {
    totalFoundOnDrive: driveFiles.length,
    restored: 0,
    skippedAlreadyPresent: 0,
    failed: 0,
    items: [],
    errors: [],
  };

  for (let i = 0; i < driveFiles.length; i++) {
    const file = driveFiles[i];
    const currentNum = i + 1;
    const percent = Math.round((currentNum / driveFiles.length) * 100);
    const mlwId = file.appProperties?.mlw_id || file.appProperties?.fileId || `file-drive-${file.id}`;
    const name = file.appProperties?.fileName || file.name;

    onProgress?.({
      phase: 'downloading',
      current: currentNum,
      total: driveFiles.length,
      itemName: name,
      percent,
      message: `Downloading "${name}" from Google Drive (${currentNum} of ${driveFiles.length})...`,
    });

    try {
      const existing = localMapByDriveId.get(file.id) || localMapById.get(mlwId);
      if (existing && existing.dataUrl && existing.dataUrl.length > 50) {
        summary.skippedAlreadyPresent++;
        if (!existing.driveFileId) {
          await updateFileDriveMeta(existing.id, {
            driveFileId: file.id,
            driveSyncedAt: new Date().toISOString(),
            driveStatus: 'synced',
          });
        }
        summary.items.push(existing);
        continue;
      }

      const blob = await googleDriveClient.downloadBlob(file.id);
      const dataUrl = await blobToDataUrl(blob);
      const extension = file.appProperties?.extension || name.split('.').pop() || 'dat';

      const restoredFile: FileItem = {
        id: mlwId,
        name: name,
        folderId: file.appProperties?.folderId || 'folder-documents',
        size: Number(file.size) || blob.size,
        mimeType: file.mimeType || 'application/octet-stream',
        extension: extension,
        dataUrl: dataUrl,
        driveFileId: file.id,
        driveSyncedAt: new Date().toISOString(),
        driveStatus: 'synced',
        createdAt: file.createdTime || new Date().toISOString(),
        updatedAt: file.modifiedTime || new Date().toISOString(),
      };

      await saveFileToDB(restoredFile);
      summary.restored++;
      summary.items.push(restoredFile);
    } catch (err: any) {
      console.error(`[Drive Restore] Failed to restore file "${file.name}":`, err);
      summary.failed++;
      summary.errors.push(`"${file.name}": ${err?.message || 'Download failed'}`);
    }
  }

  onProgress?.({
    phase: 'completed',
    current: driveFiles.length,
    total: driveFiles.length,
    itemName: 'Files Restoration Completed',
    percent: 100,
    message: `Restored ${summary.restored} files from Google Drive (${summary.skippedAlreadyPresent} already local).`,
  });

  return summary;
}
