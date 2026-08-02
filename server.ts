import 'dotenv/config';

import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  analyzeProjectAddress,
  extractPrinciples,
  generateContent,
  getInitialSuggestions,
  selectRelevantDocuments,
} from './services/geminiServer';
import { supabaseAdmin } from './services/supabaseServer';
import { hydrateKnowledgeFiles } from './services/knowledgeFileServer';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email?: string;
      };
    }
  }
}

const PORT = Number(process.env.PORT || 3000);
const AIRTECT_API_BASE_URL =
  process.env.AIRTECT_API_BASE_URL || 'https://api.airtect.kr';
const REQUEST_TIMEOUT_MS = 25_000;

function assertSecureAirtectUrl() {
  const url = new URL(AIRTECT_API_BASE_URL);
  if (
    url.protocol !== 'https:' &&
    process.env.ALLOW_INSECURE_AIRTECT !== 'true'
  ) {
    throw new Error(
      'AIRTECT_API_BASE_URL must use HTTPS. Set ALLOW_INSECURE_AIRTECT=true only for an isolated development network.',
    );
  }
}

async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const token = authorization.slice('Bearer '.length).trim();
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired access token.' });
      return;
    }

    req.authUser = {
      id: data.user.id,
      email: data.user.email,
    };
    next();
  } catch (error) {
    console.error('Authentication failed:', error);
    res.status(401).json({ error: 'Authentication failed.' });
  }
}

function createUserRateLimit(max: number) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.id || 'unauthenticated',
    message: { error: 'Too many requests. Please try again shortly.' },
  });
}

function safeJsonError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function proxyAirtect(
  req: Request,
  res: Response,
  endpoint: string,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${AIRTECT_API_BASE_URL}${endpoint}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
    });

    const contentType = upstream.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await upstream.json()
      : await upstream.text();

    res.status(upstream.status);
    if (typeof payload === 'string') {
      res.send(payload);
    } else {
      res.json(payload);
    }
  } catch (error) {
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ error: safeJsonError(error) });
  } finally {
    clearTimeout(timeout);
  }
}

async function startServer() {
  assertSecureAirtectUrl();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  const geminiLimiter = createUserRateLimit(20);
  const airtectLimiter = createUserRateLimit(60);

  app.use('/api/gemini', authenticate, geminiLimiter);
  app.use('/api/airtect', authenticate, airtectLimiter);

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const files = await hydrateKnowledgeFiles(req.body.files, req.authUser!.id);
      const response = await generateContent({ ...req.body, files });
      res.json(response);
    } catch (error) {
      console.error('Gemini generation failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.post('/api/gemini/select-documents', async (req, res) => {
    try {
      const response = await selectRelevantDocuments(req.body);
      res.json(response);
    } catch (error) {
      console.error('Gemini document selection failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.post('/api/gemini/initial-suggestions', async (req, res) => {
    try {
      res.json(await getInitialSuggestions(req.body));
    } catch (error) {
      console.error('Gemini suggestion generation failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.post('/api/gemini/extract-principles', async (req, res) => {
    try {
      res.json(await extractPrinciples(req.body));
    } catch (error) {
      console.error('Gemini principle extraction failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.post('/api/gemini/analyze-address', async (req, res) => {
    try {
      res.json(await analyzeProjectAddress(req.body));
    } catch (error) {
      console.error('Gemini address analysis failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.get('/api/airtect/land-eum', async (req, res) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') query.set(key, value);
    }
    await proxyAirtect(req, res, `/land-eum?${query.toString()}`);
  });

  app.post('/api/airtect/applicable-laws', async (req, res) => {
    await proxyAirtect(req, res, '/applicable-laws', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARCenter listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start ARCenter:', error);
  process.exit(1);
});
