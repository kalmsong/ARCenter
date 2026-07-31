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
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: '로그인 세션이 만료되었거나 유효하지 않습니다.' });
    return;
  }

  req.authUser = {
    id: user.id,
    email: user.email,
  };
  next();
}

function requireString(
  value: unknown,
  name: string,
  maxLength: number,
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} 값이 필요합니다.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${name} 값이 너무 깁니다.`);
  }
  return value;
}

function apiError(
  res: Response,
  error: unknown,
  publicMessage = '요청을 처리하지 못했습니다.',
) {
  console.error(error);
  const message =
    error instanceof Error && /필요합니다|너무 깁니다|허용/.test(error.message)
      ? error.message
      : publicMessage;
  res.status(message === publicMessage ? 500 : 400).json({ error: message });
}

function userRateLimit(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.authUser?.id || 'authenticated',
    message: {
      error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    },
  });
}

async function proxyAirtect(
  req: Request,
  res: Response,
  endpoint: string,
) {
  const target = new URL(endpoint, `${AIRTECT_API_BASE_URL.replace(/\/$/, '')}/`);

  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      target.searchParams.set(key, value);
    }
  }

  const method = req.method.toUpperCase();
  const options: RequestInit = {
    method,
    headers: {
      Accept: req.header('accept') || 'application/json',
      ...(method !== 'GET'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    options.body = JSON.stringify(req.body || {});
  }

  const response = await fetch(target, options);
  const contentType =
    response.headers.get('content-type') || 'application/octet-stream';

  res.status(response.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, no-store');

  if (contentType.includes('application/json')) {
    const text = await response.text();
    res.send(text);
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}

async function startServer() {
  assertSecureAirtectUrl();

  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const geminiLimiter = userRateLimit(60_000, 20);
  const airtectLimiter = userRateLimit(60_000, 60);

  app.use('/api/gemini', authenticate, geminiLimiter);
  app.use('/api/airtect', authenticate, airtectLimiter);

  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const prompt = requireString(req.body.prompt, 'prompt', 20_000);
      const urls = Array.isArray(req.body.urls) ? req.body.urls.slice(0, 20) : [];
      const files = Array.isArray(req.body.files) ? req.body.files.slice(0, 20) : [];
      const hydratedFiles = await hydrateKnowledgeFiles(files, req.authUser!.id);
      const result = await generateContent(
        prompt,
        urls,
        hydratedFiles,
        Boolean(req.body.useSearch),
        Array.isArray(req.body.personalRules) ? req.body.personalRules : [],
        typeof req.body.folderContext === 'string' ? req.body.folderContext : '',
        typeof req.body.activeGroupAddress === 'string'
          ? req.body.activeGroupAddress
          : '',
      );
      res.json(result);
    } catch (error) {
      apiError(res, error, 'AI 응답 생성에 실패했습니다.');
    }
  });

  app.post('/api/gemini/select-documents', async (req, res) => {
    try {
      const queryText = requireString(req.body.query, 'query', 10_000);
      const documents = Array.isArray(req.body.documents)
        ? req.body.documents.slice(0, 500)
        : [];
      const selectedIds = await selectRelevantDocuments(queryText, documents);
      res.json({ selected_ids: selectedIds });
    } catch (error) {
      apiError(res, error, '관련 자료 선별에 실패했습니다.');
    }
  });

  app.post('/api/gemini/suggestions', async (req, res) => {
    try {
      const urls = Array.isArray(req.body.urls) ? req.body.urls.slice(0, 20) : [];
      const folderName =
        typeof req.body.folderName === 'string'
          ? req.body.folderName.slice(0, 200)
          : '';
      res.json(await getInitialSuggestions(urls, folderName));
    } catch (error) {
      apiError(res, error, '질문 제안 생성에 실패했습니다.');
    }
  });

  app.post('/api/gemini/extract-principles', async (req, res) => {
    try {
      const conversation = requireString(
        req.body.conversation,
        'conversation',
        50_000,
      );
      res.json({ principles: await extractPrinciples(conversation) });
    } catch (error) {
      apiError(res, error, '개인 원칙 추출에 실패했습니다.');
    }
  });

  app.post('/api/gemini/analyze-address', async (req, res) => {
    try {
      const address = requireString(req.body.address, 'address', 1_000);
      const libraryFolders = Array.isArray(req.body.libraryFolders)
        ? req.body.libraryFolders.slice(0, 500)
        : [];
      res.json(await analyzeProjectAddress(address, libraryFolders));
    } catch (error) {
      apiError(res, error, '주소 분석에 실패했습니다.');
    }
  });

  app.get('/api/airtect/land/info', async (req, res) => {
    try {
      requireString(req.query.address, 'address', 1_000);
      req.query.address_type = req.query.address_type || 'road';
      await proxyAirtect(req, res, 'land_info');
    } catch (error) {
      apiError(res, error, '토지정보 조회에 실패했습니다.');
    }
  });

  app.get('/api/airtect/law_search', async (req, res) => {
    try {
      requireString(req.query.target, 'target', 30);
      requireString(req.query.law_id, 'law_id', 100);
      await proxyAirtect(req, res, 'law_search');
    } catch (error) {
      apiError(res, error, '법령 조회에 실패했습니다.');
    }
  });

  app.get('/api/airtect/applicable_laws', async (req, res) => {
    try {
      requireString(req.query.address, 'address', 1_000);
      req.query.address_type = req.query.address_type || 'road';
      await proxyAirtect(req, res, 'applicable_laws');
    } catch (error) {
      apiError(res, error, '적용 법규 조회에 실패했습니다.');
    }
  });

  for (const endpoint of ['overview', 'feasibility', 'site_shp'] as const) {
    app.get(`/api/airtect/${endpoint}`, async (req, res) => {
      try {
        requireString(req.query.address, 'address', 1_000);
        req.query.address_type = req.query.address_type || 'road';
        await proxyAirtect(req, res, endpoint);
      } catch (error) {
        apiError(res, error, 'Airtect 요청에 실패했습니다.');
      }
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
