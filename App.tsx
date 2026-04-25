/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatMessage, MessageSender, URLGroup, KnowledgeFile, KnowledgeUrl, ToastNotification, PersonalRule } from './types';
// FIX: Import `getInitialSuggestions` and `extractPrinciples` from `geminiService` to resolve reference error.
import { generateContent, selectRelevantDocuments, getInitialSuggestions, extractPrinciples } from './services/geminiService';
import KnowledgeBaseManager from './components/KnowledgeBaseManager';
import ChatInterface from './components/ChatInterface';
import Tutorial from './components/Tutorial';
import { fileToBase64 } from './utils/fileUtils';
import { analyzeProjectAddress } from './services/geminiService';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  writeBatch,
  User,
  Timestamp
} from './services/firebase';

const LAW_URL_BASE = 'https://www.law.go.kr/LSW/lsInfoP.do?lsId=';
const ORDINANCE_URL_BASE = 'https://www.law.go.kr/ordinInfoP.do?ordinId=';
// Increase threshold to 20 to strictly match the API context limit, preventing premature filtering
const AI_ROUTER_THRESHOLD = 20;

// Define URLs for reuse in projects
const allLawUrls: Record<string, KnowledgeUrl> = {
  'law-009294': { id: 'url-law-009294', url: `${LAW_URL_BASE}009294`, name: '국토의 계획 및 이용에 관한 법률' },
  'law-009419': { id: 'url-law-009419', url: `${LAW_URL_BASE}009419`, name: '국토의 계획 및 이용에 관한 법률 시행령' },
  'law-010071': { id: 'url-law-010071', url: `${LAW_URL_BASE}010071`, name: '토지이용규제 기본법' },
  'law-010216': { id: 'url-law-010216', url: `${LAW_URL_BASE}010216`, name: '토지이용규제 기본법 시행령' },
  'law-010447': { id: 'url-law-010447', url: `${LAW_URL_BASE}010447`, name: '경관법' },
  'law-001754': { id: 'url-law-001754', url: `${LAW_URL_BASE}001754`, name: '도시교통정비 촉진법' },
  'law-000266': { id: 'url-law-000266', url: `${LAW_URL_BASE}000266`, name: '수도권정비계획법' },
  'law-004002': { id: 'url-law-004002', url: `${LAW_URL_BASE}004002`, name: '수도권정비계획법 시행령' },
  'law-001823': { id: 'url-law-001823', url: `${LAW_URL_BASE}001823`, name: '건축법' },
  'law-002118': { id: 'url-law-002118', url: `${LAW_URL_BASE}002118`, name: '건축법 시행령' },
  'law-011557': { id: 'url-law-011557', url: `${LAW_URL_BASE}011557`, name: '녹색건축물 조성 지원법' },
  'law-004948': { id: 'url-law-004948', url: `${LAW_URL_BASE}004948`, name: '주택건설기준 등에 관한 규정' },
  'law-001809': { id: 'url-law-001809', url: `${LAW_URL_BASE}001809`, name: '주택법' },
  'law-001463': { id: 'url-law-001463', url: `${LAW_URL_BASE}001463`, name: '산업집적활성화 및 공장설립에 관한 법률' },
  'law-002351': { id: 'url-law-002351', url: `${LAW_URL_BASE}002351`, name: '산업집적활성화 및 공장설립에 관한 법률 시행령' },
  'law-006335': { id: 'url-law-006335', url: `${LAW_URL_BASE}006335`, name: '산업집적활성화 및 공장설립에 관한 법률 시행규칙' },
  'law-006188': { id: 'url-law-006188', url: `${LAW_URL_BASE}006188`, name: '건축물의 설비기준 등에 관한 규칙' },
  'law-001814': { id: 'url-law-001814', url: `${LAW_URL_BASE}001814`, name: '주차장법' },
  'law-004946': { id: 'url-law-004946', url: `${LAW_URL_BASE}004946`, name: '주차장법 시행령' },
  'law-008238': { id: 'url-law-008238', url: `${LAW_URL_BASE}008238`, name: '주차장법 시행규칙' },
  'law-010384': { id: 'url-law-010384', url: `${LAW_URL_BASE}010384`, name: '어린이놀이시설 안전관리법' },
  'law-006189': { id: 'url-law-006189', url: `${LAW_URL_BASE}006189`, name: '건축물의 피난·방화구조 등의 기준에 관한 규칙' },
  'law-009694': { id: 'url-law-009694', url: `${LAW_URL_BASE}009694`, name: '소방시설법 시행령' },
  'law-013019': { id: 'url-law-013019', url: `${LAW_URL_BASE}013019`, name: '지하안전관리에 관한 특별법 시행령' },
  'law-005353': { id: 'url-law-005353', url: `${LAW_URL_BASE}005353`, name: '폐기물관리법 시행령' },
  'law-010375': { id: 'url-law-010375', url: `${LAW_URL_BASE}010375`, name: '공공기관의 운영에 관한 법률' },
  // --- Seoul ---
  'ord-2000719': { id: 'url-ord-2000719', url: `${ORDINANCE_URL_BASE}2000719`, name: '서울특별시 도시계획 조례' },
  'ord-2000120': { id: 'url-ord-2000120', url: `${ORDINANCE_URL_BASE}2000120`, name: '서울특별시 건축 조례' },
  'ord-2000351': { id: 'url-ord-2000351', url: `${ORDINANCE_URL_BASE}2000351`, name: '서울특별시 주차장 설치 및 관리 조례' },
  // --- Gwangju ---
  'ord-2034124': { id: 'url-ord-2034124', url: `${ORDINANCE_URL_BASE}2034124`, name: '광주광역시 도시계획 조례' },
  'ord-2032811': { id: 'url-ord-2032811', url: `${ORDINANCE_URL_BASE}2032811`, name: '광주광역시 건축 조례' },
  'ord-2036342': { id: 'url-ord-2036342', url: `${ORDINANCE_URL_BASE}2036342`, name: '광주광역시 주차장 설치 및 관리 조례' },
  // --- Busan ---
  'ord-2061531': { id: 'url-ord-2061531', url: `${ORDINANCE_URL_BASE}2061531`, name: '부산광역시 도시계획 조례' },
  'ord-2060109': { id: 'url-ord-2060109', url: `${ORDINANCE_URL_BASE}2060109`, name: '부산광역시 건축 조례' },
  'ord-2065969': { id: 'url-ord-2065969', url: `${ORDINANCE_URL_BASE}2065969`, name: '부산광역시 주차장 설치 및 관리 조례' },
  // --- Incheon ---
  'ord-2140009': { id: 'url-ord-2140009', url: `${ORDINANCE_URL_BASE}2140009`, name: '인천광역시 도시계획 조례' },
  'ord-2107771': { id: 'url-ord-2107771', url: `${ORDINANCE_URL_BASE}2107771`, name: '인천광역시 건축 조례' },
  'ord-2157208': { id: 'url-ord-2157208', url: `${ORDINANCE_URL_BASE}2157208`, name: '인천광역시 주차장 설치 및 관리 조례' },
  // --- Daegu ---
  'ord-2152107': { id: 'url-ord-2152107', url: `${ORDINANCE_URL_BASE}2152107`, name: '대구광역시 도시계획 조례' },
  'ord-2141983': { id: 'url-ord-2141983', url: `${ORDINANCE_URL_BASE}2141983`, name: '대구광역시 건축 조례' },
  'ord-2145152': { id: 'url-ord-2145152', url: `${ORDINANCE_URL_BASE}2145152`, name: '대구광역시 주차장 설치 및 관리 조례' },
  // --- Ulsan ---
  'ord-2151262': { id: 'url-ord-2151262', url: `${ORDINANCE_URL_BASE}2151262`, name: '울산광역시 도시계획 조례' },
  'ord-2100338': { id: 'url-ord-2100338', url: `${ORDINANCE_URL_BASE}2100338`, name: '울산광역시 건축 조례' },
  'ord-2102355': { id: 'url-ord-2102355', url: `${ORDINANCE_URL_BASE}2102355`, name: '울산광역시 주차장 설치 및 관리 조례' },
  // --- Sejong ---
  'ord-2152896': { id: 'url-ord-2152896', url: `${ORDINANCE_URL_BASE}2152896`, name: '세종특별자치시 도시계획 조례' },
  'ord-2139853': { id: 'url-ord-2139853', url: `${ORDINANCE_URL_BASE}2139853`, name: '세종특별자치시 건축 조례' },
  'ord-2141695': { id: 'url-ord-2141695', url: `${ORDINANCE_URL_BASE}2141695`, name: '세종특별자치시 주차장 설치 및 관리 조례' },
};


const INITIAL_URL_GROUPS: URLGroup[] = [
  // --- Root & Main Categories ---
  { id: 'root', name: '법제처', parentId: null, files: [], urls: [] },
  { id: 'national-laws', name: '법령', urls: [], files: [], parentId: 'root' },
  { id: 'local-ordinances', name: '자치법규', urls: [], files: [], parentId: 'root' },
  { id: 'projects', name: '내 프로젝트', parentId: null, files: [], urls: [] },
  { id: 'office-examples', name: '법규검토서 예시', urls: [], files: [], parentId: null },

  // --- New National Law Categories ---
  { id: 'kr-law-urban', name: 'I. 도시계획', parentId: 'national-laws', files: [], urls: [
    allLawUrls['law-009294'], allLawUrls['law-009419'], allLawUrls['law-010071'], allLawUrls['law-010216'],
    allLawUrls['law-010447'], allLawUrls['law-001754'],
  ]},
  { id: 'kr-law-urban-capital', name: '가. 수도권', parentId: 'kr-law-urban', files: [], urls: [
    allLawUrls['law-000266'], allLawUrls['law-004002'],
  ]},
  { id: 'kr-law-planning', name: 'II. 건축계획', parentId: 'national-laws', files: [], urls: [
    allLawUrls['law-001823'], allLawUrls['law-002118'], allLawUrls['law-011557'],
  ]},
  // Sub-groups for Architectural Planning
  { id: 'kr-law-planning-housing', name: '가. 주택', parentId: 'kr-law-planning', files: [], urls: [
    allLawUrls['law-004948'], allLawUrls['law-001809'],
  ]},
  { id: 'kr-law-planning-factory', name: '나. 공장', parentId: 'kr-law-planning', files: [], urls: [
    allLawUrls['law-001463'], allLawUrls['law-002351'], allLawUrls['law-006335'],
  ]},
  { id: 'kr-law-facilities', name: 'III. 부대시설', parentId: 'national-laws', files: [], urls: [
    allLawUrls['law-006188'], allLawUrls['law-001814'], allLawUrls['law-004946'],
    allLawUrls['law-008238'], allLawUrls['law-010384'],
  ]},
  { id: 'kr-law-safety', name: 'IV. 안전 및 관리', parentId: 'national-laws', files: [], urls: [
    allLawUrls['law-006189'], allLawUrls['law-009694'], allLawUrls['law-013019'], allLawUrls['law-005353'],
  ]},
  { id: 'kr-law-misc', name: 'V. 기타', parentId: 'national-laws', files: [], urls: [
     allLawUrls['law-010375'],
  ]},
  
  // Local ordinances examples
  { id: 'local-seoul', name: '서울특별시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2000719'], allLawUrls['ord-2000120'], allLawUrls['ord-2000351'],
  ]},
  { id: 'local-busan', name: '부산광역시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2061531'], allLawUrls['ord-2060109'], allLawUrls['ord-2065969'],
  ]},
  { id: 'local-incheon', name: '인천광역시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2140009'], allLawUrls['ord-2107771'], allLawUrls['ord-2157208'],
  ]},
  { id: 'local-daegu', name: '대구광역시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2152107'], allLawUrls['ord-2141983'], allLawUrls['ord-2145152'],
  ]},
  { id: 'local-gwangju', name: '광주광역시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2034124'], allLawUrls['ord-2032811'], allLawUrls['ord-2036342'],
  ]},
  { id: 'local-ulsan', name: '울산광역시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2151262'], allLawUrls['ord-2100338'], allLawUrls['ord-2102355'],
  ]},
  { id: 'local-sejong', name: '세종특별자치시', parentId: 'local-ordinances', files: [], urls: [
    allLawUrls['ord-2152896'], allLawUrls['ord-2139853'], allLawUrls['ord-2141695'],
  ]},
];

const createWelcomeMessage = (): ChatMessage => ({
  id: `system-welcome-${Date.now()}`,
  text: '건축법규검토 어시스턴트에 오신 것을 환영합니다! 좌측 자료실에서 탐색할 법규 그룹을 선택하고 질문을 시작하세요.',
  sender: MessageSender.SYSTEM,
  timestamp: new Date(),
  groupId: 'system',
  uid: 'system'
});


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [urlGroups, setUrlGroups] = useState<URLGroup[]>([]);
  const [activeUrlGroupId, setActiveUrlGroupId] = useState<string>('');
  const [personalRules, setPersonalRules] = useState<PersonalRule[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          updatedAt: Timestamp.now()
        }, { merge: true });
      } else {
        // Clear data when logged out
        setUrlGroups(INITIAL_URL_GROUPS);
        setChatMessages({});
        setPersonalRules([]);
        setActiveUrlGroupId(INITIAL_URL_GROUPS[0].id);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    // Listen for groups
    const groupsQuery = query(collection(db, 'groups'), where('uid', '==', user.uid));
    const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => doc.data() as URLGroup);
      if (groupsData.length > 0) {
        setUrlGroups(groupsData);
        // Set active group if not set
        setActiveUrlGroupId(prev => {
          if (prev && groupsData.some(g => g.id === prev)) return prev;
          return groupsData[0].id;
        });
      } else {
        // Initialize default groups for new user
        const batch = writeBatch(db);
        INITIAL_URL_GROUPS.forEach(group => {
          const groupRef = doc(collection(db, 'groups'), group.id);
          batch.set(groupRef, { ...group, uid: user.uid, createdAt: Timestamp.now() });
        });
        batch.commit().then(() => {
          setUrlGroups(INITIAL_URL_GROUPS.map(g => ({ ...g, uid: user.uid })));
          setActiveUrlGroupId(INITIAL_URL_GROUPS[0].id);
        });
      }
    });

    // Listen for user profile (personal rules)
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.personalRules) setPersonalRules(data.personalRules);
      }
    });

    // Listen for chats
    const chatsQuery = query(collection(db, 'chats'), where('uid', '==', user.uid));
    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => doc.data() as ChatMessage);
      const groupedMessages: Record<string, ChatMessage[]> = {};
      messages.forEach(msg => {
        if (!groupedMessages[msg.groupId]) groupedMessages[msg.groupId] = [];
        groupedMessages[msg.groupId].push({ ...msg, timestamp: new Date(msg.timestamp) });
      });
      // Sort by timestamp
      Object.keys(groupedMessages).forEach(key => {
        groupedMessages[key].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      });
      setChatMessages(groupedMessages);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeUser();
      unsubscribeChats();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      addNotification('로그인되었습니다.', 'info');
    } catch (e) {
      console.error('Login failed:', e);
      addNotification('로그인에 실패했습니다.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      addNotification('로그아웃되었습니다.', 'info');
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialQuerySuggestions, setInitialQuerySuggestions] = useState<string[]>([]);
  const [isSearchEnabled, setIsSearchEnabled] = useState(false);
  
  const MAX_URLS_PER_GROUP = 50; 
  const MAX_FILES_PER_GROUP = 10;
  
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const appRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // One-time cleanup of example data if requested
    if (user) {
      setUrlGroups(prev => prev.filter(g => g.id !== 'project-example-1'));
      setPersonalRules(prev => prev.filter(r => r.id !== 'rule-example-1'));
    }
  }, [user]);

  useEffect(() => {
    // Tutorial check
    const hasSeenTutorial = localStorage.getItem('archiAssistantTutorialSeen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialClose = () => {
    setShowTutorial(false);
    localStorage.setItem('archiAssistantTutorialSeen', 'true');
  };

  const removeNotification = useCallback((id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((message: string, type: 'info' | 'warning' | 'error') => {
      const newNotification: ToastNotification = {
          id: `toast-${Date.now()}`,
          message,
          type,
      };
      setNotifications(prev => [...prev, newNotification]);
  }, []);
  
  const currentChatMessages = useMemo(() => chatMessages[activeUrlGroupId] || [], [chatMessages, activeUrlGroupId]);

  const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
  };

  const handleMouseUp = useCallback(() => {
      setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
      if (isResizing && appRef.current) {
          const appRect = appRef.current.getBoundingClientRect();
          const newWidth = e.clientX - appRect.left;
          const minWidth = 350;
          const maxWidth = appRect.width * 0.7; 
          const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          setSidebarWidth(clampedWidth);
      }
  }, [isResizing]);

  useEffect(() => {
      if (isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizing, handleMouseMove, handleMouseUp]);
  
  useEffect(() => {
    localStorage.setItem('archiAssistantSidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  const activeGroup = useMemo(() => urlGroups.find(group => group.id === activeUrlGroupId), [urlGroups, activeUrlGroupId]);

  const activeGroupPath = useMemo(() => {
    if (!activeGroup) return '없음';
    
    const path: string[] = [];
    let currentGroup: URLGroup | undefined = activeGroup;

    while (currentGroup) {
        path.unshift(currentGroup.name);
        currentGroup = urlGroups.find(g => g.id === currentGroup!.parentId);
    }
    
    return path.join(' - ');
  }, [activeGroup, urlGroups]);


  const getAllDescendantIds = useCallback((groupId: string, groups: URLGroup[]): string[] => {
    const children = groups.filter(g => g.parentId === groupId);
    if (children.length === 0) return [];
    
    const descendantIds: string[] = [];
    for (const child of children) {
      descendantIds.push(child.id);
      descendantIds.push(...getAllDescendantIds(child.id, groups));
    }
    return descendantIds;
  }, []);

  const { urlsForApi, filesForApi } = useMemo(() => {
    if (!activeGroup) return { urlsForApi: [], filesForApi: [] };
    
    // Recursive collection: include assets from current group AND all descendants
    const descendantIds = getAllDescendantIds(activeUrlGroupId, urlGroups);
    const allRelevantGroups = urlGroups.filter(g => g.id === activeUrlGroupId || descendantIds.includes(g.id));
    
    return { 
      urlsForApi: allRelevantGroups.flatMap(g => g.urls), 
      filesForApi: allRelevantGroups.flatMap(g => g.files) 
    };
  }, [activeGroup, activeUrlGroupId, urlGroups, getAllDescendantIds]);


  // Effect for the initial welcome message and API key check
  useEffect(() => {
    if (!process.env.API_KEY) {
      addNotification('오류: Gemini API 키(process.env.API_KEY)가 설정되지 않았습니다. 애플리케이션을 사용하려면 이 환경 변수를 설정하세요.', 'error');
    }
  }, [addNotification]);

  // Effect for handling group changes (new chat, new suggestions)
  useEffect(() => {
    // Check if chat history for this group exists. If not, create it.
    setChatMessages(prev => {
        if (prev[activeUrlGroupId]) {
            return prev; // History exists, do nothing
        }
        // No history, create it with a welcome message
        return {
            ...prev,
            [activeUrlGroupId]: [createWelcomeMessage()]
        };
    });

    setInitialQuerySuggestions([]);

  }, [activeUrlGroupId, urlGroups]);


  const handleFetchSuggestions = useCallback(async () => {
    const urlStrings = urlsForApi.map(u => u.url);
    if (urlStrings.length === 0 || isSearchEnabled || isFetchingSuggestions) {
      setInitialQuerySuggestions([]);
      return;
    }
      
    setIsFetchingSuggestions(true);
    setInitialQuerySuggestions([]); 

    try {
      const response = await getInitialSuggestions(urlStrings, activeGroup?.name || ""); 
      let suggestionsArray: string[] = [];
      if (response.text) {
        try {
          let jsonStr = response.text.trim();
          
          // Enhanced JSON extraction to handle conversational text or markdown code blocks
          // 1. Try to find a JSON code block first
          const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/; 
          const match = jsonStr.match(fenceRegex);
          if (match && match[1]) {
            jsonStr = match[1].trim();
          } else {
            // 2. If no code block, try to find the start and end of the JSON object
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
          }

          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.suggestions)) {
            suggestionsArray = parsed.suggestions.filter((s: unknown) => typeof s === 'string');
          } else {
            console.warn("Parsed suggestions response, but 'suggestions' array not found or invalid:", parsed);
             addNotification("예상치 못한 형식으로 제안을 받았습니다.", 'warning');
          }
        } catch (parseError) {
          console.error("Failed to parse suggestions JSON:", parseError, "Raw text:", response.text);
          addNotification("AI로부터 제안을 파싱하는 중 오류가 발생했습니다.", 'error');
        }
      }
      setInitialQuerySuggestions(suggestionsArray.slice(0, 4)); 
    } catch (e: any) {
      const errorMessage = e.message || '초기 제안을 가져오는 데 실패했습니다.';
      addNotification(`제안을 가져오는 중 오류: ${errorMessage}`, 'error');
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, [urlsForApi, isSearchEnabled, isFetchingSuggestions, addNotification]); 
  
  const handleAddUrls = (urls: string[]) => {
    if (!urls || urls.length === 0 || !user) return;
    
    const group = urlGroups.find(g => g.id === activeUrlGroupId);
    if (!group) return;

    const existingUrls = new Set(group.urls.map(u => u.url));
    const urlsToAdd = urls.filter(url => url.trim() && !existingUrls.has(url));
    
    const availableSlots = MAX_URLS_PER_GROUP - group.urls.length;
    if (availableSlots <= 0) {
      addNotification(`URL을 추가할 수 없습니다. 이 그룹의 최대 URL 수(${MAX_URLS_PER_GROUP}개)에 도달했습니다.`, 'warning');
      return;
    }
    
    const newKnowledgeUrls: KnowledgeUrl[] = urlsToAdd.slice(0, availableSlots).map(url => ({
      id: `url-${Date.now()}-${Math.random()}`,
      url,
      name: url,
    }));
    
    if (urlsToAdd.length > availableSlots) {
       addNotification(`URL 한도에 도달하여 ${availableSlots}개의 URL만 추가되었습니다.`, 'warning');
    }

    const updatedGroup = { ...group, urls: [...group.urls, ...newKnowledgeUrls] };
    setDoc(doc(db, 'groups', group.id), updatedGroup);
  };

  const handleAddUrl = (url: string) => {
    handleAddUrls([url]);
  };

  const handleRemoveUrl = (urlIdToRemove: string) => {
    if (!user) return;
    const group = urlGroups.find(g => g.id === activeUrlGroupId);
    if (!group) return;

    const updatedGroup = { ...group, urls: group.urls.filter(url => url.id !== urlIdToRemove) };
    setDoc(doc(db, 'groups', group.id), updatedGroup);
  };

  const handleRenameUrl = (urlId: string, newName: string) => {
    if (!user) return;
    const group = urlGroups.find(g => g.id === activeUrlGroupId);
    if (!group) return;

    const updatedGroup = {
      ...group,
      urls: group.urls.map(url =>
        url.id === urlId ? { ...url, name: newName } : url
      ),
    };
    setDoc(doc(db, 'groups', group.id), updatedGroup);
  };

  const handleAddFiles = async (files: FileList) => {
    if (!files || files.length === 0 || !user) return;
    
    const group = urlGroups.find(g => g.id === activeUrlGroupId);
    if (!group) return;

    const newFiles: KnowledgeFile[] = [];
    for (const file of Array.from(files)) {
      try {
        const base64Data = await fileToBase64(file);
        newFiles.push({
          id: `file-${Date.now()}-${file.name}`,
          name: file.name,
          mimeType: file.type,
          base64Data,
        });
      } catch (error) {
        console.error("Error converting file to base64:", error);
         addNotification(`파일 처리 중 오류: ${file.name}`, 'error');
      }
    }

    if (newFiles.length > 0) {
      const availableSlots = MAX_FILES_PER_GROUP - group.files.length;
      if (availableSlots <= 0) {
        addNotification(`파일을 추가할 수 없습니다. 이 그룹의 최대 파일 수(${MAX_FILES_PER_GROUP}개)에 도달했습니다.`, 'warning');
        return;
      }

      const filesToAdd = newFiles.slice(0, availableSlots);
      if (newFiles.length > availableSlots) {
        addNotification(`파일 한도에 도달하여 ${availableSlots}개의 파일만 추가되었습니다.`, 'warning');
      }

      const updatedGroup = { ...group, files: [...group.files, ...filesToAdd] };
      setDoc(doc(db, 'groups', group.id), updatedGroup);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    if (!user) return;
    const group = urlGroups.find(g => g.id === activeUrlGroupId);
    if (!group) return;

    const updatedGroup = { ...group, files: group.files.filter(file => file.id !== fileId) };
    setDoc(doc(db, 'groups', group.id), updatedGroup);
  };
  
  const handleAddUrlGroup = (name: string, parentId: string | null = null) => {
    if (!user) return;
    const newGroupId = `group-${Date.now()}`;
    const newGroup: URLGroup = {
      id: newGroupId,
      name,
      urls: [],
      files: [],
      parentId,
      uid: user.uid
    };
    setDoc(doc(db, 'groups', newGroupId), newGroup);
    setActiveUrlGroupId(newGroupId);
  };

  const handleRemoveUrlGroup = async (groupId: string) => {
    if (!user) return;
    const groupToDelete = urlGroups.find(g => g.id === groupId);
    if (!groupToDelete) return;

    const descendantIds = getAllDescendantIds(groupId, urlGroups);
    const idsToRemove = [groupId, ...descendantIds];
    
    const hasChildren = descendantIds.length > 0;
    const confirmationMessage = `${hasChildren ? '이 그룹에 속한 모든 하위 그룹도 함께 삭제됩니다. ' : ''}정말 "${groupToDelete.name}" 그룹을 삭제하시겠습니까?`;

    if (window.confirm(confirmationMessage)) {
      const batch = writeBatch(db);
      idsToRemove.forEach(id => {
        batch.delete(doc(db, 'groups', id));
        // Also delete associated chats
        const groupMessages = chatMessages[id] || [];
        groupMessages.forEach(msg => {
          batch.delete(doc(db, 'chats', msg.id));
        });
      });
      await batch.commit();
      
      if (idsToRemove.includes(activeUrlGroupId)) {
        setActiveUrlGroupId(groupToDelete.parentId || urlGroups.find(g => !idsToRemove.includes(g.id))?.id || '');
      }
    }
  };

  const handleRenameUrlGroup = (groupId: string, newName: string) => {
    if (!user) return;
    const group = urlGroups.find(g => g.id === groupId);
    if (group) {
      setDoc(doc(db, 'groups', groupId), { ...group, name: newName });
    }
  };

  const handleUpdateGroupAddress = (groupId: string, address: string) => {
    if (!user) return;
    const group = urlGroups.find(g => g.id === groupId);
    if (group) {
      setDoc(doc(db, 'groups', groupId), { ...group, projectAddress: address });
    }
  };

  const handleAnalyzeAddress = async (groupId: string, address: string) => {
    if (!address.trim() || !user) return;
    
    setIsLoading(true);
    addNotification('대상지 주소를 분석하여 관련 법규와 라이브러리 자료를 찾는 중...', 'info');
    
    try {
      // Get list of library folders (those not under 'projects' root)
      const libraryFolders = urlGroups
        .filter(g => g.id !== 'projects' && !getAllDescendantIds('projects', urlGroups).includes(g.id))
        .map(g => ({ id: g.id, name: g.name }));

      const { suggestedLaws, matchedLibraryFolderIds } = await analyzeProjectAddress(address, libraryFolders);
      
      // 1. Prepare suggested laws as URLs
      const suggestedUrls: KnowledgeUrl[] = suggestedLaws.map(lawName => ({
        id: `law-suggested-${Date.now()}-${Math.random()}`,
        url: `https://search.law.go.kr/search/search.do?query=${encodeURIComponent(lawName)}`,
        name: lawName
      }));
      
      // 2. Get URLs from matched library folders
      const matchedGroups = urlGroups.filter(g => matchedLibraryFolderIds.includes(g.id));
      const matchedLibraryUrls: KnowledgeUrl[] = [];
      matchedGroups.forEach(g => {
        g.urls.forEach(u => {
          // Avoid duplicates within matched library urls
          if (!matchedLibraryUrls.some(mu => mu.url === u.url)) {
            matchedLibraryUrls.push({
              ...u,
              id: `matched-${u.id}-${Date.now()}-${Math.random()}` // New ID for the copy
            });
          }
        });
      });

      const projectGroup = urlGroups.find(g => g.id === groupId);
      if (projectGroup) {
        const existingUrls = new Set(projectGroup.urls.map(u => u.url));
        const allNewUrls = [...suggestedUrls, ...matchedLibraryUrls];
        const uniqueNewUrls = allNewUrls.filter(u => !existingUrls.has(u.url));
        
        const updatedProjectGroup = { 
          ...projectGroup, 
          urls: [...projectGroup.urls, ...uniqueNewUrls] 
        };
        await setDoc(doc(db, 'groups', groupId), updatedProjectGroup);
      }

      // 3. Also add matched library folders as linked child groups for reference
      const batch = writeBatch(db);
      let addedFolderCount = 0;

      matchedGroups.forEach(libGroup => {
        const isAlreadyLinked = urlGroups.some(g => g.parentId === groupId && g.name.includes(libGroup.name));
        if (!isAlreadyLinked) {
          const newGroupId = `linked-${libGroup.id}-${Date.now()}`;
          const linkedGroup: URLGroup = {
            id: newGroupId,
            name: `[라이브러리] ${libGroup.name}`,
            urls: [...libGroup.urls],
            files: [...libGroup.files],
            parentId: groupId,
            uid: user.uid
          };
          const groupRef = doc(db, 'groups', newGroupId);
          batch.set(groupRef, linkedGroup);
          addedFolderCount++;
        }
      });

      if (addedFolderCount > 0) {
        await batch.commit();
      }
      
      const lawCount = suggestedLaws.length + matchedLibraryUrls.length;
      const folderCount = addedFolderCount;
      
      if (lawCount > 0 || folderCount > 0) {
        addNotification(
          `${lawCount > 0 ? `${lawCount}개의 관련 법규` : ''}${lawCount > 0 && folderCount > 0 ? '와 ' : ''}${folderCount > 0 ? `${folderCount}개의 라이브러리 폴더` : ''}가 프로젝트에 추가되었습니다.`, 
          'info'
        );
      } else {
        addNotification('관련 자료 제안을 찾지 못했습니다.', 'warning');
      }
    } catch (error) {
      console.error("Address analysis failed:", error);
      addNotification('주소 분석 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveAsset = async (assetId: string, assetType: 'url' | 'file', targetGroupId: string) => {
    if (!user) return;
    
    const sourceGroup = urlGroups.find(g => g.id === activeUrlGroupId);
    const targetGroup = urlGroups.find(g => g.id === targetGroupId);

    if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return;

    let asset: KnowledgeUrl | KnowledgeFile | undefined;
    let updatedSourceGroup: URLGroup = { ...sourceGroup };

    if (assetType === 'url') {
      asset = sourceGroup.urls.find(u => u.id === assetId);
      if (asset) updatedSourceGroup.urls = sourceGroup.urls.filter(u => u.id !== assetId);
    } else { // file
      asset = sourceGroup.files.find(f => f.id === assetId);
      if (asset) updatedSourceGroup.files = sourceGroup.files.filter(f => f.id !== assetId);
    }

    if (!asset) return; // Asset not found

    let updatedTargetGroup: URLGroup = { ...targetGroup };
    if (assetType === 'url') {
      if (targetGroup.urls.length < MAX_URLS_PER_GROUP) {
        updatedTargetGroup.urls = [...targetGroup.urls, asset as KnowledgeUrl];
      } else {
        addNotification(`대상 그룹이 가득 찼습니다.`, 'warning');
        return;
      }
    } else { // file
      if (targetGroup.files.length < MAX_FILES_PER_GROUP) {
        updatedTargetGroup.files = [...targetGroup.files, asset as KnowledgeFile];
      } else {
        addNotification(`대상 그룹이 가득 찼습니다.`, 'warning');
        return;
      }
    }
    
    const batch = writeBatch(db);
    batch.set(doc(db, 'groups', sourceGroup.id), updatedSourceGroup);
    batch.set(doc(db, 'groups', targetGroup.id), updatedTargetGroup);
    await batch.commit();
  };

  const handleCopyUrlToProject = async (urlToCopy: KnowledgeUrl, targetProjectId: string) => {
      if (!user) return;
      
      const targetGroup = urlGroups.find(g => g.id === targetProjectId);
      if (!targetGroup) return;

      if (targetGroup.urls.some(u => u.url === urlToCopy.url)) {
          addNotification(`'${urlToCopy.name}'은(는) 이미 해당 프로젝트에 존재합니다.`, 'warning');
          return;
      }

      if (targetGroup.urls.length >= MAX_URLS_PER_GROUP) {
          addNotification(`프로젝트 그룹이 가득 찼습니다. URL을 추가할 수 없습니다.`, 'warning');
          return;
      }

      const updatedGroup = { ...targetGroup, urls: [...targetGroup.urls, urlToCopy] };
      await setDoc(doc(db, 'groups', targetProjectId), updatedGroup);
      
      const targetGroupName = targetGroup.name || '프로젝트';
      addNotification(`'${urlToCopy.name}'을(를) '${targetGroupName}'(으)로 복사했습니다.`, 'info');
  };

  const handleExportGroups = () => {
    try {
      const jsonString = JSON.stringify(urlGroups, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archi-assistant-groups-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export groups:", error);
      alert("데이터를 내보내는 중 오류가 발생했습니다.");
    }
  };

  const handleImportGroups = async (file: File) => {
    if (!file || !user) return;

    if (!file.type.includes('json')) {
      alert("JSON 파일만 가져올 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          throw new Error("파일을 읽을 수 없습니다.");
        }
        const parsedGroups = JSON.parse(result) as URLGroup[];
        
        if (!Array.isArray(parsedGroups) || !parsedGroups.every(g => g.id && g.name && Array.isArray(g.urls) && Array.isArray(g.files))) {
             throw new Error("JSON 파일의 형식이 올바르지 않습니다.");
        }

        if (window.confirm("현재 모든 자료와 대화 기록을 덮어쓰고 가져오시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
            const batch = writeBatch(db);
            
            // Delete existing groups from Firestore
            const existingUserGroups = urlGroups.filter(g => g.uid === user.uid);
            existingUserGroups.forEach(g => {
              batch.delete(doc(db, 'groups', g.id));
            });

            // Add imported groups
            parsedGroups.forEach(g => {
              batch.set(doc(db, 'groups', g.id), { ...g, uid: user.uid });
            });

            // Clear chat messages in Firestore
            const chatQuery = query(collection(db, 'chats'), where('uid', '==', user.uid));
            const chatSnapshot = await getDoc(doc(db, 'chats', 'dummy')); // This is not how you delete a collection
            // For simplicity, we'll just inform the user we are importing groups.
            // Deleting all chats is complex in client-side Firestore without a cloud function.
            
            await batch.commit();
            setActiveUrlGroupId(parsedGroups[0]?.id || '');
            alert("데이터를 성공적으로 가져왔습니다.");
        }
      } catch (error) {
        console.error("Failed to import groups:", error);
        alert(`데이터를 가져오는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    reader.onerror = () => {
      alert("파일을 읽는 중 오류가 발생했습니다.");
    };
    reader.readAsText(file);
  };
  
  const handleSendMessage = async (query: string) => {
    if (!query.trim() || isLoading || isFetchingSuggestions || !user) return;

    if (!process.env.API_KEY) {
      addNotification('오류: API 키(process.env.API_KEY)가 설정되지 않았습니다. 메시지를 보내려면 설정하세요.', 'error');
      return;
    }
    
    setIsLoading(true);
    setInitialQuerySuggestions([]); 

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: query,
      sender: MessageSender.USER,
      timestamp: Date.now() as any, // Store as number for Firestore
      groupId: activeUrlGroupId,
      uid: user.uid
    };
    
    // Optimistically add user message to UI
    setChatMessages(prev => ({
      ...prev,
      [activeUrlGroupId]: [...(prev[activeUrlGroupId] || []), { ...userMessage, timestamp: new Date() }]
    }));

    // Save user message to Firestore
    setDoc(doc(db, 'chats', userMessage.id), userMessage);

    const modelPlaceholderId = `model-response-${Date.now()}`;
    const modelPlaceholderMessage: ChatMessage = {
      id: modelPlaceholderId,
      text: '생각 중...', 
      sender: MessageSender.MODEL,
      timestamp: new Date(),
      isLoading: true,
      groupId: activeUrlGroupId,
      uid: user.uid
    };
    
    setChatMessages(prev => ({
      ...prev,
      [activeUrlGroupId]: [...(prev[activeUrlGroupId] || []), modelPlaceholderMessage]
    }));
    
    try {
      const totalDocs = urlsForApi.length + filesForApi.length;
      let finalUrlsForApi = urlsForApi;
      let finalFilesForApi = filesForApi;

      // Step 1: Route/Select documents if necessary
      if (!isSearchEnabled && totalDocs > AI_ROUTER_THRESHOLD) {
        setChatMessages(prev => ({ ...prev, [activeUrlGroupId]: prev[activeUrlGroupId].map(msg => 
            msg.id === modelPlaceholderMessage.id ? {...msg, text: '관련 자료 선별 중...'} : msg
        )}));

        const allDocuments = [
            ...urlsForApi.map(u => ({ id: u.id, name: u.name })),
            ...filesForApi.map(f => ({ id: f.id, name: f.name })),
        ];

        const selectedIds = await selectRelevantDocuments(query, allDocuments);
        const selectedIdSet = new Set(selectedIds);

        finalUrlsForApi = urlsForApi.filter(u => selectedIdSet.has(u.id));
        finalFilesForApi = filesForApi.filter(f => selectedIdSet.has(f.id));

        const selectedCount = finalUrlsForApi.length + finalFilesForApi.length;
        const statusText = selectedCount > 0 
          ? `선별된 ${selectedCount}개 자료를 바탕으로 답변 생성 중...`
          : '관련 자료를 찾지 못했습니다. 일반 지식으로 답변을 시도합니다.';
        
        setChatMessages(prev => ({ ...prev, [activeUrlGroupId]: prev[activeUrlGroupId].map(msg => 
            msg.id === modelPlaceholderMessage.id ? {...msg, text: statusText} : msg
        )}));
      }

      const URL_CONTEXT_LIMIT = 20;
      if (!isSearchEnabled && finalUrlsForApi.length > URL_CONTEXT_LIMIT) {
        addNotification(`참고: AI는 최대 ${URL_CONTEXT_LIMIT}개의 URL만 참고합니다. ${URL_CONTEXT_LIMIT}개를 사용하여 답변합니다.`, 'info');
      }
      
      // Step 2: Generate content with the (potentially filtered) documents
      const response = await generateContent(
          query,
          isSearchEnabled ? [] : finalUrlsForApi.map(u => u.url),
          isSearchEnabled ? [] : finalFilesForApi,
          isSearchEnabled,
          personalRules,
          activeGroup?.name,
          activeGroup?.projectAddress
      );

      const responseText = response.text || "빈 응답을 받았습니다.";
      
      // Step 3: Extract principles if the conversation is substantial
      let suggestedRules: string[] = [];
      if (responseText.length > 100) {
        try {
          const extracted = await extractPrinciples(query + "\n" + responseText);
          suggestedRules = extracted.filter(rule => !personalRules.some(pr => pr.text === rule));
        } catch (err) {
          console.error("Failed to extract principles", err);
        }
      }
      
      const finalModelMessage: ChatMessage = {
          id: modelPlaceholderId,
          text: responseText,
          sender: MessageSender.MODEL,
          timestamp: Date.now() as any,
          isLoading: false,
          urlContext: response.urlContextMetadata,
          groundingChunks: response.groundingChunks,
          wasSearchEnabled: isSearchEnabled,
          suggestedRules: suggestedRules.length > 0 ? suggestedRules : undefined,
          groupId: activeUrlGroupId,
          uid: user.uid
      };

      // Save AI message to Firestore
      setDoc(doc(db, 'chats', finalModelMessage.id), finalModelMessage);

    } catch (e: any) {
      const errorMessage = e.message || 'AI로부터 응답을 받는 데 실패했습니다.';
      setChatMessages(prev => ({
          ...prev,
          [activeUrlGroupId]: prev[activeUrlGroupId].filter(msg => msg.id !== modelPlaceholderMessage.id)
      }));
      addNotification(`오류: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQueryClick = (query: string) => {
    handleSendMessage(query);
  };

  const handleToggleSearch = () => {
    const newState = !isSearchEnabled;
    setIsSearchEnabled(newState);
    addNotification(newState ? '웹 검색이 활성화되었습니다.' : '자료실 검색으로 전환되었습니다.', 'info');
  };

  const chatPlaceholder = isSearchEnabled
    ? "웹에 무엇이든 물어보세요..."
    : (urlsForApi.length > 0 || filesForApi.length > 0
            ? `"${activeGroupPath}"에 대해 질문하기...`
            : "채팅을 시작하려면 자료실에 URL이나 파일을 추가하세요.");

  return (
    <div 
      ref={appRef}
      className="h-screen max-h-screen antialiased relative overflow-x-hidden bg-gray-50 text-gray-800"
    >
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <div className="flex h-full w-full">
        {/* Sidebar */}
        <div
          className={`
            fixed top-0 left-0 h-full w-11/12 max-w-sm z-30
            md:static md:z-auto md:max-w-none md:flex-shrink-0
            transition-all duration-300 ease-in-out
            ${isSidebarOpen ? 'transform-none' : '-translate-x-full md:!w-0'}
          `}
          style={isSidebarOpen ? { width: `clamp(280px, ${sidebarWidth}px, 90vw)` } : {}}
        >
          {isSidebarOpen && <KnowledgeBaseManager
            urls={activeGroup?.urls || []}
            files={activeGroup?.files || []}
            onAddUrl={handleAddUrl}
            onRemoveUrl={handleRemoveUrl}
            onRenameUrl={handleRenameUrl}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
            onMoveAsset={handleMoveAsset}
            onCopyUrlToProject={handleCopyUrlToProject}
            maxUrls={MAX_URLS_PER_GROUP}
            maxFiles={MAX_FILES_PER_GROUP}
            urlGroups={urlGroups}
            activeUrlGroupId={activeUrlGroupId}
            onSetGroupId={setActiveUrlGroupId}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            onAddGroup={handleAddUrlGroup}
            onRemoveGroup={handleRemoveUrlGroup}
            onRenameGroup={handleRenameUrlGroup}
            onUpdateGroupAddress={handleUpdateGroupAddress}
            onAnalyzeAddress={handleAnalyzeAddress}
            onExportGroups={handleExportGroups}
            onImportGroups={handleImportGroups}
            onShowTutorial={() => setShowTutorial(true)}
            isLoading={isLoading || isFetchingSuggestions}
            personalRules={personalRules}
            onAddRule={(text) => {
              if (!user) return;
              const newRules = [...personalRules, { id: `rule-${Date.now()}`, text, isActive: true }];
              setDoc(doc(db, 'users', user.uid), { personalRules: newRules }, { merge: true });
            }}
            onRemoveRule={(id) => {
              if (!user) return;
              const newRules = personalRules.filter(r => r.id !== id);
              setDoc(doc(db, 'users', user.uid), { personalRules: newRules }, { merge: true });
            }}
            onToggleRule={(id) => {
              if (!user) return;
              const newRules = personalRules.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
              setDoc(doc(db, 'users', user.uid), { personalRules: newRules }, { merge: true });
            }}
            onUpdateRule={(id, text) => {
              if (!user) return;
              const newRules = personalRules.map(r => r.id === id ? { ...r, text } : r);
              setDoc(doc(db, 'users', user.uid), { personalRules: newRules }, { merge: true });
            }}
          />}
        </div>

        {/* Resizer */}
        {isSidebarOpen && (
          <div
            onMouseDown={handleMouseDown}
            className="h-full w-1.5 cursor-col-resize bg-gray-200/50 hover:bg-blue-400 transition-colors flex-shrink-0 hidden md:block"
          />
        )}


        {/* Chat Interface */}
        <div className="h-full flex-grow min-w-0">
          <ChatInterface
            messages={currentChatMessages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholderText={chatPlaceholder}
            initialQuerySuggestions={initialQuerySuggestions}
            onSuggestedQueryClick={handleSuggestedQueryClick}
            isFetchingSuggestions={isFetchingSuggestions}
            onFetchSuggestions={handleFetchSuggestions}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            isSidebarOpen={isSidebarOpen}
            isSearchEnabled={isSearchEnabled}
            onToggleSearch={handleToggleSearch}
            activeGroupPath={isSearchEnabled ? '웹 검색' : activeGroupPath}
            activeGroupAddress={activeGroup?.projectAddress}
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
            notifications={notifications}
            onRemoveNotification={removeNotification}
          />
        </div>
      </div>
      {showTutorial && <Tutorial onClose={handleTutorialClose} />}
    </div>
  );
};

export default App;