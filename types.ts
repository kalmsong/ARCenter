/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface UrlContextMetadataItem {
  retrievedUrl: string; // Changed from retrieved_url
  urlRetrievalStatus: string; // Changed from url_retrieval_status
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface PersonalRule {
  id: string;
  text: string;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  isLoading?: boolean;
  urlContext?: UrlContextMetadataItem[];
  groundingChunks?: GroundingChunk[];
  wasSearchEnabled?: boolean;
  suggestedRules?: string[]; // AI가 제안한 새로운 원칙들
  groupId: string;
  uid: string;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  mimeType: string;
  base64Data: string; // The full data URI: "data:mime/type;base64,..."
}

export interface KnowledgeUrl {
  id: string;
  url: string;
  name: string;
}

export interface URLGroup {
  id: string;
  name: string;
  urls: KnowledgeUrl[];
  files: KnowledgeFile[];
  parentId: string | null;
  projectAddress?: string;
  uid?: string;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}