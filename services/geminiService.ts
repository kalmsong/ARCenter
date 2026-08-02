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

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json();
    return new Error(data.error || fallback);
  } catch {
    return new Error(fallback);
  }
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
    throw await readError(response, 'Failed to select documents');
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
    throw await readError(response, 'Failed to generate content');
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
    throw await readError(response, 'Failed to get suggestions');
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
    throw await readError(response, 'Failed to extract principles');
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
    throw await readError(response, 'Failed to analyze address');
  }

  return response.json();
};
