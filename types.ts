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
  retrievedUrl: string;
  urlRetrievalStatus: string;
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

export type ViewerConfig =
  | { type: 'none' }
  | { type: 'web'; url: string }
  | { type: 'file'; file: KnowledgeFile }
  | {
      type: 'law';
      target: string;
      lawId: string;
      article?: string;
    };

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  isLoading?: boolean;
  urlContext?: UrlContextMetadataItem[];
  groundingChunks?: GroundingChunk[];
  wasSearchEnabled?: boolean;
  suggestedRules?: string[];
  sessionId: string;
  groupId: string;
  uid: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  groupId: string;
  uid: string;
  isArchived: boolean;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  mimeType: string;
  /**
   * Transitional field used by the existing UI.
   * New uploads contain a storage:// reference, not Base64.
   * data: URIs remain supported only for legacy imports.
   */
  base64Data?: string;
  storageReference?: string;
  content?: string;
  type?: string;
  url?: string;
  size?: number;
  createdAt?: string;
}

export interface KnowledgeUrl {
  id: string;
  url: string;
  name: string;
}

export interface BuildingOverview {
  projectName?: string;
  location?: string;
  landCategory?: string;
  landArea?: string;
  mainUsage?: string;
  scale?: string;
  buildingHeight?: string;
  bcr?: string;
  far?: string;
  buildingArea?: string;
  totalFloorAreaForFar?: string;
  totalFloorArea?: {
    above?: string;
    below?: string;
    total?: string;
  };
  landscapingArea?: string;
  publicOpenSpace?: string;
  parkingCount?: {
    legal?: string;
    planned?: string;
    plannedRatio?: string;
  };
  legalValues?: {
    bcr?: string;
    far?: string;
    landscaping?: string;
    publicOpenSpace?: string;
    parking?: string;
    buildingArea?: string;
    totalFloorArea?: string;
  };
  targetValues?: {
    landArea?: string;
  };
  notes?: {
    landArea?: string;
    buildingArea?: string;
    totalFloorArea?: string;
    parking?: string;
  };
}

export interface URLGroup {
  id: string;
  name: string;
  urls: KnowledgeUrl[];
  files: KnowledgeFile[];
  parentId: string | null;
  projectAddress?: string;
  projectAddresses?: string[];
  lotArea?: string;
  siteInvestigation?: string;
  isProject?: boolean;
  uid?: string;
  createdAt?: number;
  buildingOverview?: BuildingOverview;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}
