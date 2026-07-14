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

export type ViewerConfig = {
  type: 'none';
} | {
  type: 'web';
  url: string;
} | {
  type: 'file';
  file: KnowledgeFile;
} | {
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
  suggestedRules?: string[]; // AI가 제안한 새로운 원칙들
  sessionId: string; // Changed from groupId
  groupId: string;
  uid: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  groupId: string; // The Project/Folder it belongs to
  uid: string;
  isArchived: boolean;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  mimeType: string;
  base64Data?: string; // The full data URI: "data:mime/type;base64,..."
  content?: string; // Text content if it's text-based like markdown or json
  type?: string; 
  url?: string;
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
  landArea?: string; // Using string to support "29,482.00m² (8,918.31평)"
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
  lotArea?: string; // Supporting string for flexibility (e.g., "120m²")
  siteInvestigation?: string;
  isProject?: boolean; // New flag
  uid?: string;
  createdAt?: number;
  buildingOverview?: BuildingOverview;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
}