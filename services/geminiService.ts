/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { UrlContextMetadataItem, GroundingChunk, KnowledgeFile, PersonalRule } from '../types';

interface GeminiResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  groundingChunks?: GroundingChunk[];
}

export const selectRelevantDocuments = async (
  query: string,
  documents: { id: string; name: string }[],
): Promise<string[]> => {
  const response = await fetch("/api/gemini/select-documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, documents }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to select documents");
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
  folderContext: string = "",
  activeGroupAddress: string = "",
): Promise<GeminiResponse> => {
  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      prompt, 
      urls, 
      files, 
      useSearch, 
      personalRules, 
      folderContext, 
      activeGroupAddress 
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate content");
  }

  return response.json();
};

export const getInitialSuggestions = async (urls: string[], folderName: string = ""): Promise<GeminiResponse> => {
  const response = await fetch("/api/gemini/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, folderName }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to get suggestions");
  }

  return response.json();
};

export const extractPrinciples = async (conversation: string): Promise<string[]> => {
  const response = await fetch("/api/gemini/extract-principles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to extract principles");
  }

  const data = await response.json();
  return data.principles || [];
};

export const analyzeProjectAddress = async (
  address: string, 
  libraryFolders: { id: string; name: string }[] = []
): Promise<{ suggestedLaws: string[], matchedLibraryFolderIds: string[] }> => {
  const response = await fetch("/api/gemini/analyze-address", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, libraryFolders }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to analyze address");
  }

  return response.json();
};

