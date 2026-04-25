/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { GoogleGenAI, GenerateContentResponse, Tool, HarmCategory, HarmBlockThreshold, Content, Part, Type } from "@google/genai";
import { UrlContextMetadataItem, GroundingChunk, KnowledgeFile, PersonalRule } from '../types';

// IMPORTANT: The API key MUST be set as an environment variable `process.env.API_KEY`
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

// Model supporting URL context, consistent with user examples and documentation.
const MODEL_NAME = "gemini-3-flash-preview"; 

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not set in environment variables. Please set process.env.API_KEY.");
    throw new Error("Gemini API 키가 설정되지 않았습니다. process.env.API_KEY를 설정하세요.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface GeminiResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  groundingChunks?: GroundingChunk[];
}

export const selectRelevantDocuments = async (
  query: string,
  documents: { id: string; name: string }[],
): Promise<string[]> => {
  const currentAi = getAiInstance();
  
  const systemInstruction = `You are an intelligent document routing assistant. Your task is to analyze a user's query and a list of available document titles, and then select the most relevant documents to answer the query. You must only select from the provided list. Your response must be a valid JSON object containing the IDs of the selected documents.`;

  // UPDATED: increased selection limit from 15 to 20 to reduce information loss
  const prompt = `Based on the user's query, select up to 20 of the most relevant documents from the list provided.
  
User Query: "${query}"
  
Available Documents:
${JSON.stringify(documents)}
  
Return a JSON object with a single key "selected_ids" which is an array of strings containing the IDs of the most relevant documents. For example: {"selected_ids": ["doc-1", "doc-3"]}`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selected_ids: {
              type: Type.ARRAY,
              description: 'An array of the string IDs of the most relevant documents.',
              items: {
                type: Type.STRING,
              },
            },
          },
          required: ['selected_ids'],
        },
      },
    });

    const jsonStr = response.text.trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.selected_ids)) {
      return parsed.selected_ids;
    }
    return [];
  } catch (error) {
    console.error("Error during document selection:", error);
    throw new Error(`관련 자료를 선별하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  const currentAi = getAiInstance();
  
  const activeRules = personalRules.filter(r => r.isActive).map(r => r.text).join('\n');
  const rulesInstruction = activeRules 
    ? `\n\n**사용자의 개인 원칙 (답변 시 반드시 반영하세요):**\n${activeRules}`
    : "";

  const tools: Tool[] = [];
  let contents: Content[];
  const contextHeader = folderContext ? `\n\n**현재 프로젝트/폴더 컨텍스트:**\n- 이름: ${folderContext}` : "";
  const addressHeader = activeGroupAddress ? `\n- 대상지 주소: ${activeGroupAddress}` : "";

  const systemInstruction = `당신은 대한민국 건축가들을 위한 전문 AI 어시스턴트 'Archi-Legal Assistant'입니다.
제공된 법령 URL, 파일, 그리고 Google 검색을 활용하여 건축 법규에 대해 정확하고 전문적인 답변을 한국어로 제공하는 것이 당신의 임무입니다.${rulesInstruction}${contextHeader}${addressHeader}

**핵심 동작 규칙:**
1. **한국어 전용:** 모든 답변은 반드시 한국어로만 작성하세요.
2. **동적 웹사이트 대응:** 국가법령정보센터(law.go.kr)와 같은 사이트는 URL 도구로 본문을 직접 읽기 어려울 수 있습니다. 만약 URL에서 "스크립트"나 "구조"만 보이고 본문이 없다면, 즉시 **Google 검색 도구**를 사용하여 해당 법령의 정확한 조항과 내용을 찾아 답변하세요.
3. **출처 명시:** 답변 중에 "건축법 제O조에 따르면..."과 같이 출처를 자연스럽게 언급하세요.
4. **정확성:** 법규는 매우 엄격하므로, 확실하지 않은 정보는 추측하지 말고 검색을 통해 확인하거나 정보가 부족함을 알리세요.
5. **원칙 반영:** 사용자의 개인 원칙이 제공된 경우, 답변의 톤이나 강조점을 해당 원칙에 맞추세요. (예: 에너지 효율 중시 원칙이 있다면 관련 조항을 더 상세히 설명)
6. **메타 발언 금지:** "URL을 읽는 중입니다", "검색 결과가 없습니다"와 같은 과정에 대한 설명은 생략하고 최종 답변만 제공하세요.`;

  const URL_CONTEXT_LIMIT = 20;
  const urlsForContext = urls.slice(0, URL_CONTEXT_LIMIT);

  if (useSearch) {
    tools.push({ googleSearch: {} });
  } else if (urlsForContext.length > 0) {
    tools.push({ urlContext: {} });
    tools.push({ googleSearch: {} });
  }

  const parts: Part[] = [];
  const urlListForPrompt = urlsForContext.join('\n');
  
  let promptWithContext = prompt;

  if (urlsForContext.length > 0 && !useSearch) {
    promptWithContext = `다음 질문에 답하세요: "${prompt}"\n\n참고할 법령 URL 목록:\n${urlListForPrompt}\n\n위 URL들의 내용을 우선적으로 확인하되, 내용이 확인되지 않으면 검색을 통해 정확한 법령 본문을 찾아 답변하세요.`;
  } else {
    promptWithContext = prompt;
  }
  
  parts.push({ text: promptWithContext });

  // Add files as inline data parts
  for (const file of files) {
      const base64Data = file.base64Data.substring(file.base64Data.indexOf(',') + 1);
      parts.push({
          inlineData: {
              mimeType: file.mimeType,
              data: base64Data
          }
      });
  }

  contents = [{ role: "user", parts: parts }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: { 
        systemInstruction: systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
        safetySettings: safetySettings,
      },
    });

    const text = response.text;
    const candidate = response.candidates?.[0];
    
    const extractedUrlContextMetadata = candidate?.urlContextMetadata?.urlMetadata as UrlContextMetadataItem[] | undefined;
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
    
    return { text, urlContextMetadata: extractedUrlContextMetadata, groundingChunks };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      const googleError = error as any;
      if (googleError.message && (googleError.message.includes("503") || googleError.message.includes("overloaded"))) {
        throw new Error("AI 모델이 현재 과부하 상태입니다. 잠시 후 다시 시도해 주세요.");
      }
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("유효하지 않은 API 키입니다. GEMINI_API_KEY 환경 변수를 확인하세요.");
      }
      if (googleError.message && googleError.message.includes("quota")) {
        throw new Error("API 할당량이 초과되었습니다. Gemini API 할당량을 확인하세요.");
      }
       if (googleError.message && googleError.message.includes("Request payload size exceeds the limit")) {
        throw new Error("업로드한 파일이 너무 큽니다. 파일 크기나 개수를 줄여주세요.");
      }
      if (googleError.type === 'GoogleGenAIError' && googleError.message) {
        throw new Error(`Gemini API 오류: ${googleError.message}`);
      }
      throw new Error(`AI로부터 응답을 받는 데 실패했습니다: ${error.message}`);
    }
    throw new Error("알 수 없는 오류로 인해 AI로부터 응답을 받는 데 실패했습니다.");
  }
};

// This function now aims to get a JSON array of string suggestions.
export const getInitialSuggestions = async (urls: string[], folderName: string = ""): Promise<GeminiResponse> => {
  if (urls.length === 0 && !folderName) {
    return { text: JSON.stringify({ suggestions: ["주제 제안을 받으려면 URL을 추가하세요."] }) };
  }
  const URL_CONTEXT_LIMIT = 20;
  const urlsForPrompt = urls.slice(0, URL_CONTEXT_LIMIT);
  const urlList = urlsForPrompt.join('\n');
  const currentAi = getAiInstance();
  
  const systemInstruction = `You are an AI assistant. Your ONLY task is to generate relevant questions based on the content of provided URLs and the folder context.
**RULES:**
1.  You will be given a list of URLs and a folder name. Use your tool to read the URL content.
2.  Based **exclusively** on the content you read and the context of the folder "${folderName}", generate 3-4 concise, actionable questions in KOREAN that a user might ask.
3.  Your output **MUST BE A VALID JSON OBJECT AND NOTHING ELSE.** No explanations, no markdown, no apologies.
4.  The JSON object must have a single key "suggestions" which is an array of strings. Example: {"suggestions": ["질문 1", "질문 2"]}`;

  const promptText = `현재 사용자는 "${folderName}" 폴더를 탐색 중입니다. 
제공된 URL들의 내용을 읽고, 이 폴더의 성격에 맞는 핵심적인 질문 3-4개를 한국어로 제안하세요.
**규칙:**
- URL 내용을 우선적으로 참고하되, 본문이 확인되지 않으면 해당 법령 명칭을 바탕으로 검색하여 관련 질문을 생성하세요.
- 질문은 구체적이고 답변 가능해야 합니다.
- 반드시 다음 형식의 JSON 객체로만 응답하세요: {"suggestions": ["질문 1", "질문 2"]}.
- 한국어로만 작성하세요.

참고할 URL 목록:
${urlList}`;

  const contents: Content[] = [{ role: "user", parts: [{ text: promptText }] }];
  
  const tools: Tool[] = [{ urlContext: {} }, { googleSearch: {} }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        safetySettings: safetySettings,
      },
    });

    const text = response.text; // This should be the JSON string
    
    return { text };
  } catch (error) {
    console.error("Error calling Gemini API for initial suggestions:", error);
     if (error instanceof Error) {
      const googleError = error as any;
      if (googleError.message && (googleError.message.includes("503") || googleError.message.includes("overloaded"))) {
        throw new Error("AI 모델이 현재 과부하 상태라 제안을 가져올 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("제안을 위한 API 키가 유효하지 않습니다. GEMINI_API_KEY 환경 변수를 확인하세요.");
      }
      if (googleError.message && googleError.message.includes("Tool use with a response mime type: 'application/json' is unsupported")) {
        throw new Error("구성 오류: 제안에 JSON 응답 유형과 함께 도구를 사용할 수 없습니다. 코드에서 수정해야 합니다.");
      }
      throw new Error(`AI로부터 초기 제안을 받는 데 실패했습니다: ${error.message}`);
    }
    throw new Error("알 수 없는 오류로 인해 AI로부터 초기 제안을 받는 데 실패했습니다.");
  }
};

export const extractPrinciples = async (conversation: string): Promise<string[]> => {
  const currentAi = getAiInstance();
  
  const systemInstruction = `You are an expert at identifying personal work principles and values from a conversation. Your task is to extract 1-3 concise, actionable "Personal Rules" that the user seems to value based on the provided conversation. These rules should be in KOREAN. Output MUST be a valid JSON object with a key "principles" which is an array of strings.`;

  const prompt = `Analyze the following conversation and extract 1-3 personal work principles or guidelines that the user seems to follow or value. 
  
  Conversation:
  ${conversation}
  
  Return a JSON object: {"principles": ["원칙 1", "원칙 2"]}`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            principles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['principles'],
        },
      },
    });

    const parsed = JSON.parse(response.text.trim());
    return parsed.principles || [];
  } catch (error) {
    console.error("Error extracting principles:", error);
    return [];
  }
};

export const analyzeProjectAddress = async (
  address: string, 
  libraryFolders: { id: string; name: string }[] = []
): Promise<{ suggestedLaws: string[], matchedLibraryFolderIds: string[] }> => {
  const currentAi = getAiInstance();
  const systemInstruction = `당신은 대한민국 건축 법규 전문가입니다. 프로젝트 주소와 기존 라이브러리 폴더 목록을 분석하여 관련 법규와 라이브러리 자료를 추천하는 것이 임무입니다.
  
  출력은 반드시 다음 구조를 가진 JSON 객체여야 합니다:
  {
    "suggested_laws": ["법규명1", "법규명2"],
    "matched_folder_ids": ["폴더ID1", "폴더ID2"]
  }`;

  const prompt = `다음 프로젝트 주소와 사용자가 이미 가지고 있는 라이브러리 폴더 목록을 분석하세요.
  
  1. 프로젝트 주소: "${address}"
  2. 라이브러리 폴더 목록: ${JSON.stringify(libraryFolders)}
  
  분석 결과로 다음을 제안하세요:
  - 이 위치에서 특히 중요한 대한민국 건축 관련 법규 3-5개 (suggested_laws)
  - 제공된 라이브러리 폴더 중 이 프로젝트와 관련이 깊어 보이는 폴더의 ID (matched_folder_ids). 관련 있는 것이 없다면 빈 배열을 반환하세요.
  
  반드시 JSON 형식으로만 답변하세요.`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggested_laws: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            matched_folder_ids: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['suggested_laws', 'matched_folder_ids'],
        },
      },
    });
    const parsed = JSON.parse(response.text.trim());
    return {
      suggestedLaws: parsed.suggested_laws || [],
      matchedLibraryFolderIds: parsed.matched_folder_ids || []
    };
  } catch (error) {
    console.error("Error analyzing address and matching library:", error);
    return { suggestedLaws: [], matchedLibraryFolderIds: [] };
  }
};
