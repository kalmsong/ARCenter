/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GroundingChunk,
  KnowledgeFile,
  PersonalRule,
  UrlContextMetadataItem,
} from '../types';
import { authorizedFetch } from './authFetch';

interface AIResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  groundingChunks?: GroundingChunk[];
}

function friendlyApiMessage(status: number, message: string, fallback: string): string {
  if (status === 401) {
    return '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.';
  }

  if (status === 413) {
    return '첨부한 자료가 너무 큽니다. 파일 수나 용량을 줄여 다시 시도해 주세요.';
  }

  if (status === 429) {
    return '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.';
  }

  if (/model.*not found|does not exist|unsupported model/i.test(message)) {
    return '현재 설정된 AI 모델을 사용할 수 없습니다. 관리자에게 모델 설정을 확인해 달라고 요청해 주세요.';
  }

  if (/api key|OPENAI_API_KEY/i.test(message)) {
    return 'AI 서버 설정에 문제가 있습니다. 관리자에게 API 설정 확인을 요청해 주세요.';
  }

  if (status >= 500) {
    return `임시 서버에서 응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.${message ? ` (${message})` : ''}`;
  }

  return message || fallback;
}

async function readError(response: Response, fallback: string): Promise<Error> {
  let message = '';

  try {
    const data = await response.json();
    message = typeof data?.error === 'string' ? data.error : '';
  } catch {
    message = '';
  }

  return new Error(friendlyApiMessage(response.status, message, fallback));
}

export const selectRelevantDocuments = async (
  query: string,
  documents: { id: string; name: string }[],
): Promise<string[]> => {
  const response = await authorizedFetch('/api/ai/select-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, documents }),
  });

  if (!response.ok) {
    throw await readError(response, '관련 자료를 선별하지 못했습니다.');
  }

  const data = await response.json();
  return data.selected_ids || [];
};

export const generateContent = async (
  prompt: string,
  urls: string[],
  files: KnowledgeFile[],
  useSearch: boolean,
  personalRules: PersonalRule[] = [],
  folderContext = '',
  activeGroupAddress = '',
): Promise<AIResponse> => {
  const response = await authorizedFetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      urls,
      files,
      useSearch,
      personalRules,
      folderContext,
      activeGroupAddress,
    }),
  });

  if (!response.ok) {
    throw await readError(response, 'AI 답변 생성에 실패했습니다.');
  }

  return response.json();
};

export const getInitialSuggestions = async (
  urls: string[],
  folderName = '',
): Promise<AIResponse> => {
  const response = await authorizedFetch('/api/ai/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, folderName }),
  });

  if (!response.ok) {
    throw await readError(response, '추천 질문을 만들지 못했습니다.');
  }

  return response.json();
};

export const extractPrinciples = async (
  conversation: string,
): Promise<string[]> => {
  const response = await authorizedFetch('/api/ai/extract-principles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation }),
  });

  if (!response.ok) {
    throw await readError(response, '작업 원칙을 추출하지 못했습니다.');
  }

  const data = await response.json();
  return data.principles || [];
};

export const analyzeProjectAddress = async (
  address: string,
  libraryFolders: { id: string; name: string }[] = [],
): Promise<{
  suggestedLaws: string[];
  matchedLibraryFolderIds: string[];
}> => {
  const response = await authorizedFetch('/api/ai/analyze-address', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, libraryFolders }),
  });

  if (!response.ok) {
    throw await readError(response, '주소 분석에 실패했습니다.');
  }

  return response.json();
};
