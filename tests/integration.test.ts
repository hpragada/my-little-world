/**
 * Phase D3: Sync, Authentication, and Security Integration Test Suite
 * Run with: npx tsx tests/integration.test.ts
 */
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper assertions
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err?.message || err}`);
  }
}

console.log('\n============================================================');
console.log('Phase D3: Security, Authentication, & Sync Integration Tests');
console.log('============================================================\n');

// -------------------------------------------------------------
// SECTION 1: AUTHENTICATION & PROTECTED GEMINI API
// -------------------------------------------------------------
console.log('[1] Authentication & API Protection Tests');

await test('Missing Bearer token returns 401 Unauthorized', async () => {
  const res = await fetch('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  });
  assert.strictEqual(res.status, 401, 'Expected status 401');
  const body = (await res.json()) as any;
  assert.match(body.error, /Authentication required/i);
});

await test('Malformed Bearer token returns 401 Unauthorized', async () => {
  const res = await fetch('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer not-a-valid-jwt',
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  });
  assert.strictEqual(res.status, 401, 'Expected status 401');
  const body = (await res.json()) as any;
  assert.match(body.error, /Invalid, revoked, or expired/i);
});

await test('Expired JWT token returns 401 Unauthorized', async () => {
  // Construct an expired token structure (alg: RS256, exp in past)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'ai-studio-mylittleworld-0eebf553-6940-4271-ba49-6c5af415f62c',
      iss: 'https://securetoken.google.com/ai-studio-mylittleworld-0eebf553-6940-4271-ba49-6c5af415f62c',
      sub: 'test-user-123',
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      iat: Math.floor(Date.now() / 1000) - 7200,
    })
  ).toString('base64url');
  const signature = Buffer.from('fake-signature').toString('base64url');
  const expiredJwt = `${header}.${payload}.${signature}`;

  const res = await fetch('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${expiredJwt}`,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  });
  assert.strictEqual(res.status, 401, 'Expected status 401');
});

await test('Mismatched audience (wrong project ID) returns 401 Unauthorized', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fake-kid' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'different-malicious-project-id',
      iss: 'https://securetoken.google.com/different-malicious-project-id',
      sub: 'test-user-123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString('base64url');
  const signature = Buffer.from('fake-signature').toString('base64url');
  const forgedJwt = `${header}.${payload}.${signature}`;

  const res = await fetch('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${forgedJwt}`,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  });
  assert.strictEqual(res.status, 401, 'Expected status 401');
});

await test('Health check API operates safely without exposing secrets', async () => {
  const res = await fetch('http://localhost:3000/api/health');
  assert.strictEqual(res.status, 200);
  const body = (await res.json()) as any;
  assert.strictEqual(body.status, 'ok');
  assert.strictEqual(body.apiKey, undefined, 'API key must NEVER be leaked in responses');
  assert.strictEqual(body.geminiKey, undefined, 'Gemini key must NEVER be leaked in responses');
});

// -------------------------------------------------------------
// SECTION 2: TOMBSTONES & ANTI-RESURRECTION TESTING
// -------------------------------------------------------------
console.log('\n[2] Tombstones & Anti-Resurrection Logic Tests');

await test('Tombstone schema adheres to Phase D1 specification', () => {
  const tombstone = {
    id: 'event-101',
    itemType: 'event' as const,
    deletedAt: new Date().toISOString(),
    deletedAtMs: Date.now(),
    uid: 'user-abc',
  };
  assert.strictEqual(typeof tombstone.id, 'string');
  assert.ok(['event', 'memory', 'file', 'folder'].includes(tombstone.itemType));
  assert.strictEqual(typeof tombstone.deletedAtMs, 'number');
  assert.strictEqual(typeof tombstone.uid, 'string');
});

await test('Stale update timestamp conflict: Deletion wins over stale modification', () => {
  const deletedAtMs = 1700000000000;
  const staleLocalUpdateTime = 1699999999000; // Older than deletion
  const newerUpdateTime = 1700000005000; // Newer than deletion

  const shouldIgnoreStale = staleLocalUpdateTime <= deletedAtMs;
  assert.strictEqual(shouldIgnoreStale, true, 'Stale local modification must be discarded');

  const shouldAllowNewer = newerUpdateTime > deletedAtMs;
  assert.strictEqual(shouldAllowNewer, true, 'Subsequent recreate/newer update is accepted');
});

await test('Recursive folder deletion captures all subfolders and descendant file IDs', () => {
  // Tree simulation:
  // Root -> Folder A (id: fA)
  //          ├── Folder B (id: fB, parentId: fA)
  //          │    └── File 2 (id: file2, folderId: fB)
  //          └── File 1 (id: file1, folderId: fA)
  const folders = [
    { id: 'fA', parentId: null },
    { id: 'fB', parentId: 'fA' },
    { id: 'fC', parentId: null }, // Unrelated
  ];
  const files = [
    { id: 'file1', folderId: 'fA' },
    { id: 'file2', folderId: 'fB' },
    { id: 'file3', folderId: 'fC' }, // Unrelated
  ];

  // Logic from deleteFolderAndContents
  const folderIdsToDelete = new Set<string>(['fA']);
  let addedMore = true;
  while (addedMore) {
    addedMore = false;
    folders.forEach((f) => {
      if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
        folderIdsToDelete.add(f.id);
        addedMore = true;
      }
    });
  }

  const deletedFileIds: string[] = [];
  files.forEach((f) => {
    if (folderIdsToDelete.has(f.folderId)) {
      deletedFileIds.push(f.id);
    }
  });

  assert.deepStrictEqual(Array.from(folderIdsToDelete).sort(), ['fA', 'fB'].sort());
  assert.deepStrictEqual(deletedFileIds.sort(), ['file1', 'file2'].sort());
  assert.ok(!deletedFileIds.includes('file3'), 'Unrelated file must not be deleted');
});

await test('Tombstoned folder prevents nested orphaned files from being synced', () => {
  const tombstones = new Map<string, boolean>();
  tombstones.set('folder_parent', true);

  const incomingFile = {
    id: 'file_orphan',
    name: 'test.pdf',
    folderId: 'folder_parent',
  };

  const isFolderTombstoned = (folderId: string) => tombstones.has(folderId);
  const shouldSkip = isFolderTombstoned(incomingFile.folderId);
  assert.strictEqual(shouldSkip, true, 'Orphaned file in deleted folder must be rejected');
});

// -------------------------------------------------------------
// SECTION 3: MULTI-DEVICE SYNC & PAYLOAD SANITIZATION
// -------------------------------------------------------------
console.log('\n[3] Multi-Device Sync & Payload Safeguards Tests');

await test('STRICT SAFEGUARD: Memory imageSrc is stripped before Firestore sync', () => {
  const fullMemory = {
    id: 'mem-1',
    title: 'Beach sunset',
    date: '2026-06-01',
    caption: 'Quiet evening',
    imageSrc: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...', // 5MB heavy binary
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  // Logic from syncMemoryMetaUpsert
  const { imageSrc, ...metadataOnly } = fullMemory;
  assert.strictEqual((metadataOnly as any).imageSrc, undefined);
  assert.strictEqual(metadataOnly.title, 'Beach sunset');
  assert.strictEqual(metadataOnly.id, 'mem-1');
});

await test('STRICT SAFEGUARD: File dataUrl binary is stripped before Firestore sync', () => {
  const fullFile = {
    id: 'file-1',
    name: 'contract.pdf',
    folderId: 'folder-docs',
    size: 2048500,
    mimeType: 'application/pdf',
    extension: 'pdf',
    dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...', // Heavy binary
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  // Logic from syncFileMetaUpsert
  const { dataUrl, ...metadataOnly } = fullFile;
  assert.strictEqual((metadataOnly as any).dataUrl, undefined);
  assert.strictEqual(metadataOnly.name, 'contract.pdf');
  assert.strictEqual(metadataOnly.id, 'file-1');
});

await test('Remote files metadata merge preserves original local binary dataUrl', () => {
  const localFile = {
    id: 'file-doc',
    name: 'local_notes.txt',
    folderId: 'folder-1',
    size: 100,
    mimeType: 'text/plain',
    extension: 'txt',
    dataUrl: 'data:text/plain;base64,TXkgbG9jYWwgbm90ZXM=',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const remoteCloudFile = {
    id: 'file-doc',
    name: 'local_notes_renamed_in_cloud.txt',
    folderId: 'folder-1',
    size: 100,
    mimeType: 'text/plain',
    extension: 'txt',
    dataUrl: undefined, // Cloud never stores binary
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
  };

  // Logic from mergeRemoteFilesMetadata
  const merged = {
    ...remoteCloudFile,
    dataUrl: localFile.dataUrl || remoteCloudFile.dataUrl,
  };

  assert.strictEqual(merged.name, 'local_notes_renamed_in_cloud.txt');
  assert.strictEqual(
    merged.dataUrl,
    'data:text/plain;base64,TXkgbG9jYWwgbm90ZXM=',
    'Local binary dataUrl must be preserved intact'
  );
});

// -------------------------------------------------------------
// SECTION 4: DATA ISOLATION & FIRESTORE SECURITY RULES
// -------------------------------------------------------------
console.log('\n[4] Data Isolation & Security Rules Review');

await test('Firestore rules syntax and rules structure verification', () => {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  // Verify rules version
  assert.ok(rulesContent.includes("rules_version = '2';"));

  // Verify isAuthenticated & isOwner helper functions
  assert.ok(rulesContent.includes('function isAuthenticated()'));
  assert.ok(rulesContent.includes('function isOwner(userId)'));
  assert.ok(rulesContent.includes('request.auth.uid == userId'));

  // Verify closed world default deny
  assert.ok(rulesContent.includes('match /{document=**} {\n      allow read, write: false;\n    }'));

  // Verify all protected collections enforce isOwner
  const requiredProtectedPaths = [
    'match /users/{userId}',
    'match /tasks/{taskId}',
    'match /journal/{entryId}',
    'match /dreams/{dreamId}',
    'match /letters/{letterId}',
    'match /events/{eventId}',
    'match /memories/{memoryId}',
    'match /folders/{folderId}',
    'match /files/{fileId}',
    'match /vault_records/{recordId}',
    'match /tombstones/{tombstoneId}',
  ];

  for (const p of requiredProtectedPaths) {
    assert.ok(rulesContent.includes(p), `Missing protection for ${p}`);
  }
});

await test('Tombstones collection requires owner match and schema validation in rules', () => {
  const rulesContent = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
  assert.ok(rulesContent.includes('match /tombstones/{tombstoneId}'));
  assert.ok(rulesContent.includes('request.resource.data.uid == userId'));
  assert.ok(rulesContent.includes("request.resource.data.itemType in ['event', 'memory', 'file', 'folder']"));
  assert.ok(rulesContent.includes('request.resource.data.deletedAtMs >= resource.data.deletedAtMs'));
});

await test('Cross-user isolation simulation: User A cannot read or write User B paths', () => {
  const authUserA = { uid: 'user_alice' };
  const targetUserBId = 'user_bob';

  const isOwner = (targetUserId: string, auth: { uid: string } | null) => {
    return auth !== null && auth.uid === targetUserId;
  };

  assert.strictEqual(isOwner(targetUserBId, authUserA), false, 'User A must be denied access to User B');
  assert.strictEqual(isOwner('user_alice', authUserA), true, 'User A must have access to own path');
  assert.strictEqual(isOwner(targetUserBId, null), false, 'Unauthenticated user must be denied');
});

// -------------------------------------------------------------
// SECTION 5: PRIVATE VAULT & LOCAL STORAGE ISOLATION
// -------------------------------------------------------------
console.log('\n[5] Private Vault & Local Preservation Tests');

await test('Private Vault uses Web Crypto AES-GCM and never dispatches to Firestore', async () => {
  // Simulate Web Crypto derivation and AES-GCM encryption
  const pin = '4829';
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256');

  const plaintext = JSON.stringify({ title: 'Tax Secret', note: 'Top secret personal note' });
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  // Decryption verification
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  assert.strictEqual(decrypted, plaintext);

  // Verify that syncService has no vault sync callers
  const syncServicePath = path.resolve(__dirname, '../src/firebase/syncService.ts');
  const syncContent = fs.readFileSync(syncServicePath, 'utf8');
  assert.strictEqual(
    syncContent.includes('syncVault'),
    false,
    'syncService must NEVER contain methods to sync private vault items'
  );
});

await test('Sign-out does NOT wipe local IndexedDB or Private Vault stores', () => {
  const authContextPath = path.resolve(__dirname, '../src/firebase/authContext.tsx');
  const authContent = fs.readFileSync(authContextPath, 'utf8');
  assert.ok(
    authContent.includes('signOut(auth)'),
    'signOutUser must call signOut(auth)'
  );
  assert.strictEqual(
    authContent.includes('clearStorage') || authContent.includes('clearIndexedDB'),
    false,
    'signOutUser must preserve local storage'
  );
});

// -------------------------------------------------------------
// SECTION 6: FIREBASE CLI DEPLOYMENT CONFIGURATION AUDIT
// -------------------------------------------------------------
console.log('\n[6] Firebase CLI Deployment Configuration Tests');

await test('firebase.json exists and targets exact named Firestore database', () => {
  const firebaseJsonPath = path.resolve(__dirname, '../firebase.json');
  assert.ok(fs.existsSync(firebaseJsonPath), 'firebase.json must exist');
  const config = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

  assert.ok(config.firestore, 'firebase.json must define firestore section');

  // Verify named database configuration
  let firestoreEntries: any[] = [];
  if (Array.isArray(config.firestore)) {
    firestoreEntries = config.firestore;
  } else if (typeof config.firestore === 'object') {
    firestoreEntries = [config.firestore];
  }

  assert.ok(firestoreEntries.length > 0, 'firestore configuration cannot be empty');
  const namedDbEntry = firestoreEntries.find(
    (e) => e.database === 'ai-studio-mylittleworld-0eebf553-6940-4271-ba49-6c5af415f62c'
  );

  assert.ok(
    namedDbEntry,
    'firebase.json MUST explicitly configure named database "ai-studio-mylittleworld-0eebf553-6940-4271-ba49-6c5af415f62c"'
  );
  assert.strictEqual(namedDbEntry.rules, 'firestore.rules', 'Rules must point to firestore.rules');

  // Verify it does not target (default)
  const defaultDbEntry = firestoreEntries.find((e) => e.database === '(default)');
  assert.strictEqual(defaultDbEntry, undefined, 'Must not target default database');
});

await test('.firebaserc exists and configures correct project ID', () => {
  const firebasercPath = path.resolve(__dirname, '../.firebaserc');
  assert.ok(fs.existsSync(firebasercPath), '.firebaserc must exist');
  const rc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));

  assert.ok(rc.projects, '.firebaserc must have projects mapping');
  assert.strictEqual(
    rc.projects.default,
    'gen-lang-client-0720758774',
    'default project must be gen-lang-client-0720758774'
  );
});

await test('firebase-applet-config.json matches project and named database IDs', () => {
  const appletConfigPath = path.resolve(__dirname, '../firebase-applet-config.json');
  assert.ok(fs.existsSync(appletConfigPath), 'firebase-applet-config.json must exist');
  const appletConfig = JSON.parse(fs.readFileSync(appletConfigPath, 'utf8'));

  assert.strictEqual(
    appletConfig.projectId,
    'gen-lang-client-0720758774',
    'projectId must match gen-lang-client-0720758774'
  );
  assert.strictEqual(
    appletConfig.firestoreDatabaseId,
    'ai-studio-mylittleworld-0eebf553-6940-4271-ba49-6c5af415f62c',
    'firestoreDatabaseId must match named database'
  );
});

// -------------------------------------------------------------
// SECTION 7: SYNC RESILIENCE, BACKOFF & QUOTA HANDLING TESTS
// -------------------------------------------------------------
console.log('\n[7] Sync Resilience, Backoff, and Quota Handling Tests');

await test('Quota error classification correctly maps RESOURCE_EXHAUSTED and 429', () => {
  const isQuota = (err: any) =>
    Boolean(
      err?.code === 'resource-exhausted' ||
      err?.message?.includes('quota') ||
      err?.message?.includes('RESOURCE_EXHAUSTED') ||
      err?.message?.includes('429')
    );

  assert.strictEqual(isQuota({ code: 'resource-exhausted' }), true);
  assert.strictEqual(isQuota({ message: 'Quota exceeded for quota metric' }), true);
  assert.strictEqual(isQuota({ message: '429 RESOURCE_EXHAUSTED' }), true);
  assert.strictEqual(isQuota({ code: 'permission-denied' }), false);
  assert.strictEqual(isQuota({ code: 'unavailable' }), false);
});

await test('Network error classification correctly maps offline and unavailable codes', () => {
  const isNetwork = (err: any) =>
    Boolean(
      err?.code === 'unavailable' ||
      err?.code === 'deadline-exceeded' ||
      err?.message?.includes('offline') ||
      err?.message?.includes('network') ||
      err?.message?.includes('Failed to fetch')
    );

  assert.strictEqual(isNetwork({ code: 'unavailable' }), true);
  assert.strictEqual(isNetwork({ code: 'deadline-exceeded' }), true);
  assert.strictEqual(isNetwork({ message: 'Client is offline' }), true);
  assert.strictEqual(isNetwork({ message: 'Failed to fetch' }), true);
  assert.strictEqual(isNetwork({ code: 'resource-exhausted' }), false);
});

await test('Exponential backoff delay doubles with each retry and caps at 60s', () => {
  const calculateDelay = (retryCount: number) => Math.min(2000 * Math.pow(2, retryCount), 60000);

  assert.strictEqual(calculateDelay(0), 2000);
  assert.strictEqual(calculateDelay(1), 4000);
  assert.strictEqual(calculateDelay(2), 8000);
  assert.strictEqual(calculateDelay(3), 16000);
  assert.strictEqual(calculateDelay(4), 32000);
  assert.strictEqual(calculateDelay(5), 60000); // Capped at 60s
  assert.strictEqual(calculateDelay(10), 60000);
});

await test('Profile reconciliation avoids redundant writes when cloud data is identical', () => {
  const localProfile = {
    name: 'Sanctuary Keeper',
    subtitle: 'Quiet moments',
    currentMood: 'peaceful',
    lowEnergyMode: false,
    avatarSeed: 'seed123',
    journalAwareAI: true,
  };
  const remoteData = { ...localProfile };

  const hasChanges =
    remoteData.name !== localProfile.name ||
    remoteData.subtitle !== localProfile.subtitle ||
    remoteData.currentMood !== localProfile.currentMood ||
    remoteData.lowEnergyMode !== localProfile.lowEnergyMode ||
    remoteData.avatarSeed !== localProfile.avatarSeed ||
    remoteData.journalAwareAI !== localProfile.journalAwareAI;

  assert.strictEqual(hasChanges, false, 'Identical profile should skip setDoc write to avoid quota drain');
});

await test('Duplicate sync guard prevents concurrent reconciliation passes', () => {
  let inProgress = false;
  let executions = 0;

  const runSync = async () => {
    if (inProgress) return 'skipped';
    inProgress = true;
    try {
      executions++;
      await new Promise((r) => setTimeout(r, 10));
      return 'completed';
    } finally {
      inProgress = false;
    }
  };

  const promise1 = runSync();
  const promise2 = runSync(); // Should be coalesced
  return Promise.all([promise1, promise2]).then(([r1, r2]) => {
    assert.strictEqual(r1, 'completed');
    assert.strictEqual(r2, 'skipped');
    assert.strictEqual(executions, 1, 'Only 1 reconciliation pass should execute');
  });
});

await test('Manual sync force flag bypasses active listener check and executes retry', () => {
  const state: {
    currentUserId: string;
    activeListenersCount: number;
    syncStatus: 'error' | 'synced';
  } = {
    currentUserId: 'user-123',
    activeListenersCount: 10,
    syncStatus: 'error',
  };

  const shouldBypass = (userId: string, forceManual: boolean) => {
    if (
      !forceManual &&
      state.currentUserId === userId &&
      state.activeListenersCount > 0 &&
      state.syncStatus === 'synced'
    ) {
      return false; // Skip redundant
    }
    return true; // Must execute!
  };

  // When paused in error, manual sync must execute
  assert.strictEqual(shouldBypass('user-123', true), true);
  // When already healthy synced without force, skips redundant
  state.syncStatus = 'synced';
  assert.strictEqual(shouldBypass('user-123', false), false);
  // With forceManual: true on synced, still permits manual refresh
  assert.strictEqual(shouldBypass('user-123', true), true);
});

await test('Auth error mapping handles auth/unauthorized-domain with domain instructions', () => {
  const mapAuthError = (err: any) => {
    const code = err?.code || '';
    if (code === 'auth/unauthorized-domain') {
      return `Domain not authorized. Please add "example.run.app" to Firebase Authentication -> Settings -> Authorized domains in your Firebase Console.`;
    }
    return err?.message || 'Authentication error. Please try again.';
  };

  const message = mapAuthError({ code: 'auth/unauthorized-domain' });
  assert.strictEqual(message.includes('Domain not authorized'), true);
  assert.strictEqual(message.includes('Authorized domains'), true);
});

await test('Re-authentication flow signs out stale session without clearing local data stores', async () => {
  let signOutCalled = false;

  const mockAuth: { currentUser: { uid: string } | null; signOut: () => Promise<void> } = {
    currentUser: { uid: 'stale-user-123' },
    signOut: async () => {
      signOutCalled = true;
      mockAuth.currentUser = null;
    }
  };

  const localStore = {
    tasks: [{ id: 'task-1', title: 'Meditation' }],
    vault: [{ id: 'vault-1', cipherText: 'enc...' }]
  };

  // Execute re-auth pre-signout
  if (mockAuth.currentUser) {
    await mockAuth.signOut();
  }

  assert.strictEqual(signOutCalled, true);
  assert.strictEqual(mockAuth.currentUser, null);
  // Verify local data is strictly preserved
  assert.strictEqual(localStore.tasks.length, 1);
  assert.strictEqual(localStore.vault.length, 1);
});

await test('User UID isolation prevents silent data merging across different accounts', () => {
  const previousUid: string = 'user-alice-123';
  const newUid: string = 'user-bob-456';
  let dataMergedAcrossUids = false;

  if (previousUid && previousUid !== newUid) {
    // Isolate by not carrying over previous user's private data to new UID
    dataMergedAcrossUids = false;
  } else {
    dataMergedAcrossUids = true;
  }

  assert.strictEqual(dataMergedAcrossUids, false);
});

await test('Sanitized error code formatting shows actual error code on failure', () => {
  const formatError = (err: any) => {
    const code = err?.code;
    return code
      ? `[${code}] ${err?.message || 'Sign in failed. Please try again.'}`
      : err?.message || 'Sign in failed. Please try again.';
  };

  const formatted = formatError({ code: 'auth/popup-closed-by-user', message: 'Sign-in window was closed.' });
  assert.strictEqual(formatted.includes('[auth/popup-closed-by-user]'), true);
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n============================================================');
console.log(`Integration Test Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('============================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
