import OpenAI from 'openai';
import {
  GroundingChunk,
  KnowledgeFile,
  PersonalRule,
  UrlContextMetadataItem,
} from '../types';

const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-5-mini';
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }

  if (!openai) {
    openai = new OpenAI({ apiKey });
  }

  return openai;
}

type StructuredSchema = Record<string, unknown>;

async function createStructuredResponse<T>(options: {
  name: string;
  schema: StructuredSchema;
  instructions: string;
  input: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const response = await getOpenAI().responses.create({
    model: MODEL_NAME,
    instructions: options.instructions,
    input: options.input,
    max_output_tokens: options.maxOutputTokens || 1_200,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: options.name,
        strict: true,
        schema: options.schema,
      },
    },
  } as any);

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error('OpenAI returned an empty structured response.');
  }

  return JSON.parse(text) as T;
}

function toFileDataUri(file: KnowledgeFile): string | null {
  const value = file.base64Data;
  if (!value) return null;
  if (value.startsWith('data:')) return value;

  const mimeType = file.mimeType || 'application/octet-stream';
  return `data:${mimeType};base64,${value}`;
}

function buildFileContent(files: KnowledgeFile[]): any[] {
  const content: any[] = [];

  for (const file of files) {
    const fileData = toFileDataUri(file);
    if (!fileData) continue;

    if (file.mimeType?.startsWith('image/')) {
      content.push({
        type: 'input_image',
        image_url: fileData,
        detail: 'auto',
      });
      continue;
    }

    content.push({
      type: 'input_file',
      file_data: fileData,
      filename: file.name || 'document',
    });
  }

  return content;
}

function extractGroundingChunks(response: any): GroundingChunk[] | undefined {
  const chunks: GroundingChunk[] = [];
  const seen = new Set<string>();

  for (const item of response.output || []) {
    if (item.type !== 'message') continue;

    for (const content of item.content || []) {
      if (content.type !== 'output_text') continue;

      for (const annotation of content.annotations || []) {
        if (annotation.type !== 'url_citation') continue;

        const uri = annotation.url || annotation.url_citation?.url;
        if (!uri || seen.has(uri)) continue;

        seen.add(uri);
        chunks.push({
          web: {
            uri,
            title:
              annotation.title || annotation.url_citation?.title || uri,
          },
        });
      }
    }
  }

  return chunks.length > 0 ? chunks : undefined;
}

export async function selectRelevantDocuments({
  query,
  documents = [],
}: {
  query: string;
  documents: { id: string; name: string }[];
}): Promise<string[]> {
  const result = await createStructuredResponse<{ selected_ids: string[] }>({
    name: 'document_selection',
    instructions:
      'Select only the document IDs most relevant to the user query. Never invent an ID.',
    input: `사용자 질문:\n${query}\n\n선택 가능한 문서 목록:\n${JSON.stringify(documents)}\n\n가장 관련 있는 문서를 최대 20개 선택하세요.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        selected_ids: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['selected_ids'],
    },
  });

  const validIds = new Set(documents.map((document) => document.id));
  return result.selected_ids
    .filter((id) => validIds.has(id))
    .slice(0, 20);
}

export async function generateContent({
  prompt,
  urls = [],
  files = [],
  useSearch = false,
  personalRules = [],
  folderContext = '',
  activeGroupAddress = '',
}: {
  prompt: string;
  urls?: string[];
  files?: KnowledgeFile[];
  useSearch?: boolean;
  personalRules?: PersonalRule[];
  folderContext?: string;
  activeGroupAddress?: string;
}): Promise<{
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  groundingChunks?: GroundingChunk[];
}> {
  const activeRules = personalRules
    .filter((rule) => rule.isActive)
    .map((rule) => rule.text)
    .join('\n');

  const instructions = `당신은 대한민국 건축가를 위한 건축 법규 검토 AI 어시스턴트입니다.

답변 원칙:
1. 모든 답변은 한국어로 작성합니다.
2. 건축법, 국토계획법, 관련 시행령·규칙·지자체 조례를 함께 검토합니다.
3. 법령명과 조문을 자연스럽게 밝혀 근거를 명확히 합니다.
4. 확실하지 않은 내용은 추측하지 않고 추가 확인이 필요하다고 밝힙니다.
5. 제공된 문서와 URL을 우선 사용하고, 웹 검색이 허용된 경우 최신 공식 출처를 확인합니다.
6. 검색 과정이나 내부 처리 과정은 설명하지 않고 최종 검토 결과만 제시합니다.
${activeRules ? `\n사용자의 개인 작업 원칙:\n${activeRules}` : ''}
${folderContext ? `\n현재 프로젝트/폴더: ${folderContext}` : ''}
${activeGroupAddress ? `\n대상지 주소: ${activeGroupAddress}` : ''}`;

  const urlsForContext = urls.slice(0, 20);
  const urlContext = urlsForContext.length
    ? `\n\n우선 검토할 URL:\n${urlsForContext.join('\n')}`
    : '';

  const inputContent: any[] = [
    {
      type: 'input_text',
      text: `${prompt}${urlContext}`,
    },
    ...buildFileContent(files),
  ];

  const request: any = {
    model: MODEL_NAME,
    instructions,
    input: [
      {
        role: 'user',
        content: inputContent,
      },
    ],
    max_output_tokens: 6_000,
    store: false,
  };

  if (useSearch || urlsForContext.length > 0) {
    request.tools = [
      {
        type: 'web_search',
        search_context_size: 'medium',
      },
    ];
  }

  const response = await getOpenAI().responses.create(request);
  const text = response.output_text?.trim();

  if (!text) {
    throw new Error('OpenAI returned an empty response.');
  }

  return {
    text,
    groundingChunks: extractGroundingChunks(response),
  };
}

export async function getInitialSuggestions({
  urls = [],
  folderName = '',
}: {
  urls?: string[];
  folderName?: string;
}): Promise<{ text: string }> {
  const urlsForPrompt = urls.slice(0, 20);
  const result = await createStructuredResponse<{ suggestions: string[] }>({
    name: 'initial_suggestions',
    instructions:
      'Generate 3 to 4 concise, actionable Korean questions for an architect. Return only the requested structure.',
    input: `현재 폴더: ${folderName}\n\n참고 URL:\n${urlsForPrompt.join('\n')}\n\n이 자료를 바탕으로 사용자가 물어볼 만한 구체적인 질문 3~4개를 제안하세요.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        suggestions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['suggestions'],
    },
  });

  return {
    text: JSON.stringify({ suggestions: result.suggestions.slice(0, 4) }),
  };
}

export async function extractPrinciples({
  conversation,
}: {
  conversation: string;
}): Promise<string[]> {
  const result = await createStructuredResponse<{ principles: string[] }>({
    name: 'personal_principles',
    instructions:
      'Extract 1 to 3 concise and actionable personal work principles in Korean.',
    input: `다음 대화에서 사용자가 중요하게 여기는 작업 원칙을 1~3개 추출하세요.\n\n${conversation}`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        principles: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['principles'],
    },
  });

  return result.principles.slice(0, 3);
}

export async function analyzeProjectAddress({
  address,
  libraryFolders = [],
}: {
  address: string;
  libraryFolders?: { id: string; name: string }[];
}): Promise<{
  suggestedLaws: string[];
  matchedLibraryFolderIds: string[];
}> {
  const result = await createStructuredResponse<{
    suggested_laws: string[];
    matched_folder_ids: string[];
  }>({
    name: 'address_analysis',
    instructions:
      'You are a Korean architectural regulation specialist. Suggest 3 to 5 laws and match only folder IDs that exist in the supplied list.',
    input: `프로젝트 주소:\n${address}\n\n사용자 라이브러리 폴더:\n${JSON.stringify(libraryFolders)}\n\n주소에 관련성이 높은 건축 법규 3~5개와 관련 폴더 ID를 제안하세요.`,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        suggested_laws: {
          type: 'array',
          items: { type: 'string' },
        },
        matched_folder_ids: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['suggested_laws', 'matched_folder_ids'],
    },
  });

  const validFolderIds = new Set(libraryFolders.map((folder) => folder.id));

  return {
    suggestedLaws: result.suggested_laws.slice(0, 5),
    matchedLibraryFolderIds: result.matched_folder_ids.filter((id) =>
      validFolderIds.has(id),
    ),
  };
}
