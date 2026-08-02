import { GroundingChunk } from '../types';
import {
  buildPlanningIssueContext,
  PlanningLawReference,
} from './planningIssueRouter';

const AIRTECT_API_BASE_URL =
  process.env.AIRTECT_API_BASE_URL || 'https://api.airtect.kr';
const TEST_MODE = process.env.ARCENTER_TEST_MODE !== 'false';
const REQUEST_TIMEOUT_MS = Number(
  process.env.AIRTECT_EVIDENCE_TIMEOUT_MS || (TEST_MODE ? 8_000 : 15_000),
);
const MAX_LAW_REQUESTS = TEST_MODE ? 4 : 10;
const MAX_TOTAL_CONTEXT_CHARS = TEST_MODE ? 32_000 : 96_000;

type LawReference = PlanningLawReference & {
  officialUrl: string;
};

type EvidenceItem = {
  label: string;
  endpoint: string;
  officialUrl?: string;
  payload: unknown;
};

export type AirtectEvidenceResult = {
  context: string;
  sources: GroundingChunk[];
  successCount: number;
  attemptedCount: number;
  errors: string[];
  planningIssue?: string;
};

function officialUrlFor(reference: PlanningLawReference): string {
  return reference.target === 'ordin'
    ? `https://www.law.go.kr/ordinInfoP.do?ordinId=${encodeURIComponent(reference.lawId)}`
    : `https://www.law.go.kr/LSW/lsInfoP.do?lsId=${encodeURIComponent(reference.lawId)}`;
}

function parseLawReference(rawUrl: string): LawReference | null {
  try {
    if (rawUrl.startsWith('law://')) {
      const query = rawUrl.slice('law://'.length);
      const params = new URLSearchParams(query);
      const target = params.get('target') === 'ordin' ? 'ordin' : 'law';
      const lawId = params.get('law_id');
      if (!lawId) return null;

      const reference: PlanningLawReference = {
        target,
        lawId,
        title: target === 'ordin' ? `자치법규 ${lawId}` : `법령 ${lawId}`,
      };
      return { ...reference, officialUrl: officialUrlFor(reference) };
    }

    const url = new URL(rawUrl);
    const ordinanceId = url.searchParams.get('ordinId');
    if (ordinanceId) {
      const reference: PlanningLawReference = {
        target: 'ordin',
        lawId: ordinanceId,
        title: `자치법규 ${ordinanceId}`,
      };
      return { ...reference, officialUrl: officialUrlFor(reference) };
    }

    const lawId =
      url.searchParams.get('lsId') ||
      url.searchParams.get('law_id') ||
      url.searchParams.get('lawId');
    if (!lawId) return null;

    const reference: PlanningLawReference = {
      target: 'law',
      lawId,
      title: `법령 ${lawId}`,
    };
    return { ...reference, officialUrl: officialUrlFor(reference) };
  } catch {
    return null;
  }
}

function extractArticle(prompt: string): string | undefined {
  const match = prompt.match(/제?\s*(\d{1,4})(?:\s*조)(?:\s*의\s*(\d+))?/);
  if (!match) return undefined;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

function shouldFetchLandInfo(prompt: string): boolean {
  return /(대지|토지|필지|주소|용도지역|용도지구|용도구역|건폐율|용적률|지목|면적|토지이음|배치|개발가능)/.test(
    prompt,
  );
}

function trimString(value: string, max = 3_000): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function compactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[하위 데이터 생략]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') return trimString(value);

  if (Array.isArray(value)) {
    const limit = TEST_MODE ? 16 : 40;
    const compacted = value
      .slice(0, limit)
      .map((item) => compactValue(item, depth + 1));
    if (value.length > limit) {
      compacted.push(`[추가 ${value.length - limit}개 항목 생략]`);
    }
    return compacted;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const limit = TEST_MODE ? 40 : 100;
    const result: Record<string, unknown> = {};
    for (const [key, item] of entries.slice(0, limit)) {
      result[key] = compactValue(item, depth + 1);
    }
    if (entries.length > limit) {
      result.__omitted = `추가 ${entries.length - limit}개 필드 생략`;
    }
    return result;
  }

  return String(value);
}

function extractTitle(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const candidates = [
    'name',
    'title',
    'law_name',
    'lawName',
    'ordinance_name',
    '법령명',
    '법규명',
  ];

  const queue: unknown[] = [payload];
  let inspected = 0;

  while (queue.length > 0 && inspected < 80) {
    const current = queue.shift();
    inspected += 1;

    if (!current || typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;

    for (const key of candidates) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return trimString(value.trim(), 120);
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return fallback;
}

function extractProjectValue(
  projectContext: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!projectContext) return undefined;

  const queue: unknown[] = [projectContext];
  let inspected = 0;
  while (queue.length > 0 && inspected < 80) {
    const current = queue.shift();
    inspected += 1;
    if (!current || typeof current !== 'object') continue;

    const record = current as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return undefined;
}

async function fetchAirtectJson(endpoint: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${AIRTECT_API_BASE_URL}${endpoint}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${trimString(text, 300)}`);
    }

    if (!text.trim()) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { content: trimString(text, 8_000) };
    }
  } finally {
    clearTimeout(timer);
  }
}

function deduplicateSources(sources: GroundingChunk[]): GroundingChunk[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const uri = source.web?.uri;
    if (!uri || seen.has(uri)) return false;
    seen.add(uri);
    return true;
  });
}

function buildContext(items: EvidenceItem[]): string {
  if (items.length === 0) return '';

  let output =
    '\n\n다음은 외부 FastAPI가 반환한 구조화된 검토 근거입니다. 이 데이터를 우선 근거로 사용하고, 데이터에 없는 값은 추정하지 마세요.\n';

  for (const [index, item] of items.entries()) {
    const compacted = compactValue(item.payload);
    const section = [
      `\n[API 근거 ${index + 1}]`,
      `구분: ${item.label}`,
      item.officialUrl ? `원문 HTML: ${item.officialUrl}` : '',
      `API 경로: ${item.endpoint}`,
      `데이터: ${JSON.stringify(compacted)}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (output.length + section.length > MAX_TOTAL_CONTEXT_CHARS) {
      output += '\n[추가 API 근거는 테스트 한도에 따라 생략됨]';
      break;
    }
    output += section;
  }

  return output;
}

export async function buildAirtectEvidence(options: {
  prompt: string;
  urls: string[];
  activeGroupAddress?: string;
  projectContext?: Record<string, unknown>;
}): Promise<AirtectEvidenceResult> {
  const article = extractArticle(options.prompt);
  const errors: string[] = [];
  const evidence: EvidenceItem[] = [];
  const sources: GroundingChunk[] = [];
  const planningIssue = buildPlanningIssueContext(
    options.prompt,
    options.projectContext,
  );

  const issueReferences: LawReference[] = planningIssue.laws.map((reference) => ({
    ...reference,
    officialUrl: officialUrlFor(reference),
  }));
  const registeredReferences = options.urls
    .map(parseLawReference)
    .filter((item): item is LawReference => Boolean(item));

  // 문제 유형에 필요한 법령을 먼저 배치하고, 사용자가 등록한 HTML은 추가 근거로 합칩니다.
  const lawReferences = [...issueReferences, ...registeredReferences]
    .filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.target === item.target && candidate.lawId === item.lawId,
        ) === index,
    )
    .slice(0, MAX_LAW_REQUESTS);

  const tasks: Array<Promise<void>> = lawReferences.map(async (reference) => {
    const params = new URLSearchParams({
      target: reference.target,
      law_id: reference.lawId,
    });
    if (article) params.set('article', article);
    const endpoint = `/law_search?${params.toString()}`;

    try {
      const payload = await fetchAirtectJson(endpoint);
      const title = extractTitle(payload, reference.title);

      evidence.push({
        label: article ? `${title} 제${article.replace('-', '조의')} 관련 조문` : title,
        endpoint,
        officialUrl: reference.officialUrl,
        payload,
      });
      sources.push({
        web: {
          uri: reference.officialUrl,
          title: `법제처 원문 · ${title}`,
        },
      });
    } catch (error) {
      errors.push(
        `${reference.target}:${reference.lawId} - ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });

  const address =
    options.activeGroupAddress
      ?.split('\n')
      .map((item) => item.trim())
      .find(Boolean) ||
    extractProjectValue(options.projectContext, ['project_address', 'location']);

  if (address) {
    tasks.push(
      (async () => {
        const endpoint = `/applicable_laws?${new URLSearchParams({
          address,
          address_type: 'road',
        }).toString()}`;
        try {
          const payload = await fetchAirtectJson(endpoint);
          evidence.push({
            label: '대상지 적용 법령 API',
            endpoint,
            payload,
          });
        } catch (error) {
          errors.push(
            `applicable_laws - ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      })(),
    );

    if (planningIssue.profile) {
      tasks.push(
        (async () => {
          const params = new URLSearchParams({
            address,
            address_type: 'road',
          });
          const purpose = extractProjectValue(options.projectContext, [
            'mainUsage',
            'main_usage',
            'purpose',
          ]);
          if (purpose) params.set('purpose', purpose);
          const endpoint = `/overview?${params.toString()}`;
          try {
            const payload = await fetchAirtectJson(endpoint);
            evidence.push({
              label: '대상지 계획 개요 API',
              endpoint,
              payload,
            });
          } catch (error) {
            errors.push(
              `overview - ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        })(),
      );
    }

    if (shouldFetchLandInfo(options.prompt)) {
      tasks.push(
        (async () => {
          const endpoint = `/land_info?${new URLSearchParams({
            address,
            address_type: 'road',
          }).toString()}`;
          try {
            const payload = await fetchAirtectJson(endpoint);
            evidence.push({
              label: '대상지 토지·용도지역 정보 API',
              endpoint,
              payload,
            });
          } catch (error) {
            errors.push(
              `land_info - ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        })(),
      );
    }
  }

  await Promise.all(tasks);

  if (errors.length > 0) {
    console.warn('Some Airtect evidence requests failed:', errors);
  }

  // 원문 링크는 API 결과가 없더라도 사용자가 직접 확인할 수 있도록 제공합니다.
  for (const reference of lawReferences) {
    sources.push({
      web: {
        uri: reference.officialUrl,
        title: `법제처 원문 · ${reference.title}`,
      },
    });
  }

  return {
    context: `${planningIssue.context}${buildContext(evidence)}`,
    sources: deduplicateSources(sources),
    successCount: evidence.length,
    attemptedCount: tasks.length,
    errors,
    planningIssue: planningIssue.profile?.title,
  };
}
