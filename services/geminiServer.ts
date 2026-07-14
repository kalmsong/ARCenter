import { GoogleGenAI, GenerateContentResponse, Tool, HarmCategory, HarmBlockThreshold, Content, Part, Type } from "@google/genai";
import { UrlContextMetadataItem, GroundingChunk, KnowledgeFile, PersonalRule } from '../types';

const API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI;

const MODEL_NAME = "gemini-3.5-flash"; 

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ 
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio/applet/5c06a6d4-a20b-4f76-9194-9c25b215ce71',
        }
      }
    });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export const selectRelevantDocuments = async (
  query: string,
  documents: { id: string; name: string }[],
): Promise<string[]> => {
  const currentAi = getAiInstance();
  
  const systemInstruction = `You are an intelligent document routing assistant. Your task is to analyze a user's query and a list of available document titles, and then select the most relevant documents to answer the query. You must only select from the provided list. Your response must be a valid JSON object containing the IDs of the selected documents.`;

  const prompt = `Based on the user's query, select up to 20 of the most relevant documents from the list provided.
  
User Query: "${query}"
  
Available Documents:
${JSON.stringify(documents)}
  
Return a JSON object with a single key "selected_ids" which is an array of strings containing the IDs of the most relevant documents. For example: {"selected_ids": ["doc-1", "doc-3"]}`;

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
  return parsed.selected_ids || [];
};

export const generateContent = async (
  prompt: string,
  urls: string[],
  files: KnowledgeFile[],
  useSearch: boolean,
  personalRules: PersonalRule[] = [],
  folderContext: string = "",
  activeGroupAddress: string = "",
) => {
  const currentAi = getAiInstance();
  
  const activeRules = personalRules.filter(r => r.isActive).map(r => r.text).join('\n');
  const rulesInstruction = activeRules 
    ? `\n\n**사용자의 개인 원칙 및 가이드라인 (답변 구성 시 참고하세요):**\n${activeRules}`
    : "";

  const tools: Tool[] = [];
  const contextHeader = folderContext ? `\n\n**현재 프로젝트/폴더 컨텍스트:**\n- 이름: ${folderContext}` : "";
  const addressHeader = activeGroupAddress ? `\n- 대상지 주소: ${activeGroupAddress}` : "";

  const systemInstruction = `당신은 대한민국 건축가들을 위한 전문 AI 어시스턴트 'Archi-Legal Assistant'입니다.
제공된 법령 URL, 파일, 그리고 Google 검색을 활용하여 건축 법규에 대해 정확하고 전문적인 답변을 한국어로 제공하는 것이 당신의 임무입니다.

**답변 원칙:**
1. **가이드라인 준수:** 아래 제공되는 사용자의 개인 원칙을 답변의 '가이드라인'으로 삼으십시오. 이를 답변에 명시적으로 나열하기보다는, 답변의 논조와 강조점을 설정하는 데 활용하십시오.${rulesInstruction}${contextHeader}${addressHeader}

**핵심 동작 규칙:**
1. **한국어 전용:** 모든 답변은 반드시 한국어로만 작성하세요.
2. **동적 웹사이트 대응:** 국가법령정보센터(law.go.kr)와 같은 사이트는 URL 도구로 본문을 직접 읽기 어려울 수 있습니다. 만약 URL에서 "스크립트"나 "구조"만 보이고 본문이 없다면, 즉시 **Google 검색 도구**를 사용하여 해당 법령의 정확한 조항과 내용을 찾아 답변하세요.
3. **법규 검색 최적화:** 한 번에 하나의 법규만 보지 말고, 관련된 여러 법규(예: 건축법, 국토계획법, 지자체 조례 등)를 종합적으로 검토하여 답변하세요.
4. **출처 명시:** 답변 중에 "건축법 제O조에 따르면..."과 같이 출처를 자연스럽게 언급하세요.
5. **정확성:** 법규는 매우 엄격하므로, 확실하지 않은 정보는 추측하지 말고 검색을 통해 확인하거나 정보가 부족함을 알리세요.
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
  }
  
  parts.push({ text: promptWithContext });

  for (const file of files) {
      const base64Data = file.base64Data.substring(file.base64Data.indexOf(',') + 1);
      parts.push({
          inlineData: {
              mimeType: file.mimeType,
              data: base64Data
          }
      });
  }

  const response: GenerateContentResponse = await currentAi.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: "user", parts }],
    config: { 
      systemInstruction,
      tools: tools.length > 0 ? tools : undefined,
      safetySettings,
    },
  });

  const text = response.text;
  const candidate = response.candidates?.[0];
  const urlContextMetadata = candidate?.urlContextMetadata?.urlMetadata as UrlContextMetadataItem[] | undefined;
  const groundingChunks = candidate?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
  
  return { text, urlContextMetadata, groundingChunks };
};

export const getInitialSuggestions = async (urls: string[], folderName: string = "") => {
  const currentAi = getAiInstance();
  const URL_CONTEXT_LIMIT = 20;
  const urlsForPrompt = urls.slice(0, URL_CONTEXT_LIMIT);
  const urlList = urlsForPrompt.join('\n');
  
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

  const response: GenerateContentResponse = await currentAi.models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    config: {
      systemInstruction,
      tools: [{ urlContext: {} }, { googleSearch: {} }],
      safetySettings,
    },
  });

  return { text: response.text };
};

export const extractPrinciples = async (conversation: string) => {
  const currentAi = getAiInstance();
  const systemInstruction = `You are an expert at identifying personal work principles and values from a conversation. Your task is to extract 1-3 concise, actionable "Personal Rules" that the user seems to value based on the provided conversation. These rules should be in KOREAN. Output MUST be a valid JSON object with a key "principles" which is an array of strings.`;
  const prompt = `Analyze the following conversation and extract 1-3 personal work principles or guidelines that the user seems to follow or value. 
  
Conversation:
${conversation}
  
Return a JSON object: {"principles": ["원칙 1", "원칙 2"]}`;

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
};

export const analyzeProjectAddress = async (address: string, libraryFolders: { id: string; name: string }[] = []) => {
  const currentAi = getAiInstance();
  const systemInstruction = `당신은 대한민국 건축 법규 전문가입니다. 프로젝트 주소와 기존 라이브러리 폴더 목록을 분석하여 관련 법규와 라이브러리 자료를 추천하는 것이 임무입니다.
  
출력은 반드시 다음 구조를 가진 JSON 객체여야 합니다:
{
  "suggested_laws": ["법규명1", "법규명2"],
  "matched_folder_ids": ["폴더ID1", "폴더ID2"]
}`;

  const prompt = `다음 프로젝트 주소(들)와 사용자가 이미 가지고 있는 라이브러리 폴더 목록을 분석하세요. 주소가 여러 개일 경우 콤마(,)로 구분되어 있으며, 이는 하나의 필지로 합쳐진 대지(합필)로 간주하고 분석하십시오.
  
1. 프로젝트 주소: "${address}"
2. 라이브러리 폴더 목록: ${JSON.stringify(libraryFolders)}
  
분석 결과로 다음을 제안하세요:
- 이 위치에서 특히 중요한 대한민국 건축 관련 법규 3-5개 (suggested_laws)
- 제공된 라이브러리 폴더 중 이 프로젝트와 관련이 깊어 보이는 폴더의 ID (matched_folder_ids). 관련 있는 것이 없다면 빈 배열을 반환하세요.
  
반드시 JSON 형식으로만 답변하세요.`;

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
};
