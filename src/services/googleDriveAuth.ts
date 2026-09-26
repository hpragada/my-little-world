/**
 * Google Drive Authentication Service
 * Strictly in-memory OAuth access token management.
 * Tokens, refresh tokens, and client secrets are NEVER persisted to
 * localStorage, sessionStorage, IndexedDB, cookies, Firestore, or logs.
 */

import { DriveAuthState, DriveUserInfo } from '../types';
import appletConfig from '../../firebase-applet-config.json';

// Global declaration for Google Identity Services (GIS)
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GisTokenResponse) => void;
            error_callback?: (error: any) => void;
            prompt?: string;
          }) => GisTokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

interface GisTokenResponse {
  access_token?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
  error_uri?: string;
  scope?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface DriveAuthProvider {
  platform: 'web' | 'android' | 'electron';
  signIn(options?: { prompt?: string }): Promise<string>;
  signOut(): Promise<void>;
  hasValidToken(): boolean;
  getAccessToken(): string | null;
  getUserInfo(): DriveUserInfo | null;
}

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

class GoogleDriveAuthManager {
  // STRICT IN-MEMORY STORAGE ONLY
  private inMemoryAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private inMemoryUserInfo: DriveUserInfo | null = null;
  private currentStatus: DriveAuthState['status'] = 'disconnected';
  private errorMessage: string | null = null;
  private listeners: Set<(state: DriveAuthState) => void> = new Set();
  private tokenClient: GisTokenClient | null = null;
  private pendingTokenResolve: ((token: string) => void) | null = null;
  private pendingTokenReject: ((error: Error) => void) | null = null;

  constructor() {
    // Reset state on instance creation
    this.resetState();
  }

  public getClientId(): string {
    return (
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      (appletConfig as any).oAuthClientId ||
      '1014365800901-d683kp2ifrkfcino76m6aqv7qdlda364.apps.googleusercontent.com'
    );
  }

  public getAuthState(): DriveAuthState {
    return {
      status: this.currentStatus,
      user: this.inMemoryUserInfo,
      errorMessage: this.errorMessage,
      expiresAt: this.tokenExpiresAt > 0 ? this.tokenExpiresAt : null,
    };
  }

  public subscribe(listener: (state: DriveAuthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAuthState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getAuthState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[Drive Auth] Error in listener:', err);
      }
    });
  }

  public hasValidToken(): boolean {
    if (!this.inMemoryAccessToken) return false;
    // 2-minute safety buffer
    return Date.now() < this.tokenExpiresAt - 120000;
  }

  public getAccessToken(): string | null {
    if (this.hasValidToken()) {
      return this.inMemoryAccessToken;
    }
    return null;
  }

  public getUserInfo(): DriveUserInfo | null {
    return this.inMemoryUserInfo;
  }

  /**
   * Formats error message with helpful guidance for origin_mismatch and cancellation
   */
  private formatOAuthError(errorStr: string, errorDescription?: string): string {
    const raw = `${errorStr || ''} ${errorDescription || ''}`.toLowerCase();
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const clientId = this.getClientId();

    if (raw.includes('origin_mismatch') || raw.includes('idpiframe_initialization_failed')) {
      return `Origin mismatch: The current preview origin (${currentOrigin}) is not yet authorized for OAuth Client ID ${clientId}. Ensure ${currentOrigin} is listed under "Authorized JavaScript origins" in Google Cloud Console.`;
    }

    if (raw.includes('popup_closed') || raw.includes('closed') || raw.includes('user_cancel')) {
      return 'Google sign-in popup was closed before authorization was completed.';
    }

    if (raw.includes('access_denied')) {
      return 'Google Drive access was denied. Please grant drive.file permission to enable photo and file backup.';
    }

    return errorDescription || errorStr || 'Failed to authenticate with Google Drive.';
  }

  /**
   * Waits for Google Identity Services script to be ready
   */
  public async waitForGis(timeoutMs = 5000): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (window.google?.accounts?.oauth2) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.google?.accounts?.oauth2) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  /**
   * Initializes Web GIS Token Client
   */
  private async initWebTokenClient(): Promise<GisTokenClient> {
    const isReady = await this.waitForGis();
    if (!isReady || !window.google?.accounts?.oauth2) {
      throw new Error(
        'Google Identity Services library failed to load. Please check your network connection.'
      );
    }

    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error('Google OAuth Client ID is not configured.');
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (resp: GisTokenResponse) => {
        if (resp.error) {
          const userFriendlyMsg = this.formatOAuthError(resp.error, resp.error_description);
          const isCancel = resp.error === 'popup_closed_by_user' || userFriendlyMsg.includes('closed');
          this.errorMessage = userFriendlyMsg;
          this.currentStatus = isCancel ? 'disconnected' : 'error';
          this.notify();
          if (this.pendingTokenReject) {
            this.pendingTokenReject(new Error(userFriendlyMsg));
            this.pendingTokenResolve = null;
            this.pendingTokenReject = null;
          }
          return;
        }

        if (resp.access_token) {
          this.inMemoryAccessToken = resp.access_token;
          const expiresInSec = Number(resp.expires_in) || 3600;
          this.tokenExpiresAt = Date.now() + expiresInSec * 1000;
          this.currentStatus = 'connected';
          this.errorMessage = null;

          // Asynchronously fetch user display info (in-memory only)
          this.fetchUserInfo(resp.access_token).catch((err) => {
            console.warn('[Drive Auth] Failed to fetch user info:', err);
          }).finally(() => {
            this.notify();
          });

          if (this.pendingTokenResolve) {
            this.pendingTokenResolve(resp.access_token);
            this.pendingTokenResolve = null;
            this.pendingTokenReject = null;
          }
        }
      },
      error_callback: (err: any) => {
        const errorMsg = this.formatOAuthError(err?.type || err?.message || 'popup_error', err?.message);
        const isCancel = errorMsg.includes('closed');
        this.errorMessage = errorMsg;
        this.currentStatus = isCancel ? 'disconnected' : 'error';
        this.notify();
        if (this.pendingTokenReject) {
          this.pendingTokenReject(new Error(errorMsg));
          this.pendingTokenResolve = null;
          this.pendingTokenReject = null;
        }
      },
    });

    this.tokenClient = tokenClient;
    return tokenClient;
  }

  /**
   * Prompts user for OAuth authorization using GIS popup flow
   */
  public async requestAuthorization(options?: { prompt?: string }): Promise<string> {
    if (this.hasValidToken() && this.inMemoryAccessToken) {
      return this.inMemoryAccessToken;
    }

    this.currentStatus = 'connecting';
    this.errorMessage = null;
    this.notify();

    if (!this.tokenClient) {
      await this.initWebTokenClient();
    }

    return new Promise((resolve, reject) => {
      this.pendingTokenResolve = resolve;
      this.pendingTokenReject = reject;

      try {
        this.tokenClient!.requestAccessToken({
          prompt: options?.prompt !== undefined ? options.prompt : 'consent',
        });
      } catch (err: any) {
        this.currentStatus = 'error';
        this.errorMessage = err?.message || 'Failed to trigger Google sign-in dialog';
        this.notify();
        reject(err);
      }
    });
  }

  /**
   * In-memory user info fetch via Google OAuth userinfo endpoint
   */
  private async fetchUserInfo(accessToken: string): Promise<void> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        this.inMemoryUserInfo = {
          email: data.email,
          name: data.name,
          picture: data.picture,
        };
      }
    } catch {
      // Non-critical, user profile display only
    }
  }

  /**
   * Disconnects / signs out and strictly clears all memory tokens
   */
  public async signOut(): Promise<void> {
    if (this.inMemoryAccessToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(this.inMemoryAccessToken, () => {
          // Token revoked on Google servers
        });
      } catch (err) {
        console.warn('[Drive Auth] Revocation warning:', err);
      }
    }

    this.resetState();
    this.notify();
  }

  public markTokenExpired(): void {
    this.inMemoryAccessToken = null;
    this.tokenExpiresAt = 0;
    this.currentStatus = 'expired';
    this.errorMessage = 'Google Drive session has expired. Please re-authenticate.';
    this.notify();
  }

  private resetState(): void {
    this.inMemoryAccessToken = null;
    this.tokenExpiresAt = 0;
    this.inMemoryUserInfo = null;
    this.currentStatus = 'disconnected';
    this.errorMessage = null;
    this.tokenClient = null;
  }
}

export const googleDriveAuth = new GoogleDriveAuthManager();
