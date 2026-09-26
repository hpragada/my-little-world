/**
 * Google Drive v3 REST Client Service
 * Strictly adheres to drive.file OAuth scope.
 * Provides folder management, duplicate prevention via appProperties,
 * multipart upload, media download, soft-delete trashing, and exponential retry.
 * 
 * NOTE: Operates only with in-memory Bearer token from googleDriveAuth.
 * Does NOT persist tokens or secrets anywhere.
 */

import { DriveFileMetadata } from '../types';
import { googleDriveAuth } from './googleDriveAuth';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

interface RequestOptions extends RequestInit {
  retryCount?: number;
}

class GoogleDriveClient {
  // In-memory cache for folder IDs to reduce redundant lookups during a session
  private rootFolderId: string | null = null;
  private memoriesFolderId: string | null = null;
  private filesFolderId: string | null = null;

  /**
   * Helper to perform authenticated fetch with exponential backoff
   */
  private async authenticatedFetch(
    url: string,
    options: RequestOptions = {}
  ): Promise<Response> {
    const token = googleDriveAuth.getAccessToken();
    if (!token) {
      throw new Error('Google Drive is not authenticated or token has expired.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    const maxRetries = 3;
    const retryCount = options.retryCount || 0;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        googleDriveAuth.markTokenExpired();
        throw new Error('Google Drive authorization expired. Please re-authenticate.');
      }

      // Retry on 429 (rate limit) or 5xx (server error)
      if ((response.status === 429 || response.status >= 500) && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        return this.authenticatedFetch(url, {
          ...options,
          retryCount: retryCount + 1,
        });
      }

      return response;
    } catch (err: any) {
      if (retryCount < maxRetries && err.name !== 'AbortError' && !err.message.includes('expired')) {
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        return this.authenticatedFetch(url, {
          ...options,
          retryCount: retryCount + 1,
        });
      }
      throw err;
    }
  }

  /**
   * Preflight check to verify if a file ID exists and is accessible
   */
  public async checkFileExists(driveFileId: string): Promise<boolean> {
    if (!driveFileId || !googleDriveAuth.hasValidToken()) return false;
    try {
      const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(
        driveFileId
      )}?fields=id,name,mimeType,trashed`;
      const res = await this.authenticatedFetch(url);
      if (res.status === 200) {
        const data = await res.json();
        return !data.trashed;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Queries Drive files/folders matching a query string
   */
  public async queryFiles(query: string, fields = 'files(id, name, mimeType, appProperties, trashed)'): Promise<DriveFileMetadata[]> {
    const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=50`;
    const res = await this.authenticatedFetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive query failed: ${err}`);
    }
    const data = await res.json();
    return data.files || [];
  }

  /**
   * Finds or creates the "My Little World" sanctuary root folder
   */
  public async getSanctuaryRootFolder(): Promise<string> {
    if (this.rootFolderId) {
      const exists = await this.checkFileExists(this.rootFolderId);
      if (exists) return this.rootFolderId;
    }

    const query = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='mlw_app' and value='sanctuary' } and appProperties has { key='mlw_type' and value='root' }";
    const existing = await this.queryFiles(query);

    if (existing.length > 0) {
      this.rootFolderId = existing[0].id;
      return existing[0].id;
    }

    // Create root folder
    const created = await this.createFolder('My Little World', undefined, {
      mlw_app: 'sanctuary',
      mlw_type: 'root',
    });
    this.rootFolderId = created.id;
    return created.id;
  }

  /**
   * Finds or creates the "Memories" subfolder
   */
  public async getMemoriesFolder(): Promise<string> {
    if (this.memoriesFolderId) {
      const exists = await this.checkFileExists(this.memoriesFolderId);
      if (exists) return this.memoriesFolderId;
    }

    const rootId = await this.getSanctuaryRootFolder();
    const query = `trashed = false and '${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='mlw_type' and value='memories_root' }`;
    const existing = await this.queryFiles(query);

    if (existing.length > 0) {
      this.memoriesFolderId = existing[0].id;
      return existing[0].id;
    }

    const created = await this.createFolder('Memories', rootId, {
      mlw_app: 'sanctuary',
      mlw_type: 'memories_root',
    });
    this.memoriesFolderId = created.id;
    return created.id;
  }

  /**
   * Finds or creates the "Files" subfolder
   */
  public async getFilesFolder(): Promise<string> {
    if (this.filesFolderId) {
      const exists = await this.checkFileExists(this.filesFolderId);
      if (exists) return this.filesFolderId;
    }

    const rootId = await this.getSanctuaryRootFolder();
    const query = `trashed = false and '${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='mlw_type' and value='files_root' }`;
    const existing = await this.queryFiles(query);

    if (existing.length > 0) {
      this.filesFolderId = existing[0].id;
      return existing[0].id;
    }

    const created = await this.createFolder('Files', rootId, {
      mlw_app: 'sanctuary',
      mlw_type: 'files_root',
    });
    this.filesFolderId = created.id;
    return created.id;
  }

  /**
   * Creates a folder in Drive with appProperties metadata
   */
  public async createFolder(
    name: string,
    parentFolderId?: string,
    appProperties: Record<string, string> = {}
  ): Promise<DriveFileMetadata> {
    const metadata: Record<string, any> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        mlw_app: 'sanctuary',
        ...appProperties,
      },
    };

    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const res = await this.authenticatedFetch(`${DRIVE_API_BASE}/files?fields=id,name,mimeType,appProperties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Drive folder: ${err}`);
    }

    return res.json();
  }

  /**
   * Checks if an item with a given mlwId already exists in the destination folder
   */
  public async findExistingFile(
    parentFolderId: string,
    mlwId: string
  ): Promise<DriveFileMetadata | null> {
    const query = `trashed = false and '${parentFolderId}' in parents and appProperties has { key='mlw_id' and value='${mlwId}' }`;
    const files = await this.queryFiles(query);
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Uploads a file (photo or document) to Google Drive using multipart upload
   */
  public async uploadMultipart(options: {
    name: string;
    mimeType: string;
    blob: Blob;
    parentFolderId: string;
    mlwId: string;
    extraAppProperties?: Record<string, string>;
  }): Promise<DriveFileMetadata> {
    const { name, mimeType, blob, parentFolderId, mlwId, extraAppProperties = {} } = options;

    // Check for existing duplicate by mlwId
    const existing = await this.findExistingFile(parentFolderId, mlwId);
    if (existing) {
      return existing;
    }

    const metadata = {
      name,
      mimeType,
      parents: [parentFolderId],
      appProperties: {
        mlw_app: 'sanctuary',
        mlw_id: mlwId,
        ...extraAppProperties,
      },
    };

    const boundary = `-------mlw_boundary_${Date.now()}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
    const mediaPartHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

    // Construct multipart payload using Blob array parts
    const multipartBlob = new Blob(
      [metadataPart, mediaPartHeader, blob, closeDelimiter],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const res = await this.authenticatedFetch(
      `${DRIVE_UPLOAD_BASE}&fields=id,name,mimeType,size,appProperties,createdTime,modifiedTime`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBlob,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive upload failed: ${err}`);
    }

    return res.json();
  }

  /**
   * Downloads a file's raw binary data as a Blob from Google Drive
   */
  public async downloadBlob(driveFileId: string): Promise<Blob> {
    const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(driveFileId)}?alt=media`;
    const res = await this.authenticatedFetch(url);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to download Drive file ${driveFileId}: ${err}`);
    }
    return res.blob();
  }

  /**
   * Soft-deletes a file by setting trashed = true (moves to user's Google Drive Trash)
   * NEVER permanently purges the file.
   */
  public async trashFile(driveFileId: string): Promise<boolean> {
    try {
      const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(driveFileId)}`;
      const res = await this.authenticatedFetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trashed: true }),
      });
      return res.ok;
    } catch (err) {
      console.warn(`[Drive Client] Failed to trash file ${driveFileId}:`, err);
      return false;
    }
  }

  /**
   * Clears in-memory cached folder IDs upon disconnect or user change
   */
  public clearCache(): void {
    this.rootFolderId = null;
    this.memoriesFolderId = null;
    this.filesFolderId = null;
  }
}

export const googleDriveClient = new GoogleDriveClient();
