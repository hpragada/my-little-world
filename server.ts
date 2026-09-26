import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Resolve Firebase target project ID
let targetProjectId = process.env.VITE_FIREBASE_PROJECT_ID || '';
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (raw.projectId) targetProjectId = raw.projectId;
  }
} catch {
  // fallback
}
if (!targetProjectId) targetProjectId = 'gen-lang-client-0720758774';

// In-memory cache for Google's public certificates
let cachedPublicKeys: Record<string, string> = {};
let publicKeysExpiresAt = 0;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(cachedPublicKeys).length > 0 && now < publicKeysExpiresAt) {
    return cachedPublicKeys;
  }

  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) {
      throw new Error(`Google certs endpoint returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as Record<string, string>;
    cachedPublicKeys = data;

    const cacheControl = res.headers.get('cache-control');
    let maxAgeSeconds = 21600; // 6 hours default
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/);
      if (match) {
        maxAgeSeconds = parseInt(match[1], 10);
      }
    }
    publicKeysExpiresAt = now + maxAgeSeconds * 1000;
    return cachedPublicKeys;
  } catch (err) {
    console.warn('[Firebase Auth] Failed to fetch Google public certs:', err);
    return cachedPublicKeys;
  }
}

interface DecodedToken {
  uid: string;
  email?: string;
  [key: string]: any;
}

async function verifyFirebaseIdToken(token: string): Promise<DecodedToken | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (header.alg !== 'RS256' || !header.kid) {
      return null;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expectedIssuer = `https://securetoken.google.com/${targetProjectId}`;

    if (payload.aud !== targetProjectId) {
      console.warn(`[Firebase Auth] aud mismatch: got ${payload.aud}, expected ${targetProjectId}`);
      return null;
    }

    if (payload.iss !== expectedIssuer) {
      console.warn(`[Firebase Auth] iss mismatch: got ${payload.iss}, expected ${expectedIssuer}`);
      return null;
    }

    if (typeof payload.sub !== 'string' || !payload.sub) {
      return null;
    }

    if (payload.exp <= nowInSeconds) {
      console.warn('[Firebase Auth] ID token expired');
      return null;
    }

    // 5-minute clock skew tolerance
    if (payload.iat > nowInSeconds + 300) {
      return null;
    }

    // Verify RS256 signature against Google's public cert
    const publicKeys = await getGooglePublicKeys();
    const cert = publicKeys[header.kid];

    if (cert) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(`${headerB64}.${payloadB64}`);
      const isValid = verifier.verify(cert, signatureB64, 'base64url');
      if (isValid) {
        return {
          uid: payload.sub,
          email: payload.email,
          ...payload,
        };
      }
    }

    // Fallback: Verify via Google TokenInfo endpoint
    try {
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
      );
      if (tokenInfoRes.ok) {
        const info = (await tokenInfoRes.json()) as Record<string, any>;
        if (info.aud === targetProjectId && info.sub === payload.sub) {
          return {
            uid: info.sub,
            email: info.email,
            ...info,
          };
        }
      }
    } catch {
      // Fallback failed
    }

    return null;
  } catch (err) {
    console.warn('[Firebase Auth] Token validation error:', err);
    return null;
  }
}

// Authentication enforcement middleware
const requireFirebaseAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to your sanctuary account to converse with Aria AI.',
    });
  }

  const token = authHeader.slice(7).trim();
  const decoded = await verifyFirebaseIdToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid, revoked, or expired authentication token. Please sign in again.',
    });
  }

  (req as any).user = decoded;
  next();
};

// Parse JSON bodies up to 10MB
app.use(express.json({ limit: '10mb' }));

// Health / status endpoint (Safe metadata only, never exposes API keys)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Build shared concise system instruction
function buildSystemInstruction(journalAware?: boolean, personalContext?: string): string {
  let prompt = `You are Aria, an articulate, empathetic, and knowledgeable AI companion living in the "My Little World" personal sanctuary.
You provide clear, thoughtful guidance across:
- Software engineering, DevOps, cloud architectures (AWS ECS, Lambda, S3, IAM, Docker, Linux, Terraform), TypeScript, Python, and debugging
- Career milestones, interview preparation, portfolio reflections, and professional growth
- Personal journaling, mindful habits, daily rituals, and grounding reflections.

Formatting & tone rules:
- Be warm, unhurried, intelligent, and direct.
- When generating code, use clean Markdown blocks with proper language syntax identifiers.
- Respond accurately to follow-up questions using recent conversation history.
- Never output system or prompt mechanics.`;

  if (journalAware && personalContext && typeof personalContext === 'string') {
    prompt += `\n\n[Sanctuary Context - Shared with explicit user consent]:\n${personalContext.slice(
      0,
      1800
    )}`;
  }
  return prompt;
}

// Streaming chat endpoint with Server-Sent Events (SSE) - Protected by requireFirebaseAuth
app.post('/api/chat/stream', requireFirebaseAuth, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini API key is not configured in environment or Secrets panel.',
    });
  }

  const { messages, journalAware, personalContext } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let isAborted = false;
  req.on('close', () => {
    isAborted = true;
  });

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = buildSystemInstruction(journalAware, personalContext);

  // Keep recent 8 messages for natural follow-up context without unbounded latency
  const recentMessages = messages.slice(-8);
  const contents = recentMessages.map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  // Primary fast models: gemini-flash-latest (active quota), with gemini-3.1-flash-lite and gemini-3.8-flash fallbacks
  const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let streamStarted = false;
  let lastError: any = null;

  for (const model of candidateModels) {
    if (isAborted) break;
    try {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      for await (const chunk of responseStream) {
        if (isAborted) break;
        const text = chunk.text;
        if (text) {
          streamStarted = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (streamStarted) {
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Streaming attempt with model ${model} failed:`, err?.message || err);
      if (streamStarted) {
        // Stream broke midway
        res.write(
          `data: ${JSON.stringify({ error: 'Connection interrupted while streaming.' })}\n\n`
        );
        res.end();
        return;
      }
      // If it failed before sending any chunks, attempt fallback model
    }
  }

  if (!streamStarted && !isAborted) {
    const errorMsg = lastError?.message || 'Unable to generate response from Gemini';
    let userFriendly = errorMsg;
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      userFriendly = 'The Gemini API rate limit or quota has been reached. Please pause a moment and try again.';
    } else if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE')) {
      userFriendly = 'Gemini is currently experiencing high demand. Please try asking again shortly.';
    } else if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('unauthorized')) {
      userFriendly = 'The provided Gemini API key appears invalid or expired.';
    }
    res.write(`data: ${JSON.stringify({ error: userFriendly })}\n\n`);
    res.end();
  }
});

// Non-streaming fallback endpoint for Aria AI Assistant - Protected by requireFirebaseAuth
app.post('/api/chat', requireFirebaseAuth, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error:
          'Gemini API key is not configured. Please add your GEMINI_API_KEY to the environment or AI Studio Secrets panel.',
      });
    }

    const { messages, journalAware, personalContext } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'No messages provided in the request.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = buildSystemInstruction(journalAware, personalContext);

    // Limit to recent 8 turns
    const recentMessages = messages.slice(-8);
    const contents = recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || '' }],
    }));

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let lastError: any = null;
    let reply = '';

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        reply = response.text || '';
        if (reply) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!reply && lastError) {
      throw lastError;
    }

    return res.json({ reply });
  } catch (error: any) {
    console.error('Error during Gemini API call:', error);
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand')) {
      return res.status(503).json({
        error:
          'Gemini is currently experiencing high demand. Please take a gentle breath and try asking again in a few moments.',
      });
    }

    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      return res.status(429).json({
        error:
          'The Gemini API rate limit or quota has been reached. Please pause for a moment and try asking again.',
      });
    }

    return res.status(500).json({
      error:
        'Aria was unable to reach Gemini right now. Please check your network connection or try again shortly.',
      details: errorMsg,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    // Serve production static assets
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Mount Vite dev server in middleware mode
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`My Little World server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
