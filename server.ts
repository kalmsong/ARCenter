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
} from './services/openaiServer';
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

function buildQuery(req: Request, defaults?: Record<string, string>): string {
  const query = new URLSearchParams(defaults);

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') query.append(key, item);
      }
    }
  }

  const value = query.toString();
  return value ? `?${value}` : '';
}

async function proxyAirtect(
  req: Request,
  res: Response,
  endpoint: string,
  init?: RequestInit,
  accept = 'application/json',
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${AIRTECT_API_BASE_URL}${endpoint}`, {
      ...init,
      headers: {
        Accept: accept,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
    });

    const contentType = upstream.headers.get('content-type') || '';
    const contentDisposition = upstream.headers.get('content-disposition');

    res.status(upstream.status);
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    if (contentType.includes('application/json')) {
      res.json(await upstream.json());
      return;
    }

    if (
      contentType.startsWith('text/') ||
      contentType.includes('application/xml') ||
      contentType.includes('text/html')
    ) {
      res.send(await upstream.text());
      return;
    }

    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    const status =
      error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    console.error('Airtect proxy failed:', {
      endpoint,
      status,
      error: safeJsonError(error),
    });
    res.status(status).json({ error: safeJsonError(error) });
  } finally {
    clearTimeout(timeout);
  }
}

function registerAiRoutes(app: express.Express, prefix: string) {
  app.post(`${prefix}/generate`, async (req, res) => {
    try {
      const files = await hydrateKnowledgeFiles(
        req.body.files || [],
        req.authUser!.id,
      );
      res.json(await generateContent({ ...req.body, files }));
    } catch (error) {
      console.error('OpenAI generation failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.post(`${prefix}/select-documents`, async (req, res) => {
    try {
      const selectedIds = await selectRelevantDocuments(req.body);
      res.json({ selected_ids: selectedIds });
    } catch (error) {
      console.error('OpenAI document selection failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  const suggestionsHandler = async (req: Request, res: Response) => {
    try {
      res.json(await getInitialSuggestions(req.body));
    } catch (error) {
      console.error('OpenAI suggestion generation failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  };

  app.post(`${prefix}/suggestions`, suggestionsHandler);
  app.post(`${prefix}/initial-suggestions`, suggestionsHandler);

  app.post(`${prefix}/extract-principles`, async (req, res) => {
    try {
      const principles = await extractPrinciples(req.body);
      res.json({ principles });
    } catch (error) {
      console.error('OpenAI principle extraction failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });

  app.post(`${prefix}/analyze-address`, async (req, res) => {
    try {
      res.json(await analyzeProjectAddress(req.body));
    } catch (error) {
      console.error('OpenAI address analysis failed:', error);
      res.status(500).json({ error: safeJsonError(error) });
    }
  });
}

function registerAirtectRoutes(app: express.Express) {
  app.get('/api/airtect/health', async (req, res) => {
    await proxyAirtect(req, res, '/health');
  });

  app.get('/api/airtect/land/info', async (req, res) => {
    if (typeof req.query.address !== 'string' || !req.query.address.trim()) {
      res.status(400).json({ error: 'Missing address.' });
      return;
    }

    await proxyAirtect(
      req,
      res,
      `/land_info${buildQuery(req, { address_type: 'road' })}`,
    );
  });

  app.get('/api/airtect/law_search', async (req, res) => {
    if (
      typeof req.query.target !== 'string' ||
      typeof req.query.law_id !== 'string'
    ) {
      res.status(400).json({ error: 'Missing target or law_id.' });
      return;
    }

    await proxyAirtect(req, res, `/law_search${buildQuery(req)}`);
  });

  app.get('/api/airtect/applicable_laws', async (req, res) => {
    if (typeof req.query.address !== 'string' || !req.query.address.trim()) {
      res.status(400).json({ error: 'Missing address.' });
      return;
    }

    await proxyAirtect(
      req,
      res,
      `/applicable_laws${buildQuery(req, { address_type: 'road' })}`,
    );
  });

  app.get('/api/airtect/overview', async (req, res) => {
    await proxyAirtect(
      req,
      res,
      `/overview${buildQuery(req, { address_type: 'road' })}`,
    );
  });

  app.get('/api/airtect/feasibility', async (req, res) => {
    await proxyAirtect(
      req,
      res,
      `/feasibility${buildQuery(req, {
        address_type: 'road',
        mode: 'detailed',
      })}`,
    );
  });

  app.get('/api/airtect/site_shp', async (req, res) => {
    await proxyAirtect(
      req,
      res,
      `/site_shp${buildQuery(req, { address_type: 'road' })}`,
      undefined,
      'application/octet-stream, application/zip, application/json',
    );
  });

  app.get('/api/airtect/land-eum', async (req, res) => {
    await proxyAirtect(req, res, `/land-eum${buildQuery(req)}`);
  });

  app.post('/api/airtect/applicable-laws', async (req, res) => {
    await proxyAirtect(req, res, '/applicable-laws', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
  });
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

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: process.env.ARCENTER_TEST_MODE === 'false' ? 'full' : 'limited',
    });
  });

  const aiLimiter = createUserRateLimit(20);
  const airtectLimiter = createUserRateLimit(60);
  const aiPrefixes = ['/api/ai', '/api/gemini'];

  app.use(aiPrefixes, authenticate, aiLimiter);
  app.use('/api/airtect', authenticate, airtectLimiter);

  for (const prefix of aiPrefixes) {
    registerAiRoutes(app, prefix);
  }
  registerAirtectRoutes(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const assetsPath = path.join(distPath, 'assets');

    app.use(
      '/assets',
      express.static(assetsPath, {
        maxAge: '1y',
        immutable: true,
      }),
    );
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
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
