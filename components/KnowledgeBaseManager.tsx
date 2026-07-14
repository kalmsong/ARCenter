/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, ReactNode, Fragment } from 'react';
import { Plus, Trash2, X, Pencil, Check, Upload, File as FileIcon, FileText, Image as ImageIcon, FileSpreadsheet, Presentation, MoveRight, LinkIcon, Eye, Folder, ChevronRight, ChevronDown, FolderPlus, Info, UploadCloud, DownloadCloud, PanelLeftClose, ChevronLeft, Briefcase, Copy, Scale, FolderTree, Database, ShieldCheck, ToggleLeft, ToggleRight, Save, MapPin, Search, Sparkles, MessageSquare, Clock, Calendar, Map as MapIcon, Layout, Edit3, Edit2, Activity } from 'lucide-react';
import { URLGroup, KnowledgeFile, KnowledgeUrl, PersonalRule, ChatSession, ViewerConfig } from '../types';

interface KnowledgeBaseManagerProps {
  urls: KnowledgeUrl[];
  files: KnowledgeFile[];
  onAddUrl: (url: string) => void;
  onRemoveUrl: (urlId: string) => void;
  onRenameUrl: (urlId: string, newName: string) => void;
  onAddFiles: (files: FileList) => void;
  onRemoveFile: (fileId: string) => void;
  onUpdateFile?: (fileId: string, updatedData: Partial<KnowledgeFile>) => void;
  onMoveAsset: (assetId: string, assetType: 'url' | 'file', targetGroupId: string) => void;
  onCopyUrlToProject: (url: KnowledgeUrl, targetProjectId: string) => void;
  maxUrls?: number;
  maxFiles?: number;
  urlGroups: URLGroup[];
  activeUrlGroupId: string;
  onSetGroupId: (id: string) => void;
  onCloseSidebar?: () => void;
  onAddGroup: (name: string, parentId?: string | null) => void;
  onRemoveGroup: (id: string) => void;
  onRenameGroup: (id: string, newName: string) => void;
  onUpdateGroupAddress?: (id: string, address: string) => void;
  onAnalyzeAddress?: (id: string, address: string) => void;
  onExportGroups: () => void;
  onImportGroups: (file: File) => void;
  onShowTutorial?: () => void;
  isLoading?: boolean;
  isGroupsLoading?: boolean;
  isSessionsLoading?: boolean;
  personalRules: PersonalRule[];
  onAddRule: (text: string) => void;
  onRemoveRule: (id: string) => void;
  onToggleRule: (id: string) => void;
  onUpdateRule: (id: string, text: string) => void;
  chatSessions: ChatSession[];
  activeSessionId: string;
  onCreateSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onViewProjectDetail?: (groupId: string) => void;
  onOpenViewer?: (config: ViewerConfig) => void;
  onUpdateGroup?: (id: string, data: Partial<URLGroup>) => void;
}

const getFileIcon = (mimeType?: string): ReactNode => {
  if (!mimeType) return <FileIcon size={20} className="text-gray-500 flex-shrink-0" />;
  if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-pink-500 flex-shrink-0" />;
  if (mimeType === 'application/pdf') return <FileText size={20} className="text-red-500 flex-shrink-0" />;
  if (mimeType.includes('wordprocessing')) return <FileText size={20} className="text-blue-500 flex-shrink-0" />;
  if (mimeType.includes('spreadsheet')) return <FileSpreadsheet size={20} className="text-green-500 flex-shrink-0" />;
  if (mimeType.includes('presentation')) return <Presentation size={20} className="text-orange-500 flex-shrink-0" />;
  return <FileIcon size={20} className="text-gray-500 flex-shrink-0" />;
};

const countAssetsInGroup = (g: URLGroup): number => g.urls.length + g.files.length;

const countAllAssets = (g: URLGroup, urlGroups: URLGroup[], visited = new Set<string>()): number => {
  if (visited.has(g.id)) return 0;
  visited.add(g.id);
  
  let totalAssets = countAssetsInGroup(g);
  const children = urlGroups.filter(child => child.parentId === g.id);
  for (const child of children) {
    totalAssets += countAllAssets(child, urlGroups, visited);
  }
  return totalAssets;
};

// Helper to check if a group is part of the "Projects" section
const isProjectGroup = (childId: string, groups: URLGroup[]): boolean => {
    let current = groups.find(g => g.id === childId);
    while (current) {
        if (current.isProject || current.id.endsWith('-projects') || current.id === 'projects') {
            return true;
        }
        current = groups.find(g => g.id === current.parentId);
    }
    return false;
};

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({ 
  urls,
  files,
  onAddUrl, 
  onRemoveUrl, 
  onRenameUrl,
  onAddFiles,
  onRemoveFile,
  onUpdateFile,
  onMoveAsset,
  onCopyUrlToProject,
  maxUrls = 50,
  maxFiles = 10,
  urlGroups,
  activeUrlGroupId,
  onSetGroupId,
  onCloseSidebar,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onUpdateGroupAddress,
  onAnalyzeAddress,
  onExportGroups,
  onImportGroups,
  onShowTutorial,
  isLoading = false,
  isGroupsLoading = false,
  isSessionsLoading = false,
  personalRules,
  onAddRule,
  onRemoveRule,
  onToggleRule,
  onUpdateRule,
  chatSessions,
  activeSessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onViewProjectDetail,
  onOpenViewer,
  onUpdateGroup
}) => {
  const [currentUrlInput, setCurrentUrlInput] = useState('');
  const [newRuleInput, setNewRuleInput] = useState('');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleText, setEditingRuleText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlName, setEditingUrlName] = useState('');
  const [movingAsset, setMovingAsset] = useState<{ id: string, type: 'url' | 'file' } | null>(null);
  const [copyingUrl, setCopyingUrl] = useState<KnowledgeUrl | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectAddress, setProjectAddress] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [projectSubTab, setProjectSubTab] = useState<'overview' | 'analysis' | 'laws' | 'materials' | 'settings'>('overview');
  const [workspaceSubView, setWorkspaceSubView] = useState<'projects' | 'rules'>('projects');
  const [mobileView, setMobileView] = useState<'library' | 'workspace'>('workspace');
  const [isManualAddressEdit, setIsManualAddressEdit] = useState(false);
  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [tempOverview, setTempOverview] = useState<any>({});
  
  const activeGroup = urlGroups.find(g => g.id === activeUrlGroupId);
  
  // Sync addressInput when activeGroup changes
  useEffect(() => {
    if (activeGroup?.projectAddress) {
      setAddressInput(activeGroup.projectAddress);
    } else {
      setAddressInput('');
    }
    setIsManualAddressEdit(false);
  }, [activeUrlGroupId, activeGroup?.id]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
     const initialState: Record<string, boolean> = {};
     urlGroups.forEach(g => { if(g.parentId) initialState[g.parentId] = true; });
     
     // Find the project root
     const projectsRoot = urlGroups.find(g => g.isProject && !g.parentId);
     if (projectsRoot) {
       initialState[projectsRoot.id] = true;
     }

     // Automatically expand ancestors of the active group
     let currentGroup = urlGroups.find(g => g.id === activeUrlGroupId);
     while(currentGroup && currentGroup.parentId) {
        initialState[currentGroup.parentId] = true;
        currentGroup = urlGroups.find(g => g.id === currentGroup?.parentId);
     }
     initialState['root'] = true; // Always expand the root
     return initialState;
  });

  // Automatically expand parent folders when active group or urlGroups change
  useEffect(() => {
    if (urlGroups.length === 0) return;
    setExpandedGroups(prev => {
      const next = { ...prev };
      
      // Always expand root categories (groups with parentId === null)
      urlGroups.forEach(g => {
        if (g.parentId === null) {
          next[g.id] = true;
        }
      });
      
      // Expand "법령" or "자치법규" subfolders under the root if they exist
      const nationalLaws = urlGroups.find(g => g.name === '법령' || g.name === '자치법규');
      if (nationalLaws) {
        next[nationalLaws.id] = true;
      }
      
      // Expand ancestors of the active group
      let currentGroup = urlGroups.find(g => g.id === activeUrlGroupId);
      while (currentGroup && currentGroup.parentId) {
        next[currentGroup.parentId] = true;
        currentGroup = urlGroups.find(g => g.id === currentGroup?.parentId);
      }
      return next;
    });
  }, [activeUrlGroupId, urlGroups]);

  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };
  
  const handleGroupSelect = (id: string) => {
    onSetGroupId(id);
  };

  const handleAddUrl = () => {
    setError(null);
    if (!currentUrlInput.trim()) {
      setError('URL을 입력해주세요.');
      return;
    }
    if (!isValidUrl(currentUrlInput)) {
      setError('잘못된 URL 형식입니다. http:// 또는 https://를 포함해주세요.');
      return;
    }
    if (urls.length >= maxUrls) {
      setError(`이 그룹의 최대 URL 수(${maxUrls}개)에 도달했습니다.`);
      return;
    }
    if (urls.some(u => u.url === currentUrlInput)) {
      setError('이 URL은 이미 그룹에 존재합니다.');
      return;
    }
    onAddUrl(currentUrlInput);
    setCurrentUrlInput('');
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      if (files.length + event.target.files.length > maxFiles) {
        setError(`이 그룹의 최대 파일 수(${maxFiles}개)에 도달했습니다.`);
        return;
      }
      onAddFiles(event.target.files);
      setError(null);
      event.target.value = ''; // Reset file input
    }
  };
  
  const handleImportFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportGroups(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleStartUrlEditing = (url: KnowledgeUrl) => {
    setEditingUrlId(url.id);
    setEditingUrlName(url.name);
  };

  const handleCancelUrlEditing = () => {
    setEditingUrlId(null);
    setEditingUrlName('');
  };

  const handleSaveUrlRename = () => {
    if (editingUrlId && editingUrlName.trim()) {
      onRenameUrl(editingUrlId, editingUrlName.trim());
    }
    handleCancelUrlEditing();
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim()) {
      onAddGroup(newGroupName.trim(), null); // Add as root group
      setNewGroupName('');
      setIsAddingGroup(false);
    }
  };

  const projectsRoot = urlGroups.find(g => g.isProject && !g.parentId);
  const projectsRootId = projectsRoot?.id;

  const handleCreateProject = async () => {
    if (newGroupName.trim() && projectsRootId) {
      onAddGroup(newGroupName.trim(), projectsRootId);
      setNewGroupName('');
      setProjectAddress('');
      setIsAddingProject(false);
    }
  };

  const handleAnalyzeAddress = async (groupId: string, address: string) => {
    if (!address.trim() || !onAnalyzeAddress) return;
    onAnalyzeAddress(groupId, address);
  };

  const handlePerformMove = (targetGroupId: string) => {
    if (movingAsset) {
      onMoveAsset(movingAsset.id, movingAsset.type, targetGroupId);
      setMovingAsset(null);
    }
  };

  const handlePerformCopy = (targetProjectId: string) => {
    if (copyingUrl) {
      onCopyUrlToProject(copyingUrl, targetProjectId);
      setCopyingUrl(null);
    }
  };
  
  const handleToggleExpand = (groupId: string) => {
      setExpandedGroups(prev => ({...prev, [groupId]: !prev[groupId]}));
  };

  const getAllDescendantIds = (groupId: string, visited = new Set<string>()): string[] => {
    if (visited.has(groupId)) return [];
    visited.add(groupId);
    
    const children = urlGroups.filter(g => g.parentId === groupId);
    const descendantIds: string[] = [];
    for (const child of children) {
      descendantIds.push(child.id);
      descendantIds.push(...getAllDescendantIds(child.id, visited));
    }
    return descendantIds;
  };

  const descendantIds = getAllDescendantIds(activeUrlGroupId);
  const allRelevantGroups = urlGroups.filter(g => g.id === activeUrlGroupId || descendantIds.includes(g.id));
  const recursiveUrlCount = allRelevantGroups.reduce((acc, g) => acc + g.urls.length, 0);
  const recursiveFileCount = allRelevantGroups.reduce((acc, g) => acc + g.files.length, 0);
  const totalRecursiveAssets = recursiveUrlCount + recursiveFileCount;

  const activeGroupName = activeGroup?.name || "그룹 선택";
  const totalAssets = (activeGroup?.urls.length || 0) + (activeGroup?.files.length || 0);
  const isProject = isProjectGroup(activeUrlGroupId, urlGroups);
  const hasSubfolders = descendantIds.length > 0;

  const renderGroupTree = (parentId: string | null = null, level = 0, filterProjects = false, visited = new Set<string>()): React.ReactNode => {
    if (parentId && visited.has(parentId)) return null;
    if (parentId) {
      const newVisited = new Set(visited);
      newVisited.add(parentId);
      visited = newVisited;
    }

    const childGroups = urlGroups.filter(g => g.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name));

    return childGroups.map(group => {
      const isProjectItem = isProjectGroup(group.id, urlGroups);
      
      if (filterProjects && !isProjectItem) return null;
      if (!filterProjects && isProjectItem) return null;
      
      // Simplify project list: only show top-level projects in the sidebar
      const isTopLevelProject = group.parentId === projectsRootId;
      if (filterProjects && !isTopLevelProject && level > 0) return null;

      return (
        <GroupItem
          key={group.id}
          group={group}
          level={level}
          isProject={isProjectItem}
          urlGroups={urlGroups}
          activeUrlGroupId={activeUrlGroupId}
          editingGroupId={editingGroupId}
          isExpanded={!!expandedGroups[group.id]}
          onSetGroupId={handleGroupSelect}
          onToggleExpand={handleToggleExpand}
          setEditingGroupId={setEditingGroupId}
          onRenameGroup={onRenameGroup}
          onRemoveGroup={onRemoveGroup}
          onAddGroup={onAddGroup}
          onUpdateAddress={onUpdateGroupAddress}
          onAnalyzeAddress={handleAnalyzeAddress}
          chatSessions={chatSessions}
          activeSessionId={activeSessionId}
          onCreateSession={onCreateSession}
          onSwitchSession={onSwitchSession}
          onDeleteSession={onDeleteSession}
          renderGroupTree={(p, l, v) => renderGroupTree(p, l, filterProjects, v)}
          visited={visited}
        />
      );
    });
  };
  
  const renderMoveGroupOptions = (parentId: string | null, level = 0, visited = new Set<string>()): React.ReactNode => {
    if (parentId && visited.has(parentId)) return null;
    if (parentId) visited.add(parentId);

     return urlGroups
        .filter(g => g.parentId === parentId)
        .filter(g => g.id !== activeUrlGroupId)
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(group => {
          const isProjectItem = isProjectGroup(group.id, urlGroups);
          return (
            <Fragment key={group.id}>
              <button
                onClick={() => handlePerformMove(group.id)}
                className="w-full text-left p-2 rounded-md text-sm hover:bg-gray-100 transition-colors text-gray-700 flex items-center"
                style={{ paddingLeft: `${level * 20 + 12}px` }}
              >
               {isProjectItem ? <Briefcase size={16} className="mr-2 flex-shrink-0 text-purple-500" /> : <Folder size={16} className="mr-2 flex-shrink-0 text-gray-400" />}
                {group.name}
              </button>
              {renderMoveGroupOptions(group.id, level + 1, visited)}
            </Fragment>
          )
        });
  }

  const handleAddRule = () => {
    if (newRuleInput.trim()) {
      onAddRule(newRuleInput.trim());
      setNewRuleInput('');
    }
  };

  const handleStartRuleEditing = (rule: PersonalRule) => {
    setEditingRuleId(rule.id);
    setEditingRuleText(rule.text);
  };

  const handleSaveRuleUpdate = () => {
    if (editingRuleId && editingRuleText.trim()) {
      onUpdateRule(editingRuleId, editingRuleText.trim());
      setEditingRuleId(null);
    }
  };

  const projectGroups = projectsRootId ? urlGroups.filter(g => g.parentId === projectsRootId) : [];

  return (
    <>
      <div className="relative bg-white shadow-lg rounded-lg h-full flex flex-col border border-gray-200 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 z-20 flex items-center justify-center" aria-hidden="true">
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">응답 생성 중...</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => setMobileView('workspace')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
              mobileView === 'workspace' ? 'text-purple-600 border-purple-600 bg-white shadow-sm' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Briefcase size={16} />
            <span>프로젝트</span>
          </button>
          <button
            id="tutorial-tab-library"
            onClick={() => setMobileView('library')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
              mobileView === 'library' ? 'text-blue-600 border-blue-600 bg-white shadow-sm' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Database size={16} />
            <span>법령 및 자료실</span>
          </button>
        </div>

        <div className="flex flex-col flex-grow overflow-hidden">
          {/* Library Pane */}
          <div className={`w-full h-full flex flex-row divide-x divide-gray-100 ${mobileView === 'library' ? 'flex' : 'hidden'}`}>
            {/* Group Manager (Left Side) - Only Law folders now */}
            <div className="w-[280px] flex flex-col overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {onCloseSidebar && (
                      <button onClick={onCloseSidebar} className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors" aria-label="자료실 닫기">
                        <PanelLeftClose size={18} />
                      </button>
                    )}
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">자료실 폴더</h2>
                </div>
                <div id="tutorial-import-export" className="flex items-center gap-1">
                  <input type="file" ref={importInputRef} onChange={handleImportFileSelect} className="hidden" accept="application/json" />
                  <button onClick={() => importInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="구성 가져오기 (.json)"><UploadCloud size={16} /></button>
                  <button onClick={onExportGroups} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="구성 내보내기 (.json)"><DownloadCloud size={16} /></button>
                </div>
              </div>
              
              <div className="flex-grow overflow-y-auto px-1 chat-container">
                {/* Law Library */}
                <div className="mt-4 mb-6 px-3">
                   <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                         <Scale size={14} className="text-blue-600" />
                         법제처 및 자료실
                      </h3>
                   </div>
                   <div className="space-y-1">
                      {isGroupsLoading ? (
                        <div className="space-y-3 py-2 px-1">
                          {[1, 2, 3, 4, 5, 6].map((idx) => (
                            <div key={idx} className="flex items-center gap-2.5 animate-pulse">
                              <div className="w-5 h-5 bg-slate-100 rounded-md"></div>
                              <div className="h-3.5 bg-slate-100 rounded flex-grow"></div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        renderGroupTree(null, 0, false)
                      )}
                   </div>
                </div>
              </div>

              <div className="p-3 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
                {isAddingGroup ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="폴더명..." className="flex-grow h-8 py-1 px-3 border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500/30 transition-all text-xs" onKeyPress={e => e.key === 'Enter' && handleCreateGroup()} autoFocus />
                    <button onClick={handleCreateGroup} className="h-8 w-8 p-1 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0"><Check size={16} /></button>
                    <button onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }} className="h-8 w-8 p-1 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0"><X size={16} /></button>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingGroup(true)} className="w-full h-8 flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-700 rounded-lg transition-colors text-[11px] font-bold border border-blue-100 shadow-sm">
                    <FolderPlus size={14} /> 폴더 추가
                  </button>
                )}
              </div>
            </div>

            {/* Asset Manager (Right Side) */}
            <div className="flex-1 flex flex-col bg-gray-50/50 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Database size={18} className="text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-sm font-bold text-gray-800 truncate" title={`"${activeGroupName}"`}>
                        {activeGroupName}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {hasSubfolders ? `하위 포함 ${totalRecursiveAssets}개 자료` : `${totalAssets}개 자료`}
                      </p>
                    </div>
                </div>
              </div>

              <div className="p-4 space-y-3 border-b border-gray-200 flex-shrink-0 bg-white shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="relative flex-grow">
                    <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="url" value={currentUrlInput} onChange={(e) => setCurrentUrlInput(e.target.value)} placeholder="법령/지침 URL 입력하여 추가..." className="w-full h-10 py-1 pl-10 pr-3 border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-blue-500/30 transition-all text-xs font-medium" onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()} />
                  </div>
                  <button onClick={handleAddUrl} disabled={urls.length >= maxUrls} className="h-10 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-colors disabled:bg-gray-300 flex items-center justify-center gap-2 font-bold text-xs"><Plus size={16} /> 추가</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={files.length >= maxFiles} className="flex-1 h-10 flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-700 rounded-xl transition-colors text-xs font-bold border border-gray-200 disabled:opacity-50 shadow-sm"><Upload size={14} /> 파일 업로드</button>
                  <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                </div>
              </div>

              <div className="flex-grow overflow-y-auto p-4 chat-container">
                {error && <p className="text-[11px] text-red-600 mb-3 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2"><X size={14} /> {error}</p>}
                
                {/* Render Subfolders in the Asset list */}
                {(() => {
                  const subfolders = activeGroup ? urlGroups.filter(g => g.parentId === activeGroup.id) : [];
                  if (subfolders.length === 0) return null;
                  return (
                    <div className="space-y-3 mb-6">
                      <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">하위 카테고리 폴더</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {subfolders.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => onSetGroupId(sub.id)}
                            className="flex items-center gap-3.5 p-4 bg-white hover:bg-blue-50/40 border border-gray-100 hover:border-blue-200 rounded-2xl transition-all text-left shadow-sm hover:shadow-md group"
                          >
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors shadow-inner">
                              <Folder size={18} className="text-blue-500" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-black text-gray-900 truncate tracking-tight">{sub.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-black text-gray-500 uppercase font-mono">FOLDER</span>
                                <span className="text-[10px] text-gray-400 font-medium">자료 {countAllAssets(sub, urlGroups)}개</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const subfolders = activeGroup ? urlGroups.filter(g => g.parentId === activeGroup.id) : [];
                    if (subfolders.length === 0 && totalAssets === 0) {
                      return (
                        <div className="text-center py-12 px-4 text-xs text-gray-400 bg-white/50 rounded-2xl border-2 border-dashed border-gray-100 mt-2">
                          <Database size={32} className="mx-auto mb-3 opacity-10" />
                          <p className="font-bold text-gray-500 mb-1">자료가 아직 없습니다.</p>
                          <p>URL을 등록하거나 관련 파일을 업로드하여<br/>지식 베이스를 구축하세요.</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {urls.map((urlItem) => (
                    <div key={urlItem.id} className="flex items-center p-3 bg-white hover:bg-blue-50/50 border border-gray-100 hover:border-blue-200 rounded-xl text-xs group transition-all shadow-sm hover:shadow-md">
                      <div className="p-2 bg-blue-50 rounded-lg mr-3 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                        <LinkIcon size={16} className="text-blue-500" />
                      </div>
                      <div className="flex-grow min-w-0 mr-3">
                        {editingUrlId === urlItem.id ? (
                          <input type="text" value={editingUrlName} onChange={(e) => setEditingUrlName(e.target.value)} className="w-full h-8 px-2 border border-blue-300 bg-white text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold" onKeyDown={(e) => e.key === 'Enter' && handleSaveUrlRename()} autoFocus />
                        ) : (
                          <div className="flex flex-col">
                            <a 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                if(urlItem.url.startsWith("law://")) { 
                                  const urlParams = new URLSearchParams(urlItem.url.replace("law://", "")); 
                                  onOpenViewer?.({ type: 'law', target: urlParams.get("target") || "law", lawId: urlParams.get("law_id") || "", article: urlParams.get("article") || undefined }); 
                                } else { 
                                  onOpenViewer?.({ type: 'web', url: urlItem.url }); 
                                } 
                              }} 
                              href={urlItem.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              referrerPolicy="no-referrer" 
                              className="text-gray-900 hover:text-blue-600 truncate font-bold text-[13px] tracking-tight" 
                              title={urlItem.url}
                            >
                              {urlItem.name}
                            </a>
                            <span className="text-[10px] text-gray-400 truncate opacity-60">{urlItem.url}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingUrlId === urlItem.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={handleSaveUrlRename} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg"><Check size={16} /></button>
                            <button onClick={handleCancelUrlEditing} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg"><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleStartUrlEditing(urlItem)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="이름 수정"><Pencil size={14} /></button>
                            <button onClick={() => setMovingAsset({id: urlItem.id, type: 'url'})} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="이동"><MoveRight size={14} /></button>
                            <button onClick={() => onRemoveUrl(urlItem.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="삭제"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {files.map((file) => (
                    <div key={file.id} className="flex items-center p-3 bg-white hover:bg-blue-50/50 border border-gray-100 hover:border-blue-200 rounded-xl text-xs group transition-all shadow-sm hover:shadow-md">
                      <div className="mr-3 flex-shrink-0">
                        {file.mimeType?.startsWith('image/') ? (
                            <img src={file.base64Data || file.content} alt={file.name} className="w-10 h-10 object-cover rounded-lg cursor-pointer border border-gray-100" onClick={() => onOpenViewer?.({ type: 'file', file })} />
                        ) : (
                            <button className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors" onClick={() => onOpenViewer?.({ type: 'file', file })}>{getFileIcon(file.mimeType)}</button>
                        )}
                      </div>
                      <div className="flex-grow min-w-0 mr-3">
                        <button className="text-left font-bold text-gray-900 hover:text-blue-600 truncate w-full text-[13px] tracking-tight" title={file.name} onClick={() => onOpenViewer?.({ type: 'file', file })}>{file.name}</button>
                        <p className="text-[10px] text-gray-400 font-medium">내부 업로드 자료</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => {e.stopPropagation(); onOpenViewer?.({ type: 'file', file });}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="미리보기"><Eye size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); setMovingAsset({ id: file.id, type: 'file' });}} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="이동"><MoveRight size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); onRemoveFile(file.id);}} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="삭제"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Workspace Pane */}
          <div className={`w-full h-full flex flex-col ${mobileView === 'workspace' ? 'flex' : 'hidden'}`}>
            <div className="flex p-1 bg-gray-100/50 m-2 rounded-lg gap-1">
              <button
                id="tutorial-subtab-projects"
                onClick={() => setWorkspaceSubView('projects')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  workspaceSubView === 'projects' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Briefcase size={14} />
                프로젝트 관리
              </button>
            </div>

            {/* Project Manager Content */}
            <div className={`flex-grow flex flex-row divide-x divide-gray-100 overflow-hidden ${workspaceSubView === 'projects' ? 'flex' : 'hidden'}`}>
              {/* Projects Sidebar (Left) */}
              <div className="w-[280px] flex flex-col overflow-hidden bg-white border-r border-gray-100">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {onCloseSidebar && (
                      <button onClick={onCloseSidebar} className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors" aria-label="프로젝트 닫기">
                        <PanelLeftClose size={18} />
                      </button>
                    )}
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-tight">프로젝트 목록</h2>
                  </div>
                </div>
                
                <div className="flex-grow overflow-y-auto px-1 chat-container bg-white">
                    <div className="pt-2 space-y-1">
                      {isGroupsLoading ? (
                        <div className="space-y-3 py-2 px-2">
                          {[1, 2, 3].map((idx) => (
                            <div key={idx} className="flex items-center gap-2.5 px-2 py-2.5 animate-pulse border border-slate-50 rounded-xl bg-slate-50/20">
                              <div className="w-6 h-6 bg-slate-100 rounded-lg"></div>
                              <div className="space-y-1.5 flex-grow">
                                <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                                <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        renderGroupTree(projectsRootId || null, 0, true)
                      )}
                    </div>
                </div>

                <div className="p-3 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
                  {isAddingProject ? (
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-purple-100 shadow-lg animate-in zoom-in-95 duration-200">
                      <input 
                        type="text" 
                        value={newGroupName} 
                        onChange={e => setNewGroupName(e.target.value)} 
                        placeholder="새 프로젝트 이름..." 
                        className="w-full h-9 py-1 px-3 border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500/30 transition-all text-xs font-bold" 
                        onKeyPress={e => e.key === 'Enter' && handleCreateProject()}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 pt-1 border-t border-gray-50">
                        <button onClick={() => { setIsAddingProject(false); setNewGroupName(''); setProjectAddress(''); }} className="px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-100 rounded-lg font-bold">취소</button>
                        <button onClick={handleCreateProject} className="px-4 py-1.5 text-[11px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-black shadow-md shadow-purple-100">프로젝트 생성</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsAddingProject(true)} className="w-full h-9 flex items-center justify-center gap-2 bg-white hover:bg-purple-50 text-purple-700 rounded-xl transition-all text-[11px] font-bold border border-purple-100 shadow-sm">
                        <Plus size={14} /> 프로젝트 추가
                    </button>
                  )}
                </div>
              </div>

              {/* Project Asset Manager (Right Side) */}
              <div className="flex-1 flex flex-col bg-gray-50/50 overflow-hidden">
                {isProject && activeGroup ? (
                   <>
                    <div className="px-4 py-3 flex flex-col border-b border-gray-100 flex-shrink-0 bg-white">
                      <div className="flex items-center justify-between mb-3 min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg">
                              <Briefcase size={18} className="text-purple-600" />
                            </div>
                            <div className="flex flex-col">
                              <h3 className="text-sm font-bold text-gray-800 truncate" title={activeGroupName}>
                                {activeGroupName}
                              </h3>
                              <p className="text-[10px] text-gray-500 font-medium">관리 데스크보드</p>
                            </div>
                        </div>
                      </div>

                      {/* Project Sub-Tabs */}
                      <div className="flex gap-4 border-b border-transparent">
                        <button 
                          onClick={() => setProjectSubTab('overview')}
                          className={`pb-2 text-xs font-bold transition-all relative ${projectSubTab === 'overview' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          대시보드
                          {projectSubTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />}
                        </button>
                        <button 
                          onClick={() => setProjectSubTab('analysis')}
                          className={`pb-2 text-xs font-bold transition-all relative ${projectSubTab === 'analysis' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          대지상세분석
                          {projectSubTab === 'analysis' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />}
                        </button>
                        <button 
                          onClick={() => setProjectSubTab('laws')}
                          className={`pb-2 text-xs font-bold transition-all relative ${projectSubTab === 'laws' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          법정자료
                          {projectSubTab === 'laws' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />}
                        </button>
                        <button 
                          onClick={() => setProjectSubTab('materials')}
                          className={`pb-2 text-xs font-bold transition-all relative ${projectSubTab === 'materials' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          업로드자료
                          {projectSubTab === 'materials' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />}
                        </button>
                        <button 
                          onClick={() => setProjectSubTab('settings')}
                          className={`pb-2 text-xs font-bold transition-all relative ${projectSubTab === 'settings' ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          설정
                          {projectSubTab === 'settings' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex-grow overflow-y-auto chat-container">
                      {projectSubTab === 'overview' && (() => {
                        const hasLawsDoc = activeGroup.files.some(f => f.name.includes('법규') || f.name.includes('요약'));
                        const hasAnalysisDoc = activeGroup.files.some(f => f.name.includes('분석') || f.name.includes('조회') || f.name.includes('토지이음'));
                        const isAnalyzed = !!activeGroup.projectAddress;

                        const lawProgress = hasLawsDoc ? 100 : (isAnalyzed ? 65 : 15);
                        const analysisProgress = hasAnalysisDoc ? 100 : (isAnalyzed ? 50 : 10);

                        const parseNumber = (val: any): number => {
                          if (!val) return 0;
                          const cleaned = String(val).replace(/[^0-9.]/g, '');
                          return parseFloat(cleaned) || 0;
                        };

                        const bo = activeGroup.buildingOverview || {};
                        const landAreaVal = bo.landArea || '';
                        const parsedLandArea = parseNumber(landAreaVal);

                        const bcrLegalMax = bo.legalValues?.bcr || '60%';
                        const parsedBcr = parseNumber(bcrLegalMax);

                        const farLegalMax = bo.legalValues?.far || '200%';
                        const parsedFar = parseNumber(farLegalMax);

                        // Calculate dynamic architectural max values based on land area from analysis
                        const computedLegalBuildingArea = parsedLandArea && parsedBcr ? (parsedLandArea * parsedBcr / 100) : 0;
                        const computedLegalFloorArea = parsedLandArea && parsedFar ? (parsedLandArea * parsedFar / 100) : bo.legalValues?.far ? (parsedLandArea * parseNumber(bo.legalValues.far) / 100) : 0;

                        const formatArea = (num: number) => {
                          if (!num) return '';
                          return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ㎡';
                        };

                        return (
                          <div className="p-4 space-y-4 animate-in fade-in duration-300">
                            {/* Dashboard Header / Status */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="bg-gradient-to-br from-purple-900 to-indigo-900 p-6 rounded-3xl text-white shadow-xl shadow-purple-200/50 relative overflow-hidden group">
                                 <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
                                 <div className="flex justify-between items-start mb-8">
                                    <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/10">
                                       <Briefcase size={20} />
                                    </div>
                                    <span className="px-2.5 py-1 bg-green-400/20 text-green-300 rounded-full text-[10px] font-black tracking-widest border border-green-400/30">CURRENT PROJECT</span>
                                 </div>
                                 <h3 className="text-xl font-black mb-1.5 leading-tight tracking-tighter truncate">{activeGroup.name}</h3>
                                 <p className="text-white/60 text-[11px] font-medium leading-relaxed line-clamp-2 mb-6 h-8">{activeGroup.projectAddress || "주소가 등록되지 않았습니다."}</p>
                                 <div className="flex items-center gap-6 border-t border-white/10 pt-5">
                                    <div>
                                       <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1">자료 수 (Assets)</p>
                                       <p className="text-base font-black tracking-tight">{activeGroup.files.length + activeGroup.urls.length} items</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-1">상태 (Status)</p>
                                       <p className="text-base font-black tracking-tight">검토 중</p>
                                    </div>
                                 </div>
                              </div>
                              
                              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center space-y-5">
                                 <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">분석 진행률 (Analysis Progress)</h4>
                                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                                 </div>
                                 <div className="space-y-5">
                                    <div className="space-y-2">
                                       <div className="flex justify-between text-[11px] font-black tracking-tight">
                                          <span className="text-gray-800">법규/지침 검토</span>
                                          <span className="text-purple-600">{lawProgress}%</span>
                                       </div>
                                       <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-purple-600 rounded-full transition-all duration-1000" style={{ width: `${lawProgress}%` }}></div>
                                       </div>
                                    </div>
                                    <div className="space-y-2">
                                       <div className="flex justify-between text-[11px] font-black tracking-tight">
                                          <span className="text-gray-800">필지 상세 분석</span>
                                          <span className="text-blue-500">{analysisProgress}%</span>
                                       </div>
                                       <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${analysisProgress}%` }}></div>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                            </div>

                            {/* Building Overview Dashboard (건축개요) */}
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                               <div className="flex items-center justify-between mb-6">
                                  <h4 className="text-[14px] font-black text-gray-900 flex items-center gap-2.5">
                                     <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <Layout size={16} className="text-purple-600" />
                                     </div>
                                     핵심 건축개요 (Summary Dashboard)
                                  </h4>
                                  {isEditingOverview ? (
                                     <div className="flex items-center gap-1.5">
                                        <button 
                                          onClick={async () => {
                                            if (onUpdateGroup) {
                                              const updatedBo = {
                                                ...bo,
                                                ...tempOverview,
                                                legalValues: {
                                                  ...(bo.legalValues || {}),
                                                  ...(tempOverview.legalValues || {})
                                                },
                                                notes: {
                                                  ...(bo.notes || {}),
                                                  ...(tempOverview.notes || {})
                                                },
                                                targetValues: {
                                                  ...(bo.targetValues || {}),
                                                  ...(tempOverview.targetValues || {})
                                                },
                                                parkingCount: {
                                                  ...(bo.parkingCount || {}),
                                                  ...(tempOverview.parkingCount || {})
                                                }
                                              };
                                              await onUpdateGroup(activeGroup.id, {
                                                buildingOverview: updatedBo
                                              });
                                            }
                                            setIsEditingOverview(false);
                                          }}
                                          className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all"
                                          title="저장"
                                        >
                                           <Check size={16} />
                                        </button>
                                        <button 
                                          onClick={() => {
                                            setIsEditingOverview(false);
                                          }}
                                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                          title="취소"
                                        >
                                           <X size={16} />
                                        </button>
                                     </div>
                                  ) : (
                                     <button 
                                       onClick={() => {
                                         setTempOverview({
                                           ...bo,
                                           legalValues: bo.legalValues || {},
                                           notes: bo.notes || {},
                                           targetValues: bo.targetValues || {},
                                           parkingCount: bo.parkingCount || bo.parkingCount || {}
                                         });
                                         setIsEditingOverview(true);
                                       }}
                                       className="p-2 text-gray-400 hover:text-purple-900 hover:bg-gray-50 rounded-lg transition-all"
                                       title="수정"
                                     >
                                        <Edit3 size={16} />
                                     </button>
                                  )}
                               </div>
                               
                               <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-inner bg-gray-50/10">
                                  <table className="w-full text-left text-xs border-collapse">
                                     <thead>
                                        <tr className="bg-gray-50/80 border-b border-gray-100">
                                           <th className="p-4 font-black text-gray-400 uppercase tracking-tighter w-1/4">구분 (Category)</th>
                                           <th className="p-4 font-black text-gray-400 uppercase tracking-tighter w-1/4">법정 (Legal Max)</th>
                                           <th className="p-4 font-black text-purple-700 uppercase tracking-tighter w-1/4 bg-purple-50/30">계획 (Target)</th>
                                           <th className="p-4 font-black text-gray-400 uppercase tracking-tighter w-1/4">비고 (Notes)</th>
                                        </tr>
                                     </thead>
                                     <tbody className="divide-y divide-gray-50 text-slate-700">
                                        <tr className="hover:bg-gray-50/50 transition-colors">
                                           <td className="p-4 font-bold text-gray-700 bg-gray-50/10">대지면적</td>
                                           <td className="p-4 font-bold text-gray-900">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.landArea || ''} 
                                                   onChange={e => setTempOverview({...tempOverview, landArea: e.target.value})} 
                                                   placeholder="대지면적 (예: 500.00 m²)"
                                                 />
                                              ) : (
                                                 bo.landArea || "500.00 ㎡"
                                              )}
                                           </td>
                                           <td className="p-4 font-black text-purple-700 bg-purple-50/10 text-center">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.targetValues?.landArea || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      targetValues: { ...(tempOverview.targetValues || {}), landArea: e.target.value }
                                                   })} 
                                                   placeholder="계획면적"
                                                 />
                                              ) : (
                                                 bo.targetValues?.landArea || bo.landArea || "-"
                                              )}
                                           </td>
                                           <td className="p-4 text-gray-400 font-medium italic">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.notes?.landArea || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      notes: { ...(tempOverview.notes || {}), landArea: e.target.value }
                                                   })} 
                                                   placeholder="비고"
                                                 />
                                              ) : (
                                                 bo.notes?.landArea || "필지 합산 산정"
                                              )}
                                           </td>
                                        </tr>

                                        <tr className="hover:bg-gray-50/50 transition-colors">
                                           <td className="p-4 font-bold text-gray-700 bg-gray-50/10">건축면적</td>
                                           <td className="p-4 font-bold text-red-500">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.legalValues?.buildingArea || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      legalValues: { ...(tempOverview.legalValues || {}), buildingArea: e.target.value }
                                                   })} 
                                                   placeholder="법정 건축면적"
                                                 />
                                              ) : (
                                                 bo.legalValues?.buildingArea || (computedLegalBuildingArea ? `≤ ${formatArea(computedLegalBuildingArea)}` : "≤ 300.00 ㎡")
                                              )}
                                           </td>
                                           <td className="p-4 font-black text-purple-700 bg-purple-50/10 text-center">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.buildingArea || ''} 
                                                   onChange={e => setTempOverview({...tempOverview, buildingArea: e.target.value})} 
                                                   placeholder="계획면적"
                                                 />
                                              ) : (
                                                 bo.buildingArea || "-"
                                              )}
                                           </td>
                                           <td className="p-4 text-gray-500 font-bold">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.notes?.buildingArea || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      notes: { ...(tempOverview.notes || {}), buildingArea: e.target.value }
                                                   })} 
                                                   placeholder="비고"
                                                 />
                                              ) : (
                                                 bo.notes?.buildingArea || (parsedBcr ? `건폐율 ${parsedBcr}% 기준` : "건폐율 60% 기준")
                                              )}
                                           </td>
                                        </tr>

                                        <tr className="hover:bg-gray-50/50 transition-colors">
                                           <td className="p-4 font-bold text-gray-700 bg-gray-50/10">연면적</td>
                                           <td className="p-4 font-bold text-red-500">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.legalValues?.totalFloorArea || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      legalValues: { ...(tempOverview.legalValues || {}), totalFloorArea: e.target.value }
                                                   })} 
                                                   placeholder="법정 연면적"
                                                 />
                                              ) : (
                                                 bo.legalValues?.totalFloorArea || (computedLegalFloorArea ? `≤ ${formatArea(computedLegalFloorArea)}` : "≤ 1000.00 ㎡")
                                              )}
                                           </td>
                                           <td className="p-4 font-black text-purple-700 bg-purple-50/10 text-center">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.totalFloorAreaForFar || ''} 
                                                   onChange={e => setTempOverview({...tempOverview, totalFloorAreaForFar: e.target.value})} 
                                                   placeholder="계획면적"
                                                 />
                                              ) : (
                                                 bo.totalFloorAreaForFar || "-"
                                              )}
                                           </td>
                                           <td className="p-4 text-gray-500 font-bold">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.notes?.totalFloorArea || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      notes: { ...(tempOverview.notes || {}), totalFloorArea: e.target.value }
                                                   })} 
                                                   placeholder="비고"
                                                 />
                                              ) : (
                                                 bo.notes?.totalFloorArea || (parsedFar ? `용적률 ${parsedFar}% 기준` : "용적률 200% 기준")
                                              )}
                                           </td>
                                        </tr>

                                        <tr className="hover:bg-gray-50/50 transition-colors">
                                           <td className="p-4 font-bold text-gray-700 bg-gray-50/10">주차대수</td>
                                           <td className="p-4 font-bold text-gray-900">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.parkingCount?.legal || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      parkingCount: { ...(tempOverview.parkingCount || {}), legal: e.target.value }
                                                   })} 
                                                   placeholder="법정 주차대수"
                                                 />
                                              ) : (
                                                 bo.parkingCount?.legal || "법정 8대 이상"
                                              )}
                                           </td>
                                           <td className="p-4 font-black text-purple-700 bg-purple-50/10 text-center">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.parkingCount?.planned || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      parkingCount: { ...(tempOverview.parkingCount || {}), planned: e.target.value }
                                                   })} 
                                                   placeholder="계획대수"
                                                 />
                                              ) : (
                                                 bo.parkingCount?.planned || bo.parkingCount?.legal || "-"
                                              )}
                                           </td>
                                           <td className="p-4 text-gray-400 font-medium italic">
                                              {isEditingOverview ? (
                                                 <input 
                                                   type="text" 
                                                   className="w-full text-xs p-1 border border-gray-200 rounded text-center focus:ring-1 focus:ring-purple-500 outline-none font-medium" 
                                                   value={tempOverview.notes?.parking || ''} 
                                                   onChange={e => setTempOverview({
                                                      ...tempOverview, 
                                                      notes: { ...(tempOverview.notes || {}), parking: e.target.value }
                                                   })} 
                                                   placeholder="비고"
                                                 />
                                              ) : (
                                                 bo.notes?.parking || "상세 설계 필요"
                                              )}
                                           </td>
                                        </tr>
                                     </tbody>
                                  </table>
                               </div>
                            </div>

                          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                             <div className="flex items-center justify-between mb-4">
                                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1.5">
                                   <MessageSquare size={14} /> 주요 대화 맥락 (Recent Discussions)
                                </h4>
                             </div>
                             <div className="space-y-2">
                                {chatSessions.length > 0 ? (
                                   chatSessions.slice(0, 3).map(session => (
                                      <button
                                         key={session.id}
                                         onClick={() => onSwitchSession(session.id)}
                                         className={`w-full text-left p-3 rounded-xl transition-all border flex items-center gap-3 ${activeSessionId === session.id ? 'bg-purple-600 border-purple-700 text-white shadow-md' : 'bg-gray-50 border-gray-100 hover:bg-purple-50 hover:border-purple-200 text-gray-700'}`}
                                      >
                                         <div className={`p-1.5 rounded-lg ${activeSessionId === session.id ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                                            <Clock size={14} className={activeSessionId === session.id ? 'text-white' : 'text-purple-500'} />
                                         </div>
                                         <span className="text-[11px] font-bold truncate">Project Consultation #{session.id.split('-').pop()}</span>
                                      </button>
                                   ))
                                ) : (
                                   <div className="text-center py-6 text-gray-400 border border-dashed border-gray-100 rounded-xl">
                                      <p className="text-[10px] font-medium italic">기록된 대화가 없습니다.</p>
                                   </div>
                                )}
                             </div>
                          </div>
                        </div>
                      )})()}

                      {projectSubTab === 'analysis' && (
                        <div className="p-4 space-y-4 animate-in fade-in duration-300">
                           {activeGroup.parentId === projectsRootId && (
                            <>
                              {/* Analysis Address Search */}
                              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-lg ring-1 ring-purple-100/30">
                                <div className="flex items-center gap-3 mb-6">
                                  <div className="w-10 h-10 rounded-2xl bg-purple-900 flex items-center justify-center text-white shadow-lg shadow-purple-900/20">
                                    <MapPin size={20} />
                                  </div>
                                  <div className="flex-grow">
                                    <h3 className="text-[15px] font-black text-gray-900 tracking-tight">분석 대상 지번 (Site Search)</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Multi-Lot Address Input System</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="flex flex-col gap-2">
                                     {(() => {
                                       let addresses = addressInput.split('\n');
                                       if (addresses.length === 0 || (addresses.length === 1 && addresses[0] === "")) addresses = [""];
                                       
                                       const isAnalyzed = activeGroup.projectAddress && addressInput.trim() === activeGroup.projectAddress.trim() && !isManualAddressEdit;

                                       if (isAnalyzed) {
                                          return (
                                            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50 text-sm text-purple-900 font-black whitespace-pre-wrap flex items-start gap-4">
                                                <div className="p-1.5 bg-white rounded-lg shadow-sm mt-0.5">
                                                  <Check size={14} className="text-green-500" />
                                                </div>
                                                <div className="flex-grow">{activeGroup.projectAddress}</div>
                                                <button onClick={() => setIsManualAddressEdit(true)} className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-white rounded-lg transition-all"><Edit2 size={14} /></button>
                                            </div>
                                          )
                                       }

                                       return addresses.map((addr, idx) => (
                                         <div className="flex gap-2 mb-2" key={idx}>
                                           <div className="flex-grow relative">
                                                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black" />
                                                <input 
                                                    type="text" 
                                                    value={addr} 
                                                    onChange={e => {
                                                        const newAddrs = [...addresses];
                                                        newAddrs[idx] = e.target.value;
                                                        setAddressInput(newAddrs.join('\n'));
                                                    }}
                                                    onBlur={() => onUpdateGroupAddress?.(activeGroup.id, addresses.join('\n'))}
                                                    placeholder="분석할 지번 주소를 입력하세요..."
                                                    className="w-full text-sm py-3.5 pl-10 pr-4 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-purple-500/5 bg-gray-50/50 font-black transition-all"
                                                />
                                           </div>
                                           {idx === addresses.length - 1 ? (
                                             <button onClick={() => setAddressInput(addresses.join('\n') + '\n')} className="w-12 h-12 flex-shrink-0 bg-white border border-gray-200 text-gray-400 rounded-xl hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-all flex items-center justify-center font-black shadow-sm group">
                                                <Plus size={20} className="group-hover:scale-110 transition-transform" />
                                             </button>
                                           ) : (
                                             <button onClick={() => {
                                               const newAddrs = addresses.filter((_, i) => i !== idx);
                                               setAddressInput(newAddrs.length === 0 ? "" : newAddrs.join('\n'));
                                             }} className="w-12 h-12 flex-shrink-0 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-black">
                                                <Trash2 size={18} />
                                             </button>
                                           )}
                                         </div>
                                       ));
                                     })()}
                                   </div>

                                   {(!activeGroup.projectAddress || isManualAddressEdit) && addressInput.trim() && (
                                     <button 
                                       onClick={() => {
                                          onAnalyzeAddress(activeGroup.id, addressInput.trim());
                                          setIsManualAddressEdit(false);
                                       }}
                                       className="w-full flex items-center justify-center gap-3 py-4.5 bg-purple-900 text-white rounded-2xl text-[14px] hover:bg-purple-800 transition-all shadow-xl shadow-purple-900/30 font-black tracking-tight"
                                     >
                                       <Sparkles size={18} className="animate-pulse" /> 정밀 토지 분석 및 법규 제안 연동
                                     </button>
                                   )}
                                </div>
                              </div>
                              
                              {/* Analysis Generated Files */}
                              <div className="space-y-4">
                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">분석 생성 데이터 (Generated Data)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {activeGroup.files.filter(f => f.name.includes('분석') || f.name.includes('요약') || f.name.includes('조회')).length > 0 ? (
                                    activeGroup.files.filter(f => f.name.includes('분석') || f.name.includes('요약') || f.name.includes('조회')).map(file => (
                                      <button
                                        key={file.id}
                                        onClick={() => onOpenViewer?.({ type: 'file', file })}
                                        className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-200 transition-all group text-left animate-in fade-in zoom-in-95 duration-500"
                                      >
                                        <div className="p-3.5 bg-purple-50 rounded-2xl group-hover:bg-purple-100 transition-colors shadow-inner">
                                          <FileText size={28} className="text-purple-600" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-[15px] font-black text-gray-900 leading-tight mb-1 truncate tracking-tight">{file.name}</span>
                                          <div className="flex items-center gap-2">
                                             <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-black uppercase">ANALYSIS</span>
                                             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Insight Document</span>
                                          </div>
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="col-span-full py-12 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                       <Activity size={32} className="mx-auto mb-3 opacity-20 text-purple-900" />
                                       <p className="text-xs font-bold text-gray-400">분석된 데이터가 없습니다. 상단에서 분석을 시작하세요.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {projectSubTab === 'laws' && (
                        <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          {/* Automated Law Folders Exploration */}
                          {urlGroups.some(g => g.parentId === activeGroup.id) && (
                             <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                 <h4 className="text-[11px] font-black text-purple-900 uppercase tracking-tighter flex items-center gap-2">
                                   <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                                      <Folder size={14} className="text-purple-600" />
                                   </div>
                                   검토 법규 및 라이브러리 (Legal Folders)
                                 </h4>
                               </div>
                               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                 {urlGroups.filter(g => g.parentId === activeGroup.id).map(sub => (
                                   <button
                                     key={sub.id}
                                     onClick={() => onSetGroupId(sub.id)}
                                     className="flex flex-col gap-3 p-4 bg-white hover:bg-purple-50/50 border border-gray-100 hover:border-purple-200 rounded-2xl transition-all text-left animate-in zoom-in-95 duration-300 shadow-sm hover:shadow-md group"
                                   >
                                     <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100 transition-colors shadow-inner">
                                       <Folder size={20} className="text-purple-500" />
                                     </div>
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-[14px] font-bold text-gray-900 truncate tracking-tight">{sub.name}</span>
                                       <div className="flex items-center gap-2 mt-1">
                                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-black text-gray-500 uppercase">FOLDER</span>
                                          <span className="text-[10px] text-gray-400 font-medium">자료 {countAllAssets(sub, urlGroups)}개</span>
                                       </div>
                                     </div>
                                   </button>
                                 ))}
                               </div>
                             </div>
                          )}

                          {/* Manual Law URLs Area */}
                          <div className="space-y-4 pt-4 border-t border-gray-100">
                             <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                   직접 등록한 법령 (Manual Links)
                                </h4>
                             </div>
                             <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 space-y-4">
                                <div className="flex items-center gap-2">
                                   <div className="relative flex-grow">
                                     <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                     <input type="url" value={currentUrlInput} onChange={(e) => setCurrentUrlInput(e.target.value)} placeholder="관련 법령/지침 URL 추가..." className="w-full h-10 py-1 pl-10 pr-3 border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500/10 transition-all text-xs font-medium" onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()} />
                                   </div>
                                   <button onClick={handleAddUrl} disabled={urls.length >= maxUrls} className="h-10 px-4 bg-purple-900 hover:bg-purple-800 text-white rounded-xl transition-colors disabled:bg-gray-300 flex items-center justify-center gap-2 font-bold text-xs shadow-sm"><Plus size={16} /> 법령 등록</button>
                                </div>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {urls.length === 0 && (
                              <div className="text-center py-12 px-4 text-xs text-gray-400 bg-white/50 rounded-2xl border-2 border-dashed border-gray-100 mt-2">
                                <Scale size={32} className="mx-auto mb-3 opacity-10" />
                                <p className="font-bold text-gray-500 mb-1">등록된 법령이 없습니다.</p>
                                <p>법규 URL을 추가하세요.</p>
                              </div>
                            )}
                            {urls.map((urlItem) => (
                              <div key={urlItem.id} className="flex items-center p-3 bg-white hover:bg-purple-50/50 border border-gray-100 hover:border-purple-200 rounded-xl group transition-all shadow-sm hover:shadow-md">
                                <div className="p-2 bg-purple-50 rounded-lg mr-3 flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                                  <Scale size={16} className="text-purple-500" />
                                </div>
                                <div className="flex-grow min-w-0 mr-3">
                                  {editingUrlId === urlItem.id ? (
                                    <input type="text" value={editingUrlName} onChange={(e) => setEditingUrlName(e.target.value)} className="w-full h-8 px-2 border border-purple-300 bg-white text-gray-800 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold" onKeyDown={(e) => e.key === 'Enter' && handleSaveUrlRename()} autoFocus />
                                  ) : (
                                    <div className="flex flex-col min-w-0">
                                      <a 
                                        onClick={(e) => {
                                          e.preventDefault();
                                          if (urlItem.url?.startsWith('law://')) {
                                             try {
                                                 const urlParams = new URLSearchParams(urlItem.url.replace('law://', ''));
                                                 onOpenViewer?.({
                                                     type: 'law',
                                                     target: urlParams.get('target') || 'law',
                                                     lawId: urlParams.get('law_id') || '',
                                                     article: urlParams.get('article') || undefined
                                                 });
                                             } catch (err) {
                                                 console.error("Failed to parse law link", err);
                                             }
                                          } else {
                                             onOpenViewer?.({ type: 'web', url: urlItem.url });
                                          }
                                        }}
                                        href={urlItem.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        referrerPolicy="no-referrer" 
                                        className="text-gray-900 hover:text-purple-600 truncate font-bold text-[13px] tracking-tight" 
                                        title={urlItem.url}
                                      >
                                        {urlItem.name}
                                      </a>
                                      <span className="text-[10px] text-gray-400 truncate opacity-60">{urlItem.url}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => onRemoveUrl(urlItem.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="삭제"><Trash2 size={14} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {projectSubTab === 'materials' && (
                        <div className="p-4 space-y-4 animate-in fade-in duration-300">
                          {/* File Upload Area */}
                          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <button onClick={() => fileInputRef.current?.click()} disabled={files.length >= maxFiles} className="w-full h-12 flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all text-sm font-black disabled:opacity-50 shadow-lg shadow-purple-100"><Upload size={18} /> 프로젝트 관련 자료 업로드</button>
                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => e.target.files && onAddFiles(e.target.files)} />
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {files.length === 0 && (
                              <div className="text-center py-12 px-4 text-xs text-gray-400 bg-white/50 rounded-2xl border-2 border-dashed border-gray-100 mt-2">
                                <Database size={32} className="mx-auto mb-3 opacity-10" />
                                <p className="font-bold text-gray-500 mb-1">등록된 내부 자료가 없습니다.</p>
                                <p>PDF, 이미지, 문서 파일등을 업로드하세요.</p>
                              </div>
                            )}
                            {files.map((file) => (
                              <div key={file.id} className="flex items-center p-3 bg-white hover:bg-purple-50/50 border border-gray-100 hover:border-purple-200 rounded-xl group transition-all shadow-sm hover:shadow-md">
                                <div className="mr-3 flex-shrink-0">
                                   <div className="p-2.5 bg-gray-50 rounded-lg group-hover:bg-purple-50 transition-colors">{getFileIcon(file.mimeType)}</div>
                                </div>
                                <div className="flex-grow min-w-0 mr-3">
                                  <button className="text-left font-bold text-gray-900 hover:text-purple-600 truncate w-full text-[13px] tracking-tight" onClick={() => onOpenViewer?.({ type: 'file', file })}>{file.name}</button>
                                  <p className="text-[10px] text-gray-400 font-medium">Internal Asset</p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => {e.stopPropagation(); onRemoveFile(file.id);}} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="삭제"><Trash2 size={14} /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {projectSubTab === 'settings' && (
                        <div className="p-4 space-y-4 animate-in fade-in duration-300">
                          {/* Personal Rules Content Moved Here */}
                          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <h3 className="text-[10px] font-black text-purple-600 mb-4 uppercase tracking-widest flex items-center gap-1.5">
                              <ShieldCheck size={14} /> 나의 설계 준수 원칙 (Design Principles)
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={newRuleInput} 
                                  onChange={(e) => setNewRuleInput(e.target.value)} 
                                  placeholder="새 원칙 입력..." 
                                  className="flex-grow h-10 py-1 px-3 border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500/10 transition-all text-xs font-medium" 
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddRule()} 
                                />
                                <button 
                                  onClick={handleAddRule} 
                                  className="h-10 w-10 p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors flex items-center justify-center flex-shrink-0 shadow-md shadow-purple-100" 
                                >
                                  <Plus size={20} />
                                </button>
                              </div>

                              <div className="space-y-2 pt-2">
                                {personalRules.length === 0 ? (
                                  <div className="text-center py-8 text-gray-400 bg-purple-50/20 rounded-xl border-2 border-dashed border-purple-50">
                                    <p className="text-[10px] font-medium italic">설정된 준수 원칙이 없습니다.</p>
                                  </div>
                                ) : (
                                  personalRules.map((rule) => (
                                    <div key={rule.id} className={`p-3 rounded-xl border transition-all ${rule.isActive ? 'bg-white border-purple-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                                      {editingRuleId === rule.id ? (
                                        <div className="space-y-2">
                                          <textarea 
                                            value={editingRuleText} 
                                            onChange={(e) => setEditingRuleText(e.target.value)}
                                            className="w-full p-3 border border-purple-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500/10 outline-none min-h-[80px] font-medium"
                                            autoFocus
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingRuleId(null)} className="px-3 py-1.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded-lg font-bold">취소</button>
                                            <button onClick={handleSaveRuleUpdate} className="px-4 py-1.5 text-[10px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1 font-black shadow-md shadow-purple-100">
                                              저장하기
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-start justify-between gap-3">
                                            <p className="text-xs text-gray-700 leading-relaxed flex-grow font-bold">{rule.text}</p>
                                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                onClick={() => onToggleRule(rule.id)} 
                                                className={`p-1.5 rounded-lg transition-colors ${rule.isActive ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : 'text-gray-400 hover:bg-gray-100 bg-gray-100'}`}
                                              >
                                                {rule.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                              </button>
                                              <button 
                                                onClick={() => handleStartRuleEditing(rule)} 
                                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                                              >
                                                <Pencil size={15} />
                                              </button>
                                              <button 
                                                onClick={() => onRemoveRule(rule.id)} 
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                              >
                                                <Trash2 size={15} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                   </>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-gray-400 bg-white/50 m-4 rounded-3xl border-2 border-dashed border-gray-100">
                    <div className="text-center">
                      <Briefcase size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="font-bold text-gray-500">프로젝트를 선택해주세요.</p>
                      <p className="text-xs">좌측 목록에서 프로젝트를 선택하여 상세 내용을 확인하세요.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Personal Rules Content */}
            <div className={`flex-grow flex flex-col overflow-hidden ${workspaceSubView === 'rules' ? 'flex' : 'hidden'}`}>
              <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 flex-shrink-0 bg-white">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-purple-600" />
                  나의 원칙
                </h3>
              </div>

              <div className="p-3 space-y-2 border-b border-gray-100 flex-shrink-0 bg-white">
                <p className="text-[10px] text-gray-400 leading-tight">
                  AI가 답변할 때 참고할 당신만의 설계 원칙이나 가이드라인을 설정하세요.
                </p>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={newRuleInput} 
                    onChange={(e) => setNewRuleInput(e.target.value)} 
                    placeholder="원칙 입력..." 
                    className="flex-grow h-9 py-1 px-3 border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500/30 transition-all text-sm" 
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRule()} 
                  />
                  <button 
                    onClick={handleAddRule} 
                    className="h-9 w-9 p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0" 
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-grow overflow-y-auto p-3 chat-container bg-white">
                <div className="space-y-2">
                  {personalRules.length === 0 ? (
                    <div className="text-center py-8 px-4 text-xs text-gray-400 bg-purple-50/50 rounded-xl border-2 border-dashed border-purple-100">
                      <ShieldCheck size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="font-bold text-purple-700/50 mb-1">원칙이 없습니다.</p>
                      <p>직접 입력하거나 대화를 통해 추가하세요.</p>
                    </div>
                  ) : (
                    personalRules.map((rule) => (
                      <div key={rule.id} className={`p-2.5 rounded-xl border transition-all ${rule.isActive ? 'bg-white border-purple-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                        {editingRuleId === rule.id ? (
                          <div className="space-y-2">
                            <textarea 
                              value={editingRuleText} 
                              onChange={(e) => setEditingRuleText(e.target.value)}
                              className="w-full p-2 border border-purple-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500/30 outline-none min-h-[60px]"
                              autoFocus
                            />
                            <div className="flex justify-end gap-1.5">
                              <button onClick={() => setEditingRuleId(null)} className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded">취소</button>
                              <button onClick={handleSaveRuleUpdate} className="px-2 py-1 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1">
                                <Save size={10} /> 저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-gray-700 leading-relaxed flex-grow font-medium">{rule.text}</p>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button 
                                  onClick={() => onToggleRule(rule.id)} 
                                  className={`p-1 rounded-md transition-colors ${rule.isActive ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                  title={rule.isActive ? "비활성화" : "활성화"}
                                >
                                  {rule.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                </button>
                                <button 
                                  onClick={() => handleStartRuleEditing(rule)} 
                                  className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md"
                                  title="수정"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  onClick={() => onRemoveRule(rule.id)} 
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                  title="삭제"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Map Interface removed - now on the right side of workspace projects */}
      </div>
      
      {movingAsset && (
        <div className="fixed inset-0 bg-black/50 z-10 flex flex-col justify-end" onClick={() => setMovingAsset(null)}>
            <div className="bg-white p-3 rounded-t-lg border-t border-gray-200 shadow-lg" onClick={e => e.stopPropagation()}>
                <p className="text-sm font-medium text-center mb-2 text-gray-700">이동할 그룹 선택...</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {renderMoveGroupOptions(null, 0)}
                </div>
                <button onClick={() => setMovingAsset(null)} className="w-full text-center mt-2 p-2 rounded-md text-sm bg-red-100 text-red-700 hover:bg-red-200/60">취소</button>
            </div>
        </div>
      )}

      {copyingUrl && (
          <div className="fixed inset-0 bg-black/50 z-10 flex flex-col justify-end" onClick={() => setCopyingUrl(null)}>
              <div className="bg-white p-3 rounded-t-lg border-t border-gray-200 shadow-lg" onClick={e => e.stopPropagation()}>
                  <p className="text-sm font-medium text-center mb-2 text-gray-700">복사할 프로젝트 선택...</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                      {projectGroups.length > 0 ? (
                          projectGroups.map(group => (
                              <button
                                  key={group.id}
                                  onClick={() => handlePerformCopy(group.id)}
                                  className="w-full text-left p-2 rounded-md text-sm hover:bg-gray-100 transition-colors text-gray-700 flex items-center"
                              >
                                  <Briefcase size={16} className="mr-2 flex-shrink-0 text-purple-500" />
                                  {group.name}
                              </button>
                          ))
                      ) : (
                          <p className="text-center text-sm text-gray-500 py-4">사용 가능한 프로젝트가 없습니다.</p>
                      )}
                  </div>
                  <button onClick={() => setCopyingUrl(null)} className="w-full text-center mt-2 p-2 rounded-md text-sm bg-red-100 text-red-700 hover:bg-red-200/60">취소</button>
              </div>
          </div>
      )}
    </>
  );
};


interface GroupItemProps {
  group: URLGroup;
  level: number;
  isProject: boolean;
  urlGroups: URLGroup[];
  activeUrlGroupId: string;
  editingGroupId: string | null;
  isExpanded: boolean;
  onSetGroupId: (id: string) => void;
  onToggleExpand: (id: string) => void;
  setEditingGroupId: (id: string | null) => void;
  onRenameGroup: (id: string, name: string) => void;
  onUpdateAddress: (id: string, address: string) => void;
  onAnalyzeAddress: (id: string, address: string) => void;
  onRemoveGroup: (id: string) => void;
  onAddGroup: (name: string, parentId?: string | null) => void;
  onViewProjectDetail?: (id: string) => void;
  chatSessions: ChatSession[];
  activeSessionId: string;
  onCreateSession: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  renderGroupTree: (parentId: string, level: number, visited: Set<string>) => React.ReactNode;
  visited: Set<string>;
}

const GroupItem: React.FC<GroupItemProps> = ({
  group, level, isProject, urlGroups, activeUrlGroupId, editingGroupId, isExpanded,
  onSetGroupId, onToggleExpand, setEditingGroupId,
  onRenameGroup, onUpdateAddress, onAnalyzeAddress, onRemoveGroup, onAddGroup,
  onViewProjectDetail, chatSessions, activeSessionId, onCreateSession, onSwitchSession, onDeleteSession,
  renderGroupTree, visited
}) => {
  const [editingName, setEditingName] = useState(group.name);
  const [editingAddress, setEditingAddress] = useState(group.projectAddress || '');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isAddingSubgroup, setIsAddingSubgroup] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState('');

  const hasChildren = urlGroups.some(g => g.parentId === group.id);
  
  const totalAssets = countAllAssets(group, urlGroups);

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingName(group.name);
    setEditingGroupId(group.id);
  };

  const handleSave = (e?: React.MouseEvent | React.FocusEvent) => {
    e?.stopPropagation();
    if (editingName.trim()) {
      onRenameGroup(group.id, editingName.trim());
    }
    setEditingGroupId(null);
  };
  
  const handleCreateSubgroup = () => {
    if (newSubgroupName.trim()) {
      onAddGroup(newSubgroupName.trim(), group.id);
      setNewSubgroupName('');
      setIsAddingSubgroup(false);
      if(!isExpanded) onToggleExpand(group.id);
    }
  };
  
  const handleGroupClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingGroupId === group.id) return;
    onSetGroupId(group.id);
  };

  const handleSaveAddress = () => {
    if (onUpdateAddress) {
      onUpdateAddress(group.id, editingAddress);
    }
    setIsEditingAddress(false);
  };

  const isRootLawGroup = group.id === 'root';
  const isDirectProjectChild = group.parentId === 'projects' || (group.parentId?.endsWith('-projects'));
  
  const IconComponent = isRootLawGroup ? Scale : (isDirectProjectChild ? Briefcase : Folder);
  const iconColor = isRootLawGroup
    ? (activeUrlGroupId === group.id ? 'text-blue-600' : 'text-blue-500')
    : isDirectProjectChild 
      ? (activeUrlGroupId === group.id ? 'text-purple-600' : 'text-purple-500')
      : (activeUrlGroupId === group.id ? 'text-blue-600' : 'text-gray-400');

  return (
    <div>
      <div
        onClick={handleGroupClick}
        className={`flex items-center justify-between p-1.5 rounded-md transition-colors text-sm group ${
          activeUrlGroupId === group.id
            ? 'bg-blue-100 text-blue-800'
            : 'hover:bg-gray-200 cursor-pointer text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        <div className="flex items-center flex-grow min-w-0">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(group.id);
              }}
              className="p-0.5 hover:bg-slate-300/60 rounded text-gray-500 hover:text-gray-900 transition-colors mr-1 flex-shrink-0"
              title={isExpanded ? "접기" : "펼치기"}
            >
              <ChevronRight
                size={14}
                className={`transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
              />
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}
          <IconComponent size={14} className={`mr-1.5 flex-shrink-0 ${activeUrlGroupId === group.id ? 'text-purple-600' : 'text-gray-400'}`} />
          {editingGroupId === group.id ? (
            <input
              type="text" value={editingName}
              onChange={e => setEditingName(e.target.value)}
              className="flex-grow h-6 py-0.5 px-1 bg-white border border-purple-300 text-gray-800 rounded outline-none text-[11px] font-bold"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if(e.key === 'Escape') setEditingGroupId(null); }}
              onClick={e => e.stopPropagation()} autoFocus
              onBlur={handleSave}
            />
          ) : (
            <span className={`truncate text-[11px] ${activeUrlGroupId === group.id ? 'font-black text-purple-900' : 'font-medium text-gray-600'}`} title={group.name}>{group.name}</span>
          )}
        </div>
        
        {editingGroupId !== group.id && (
            <div className={`flex items-center flex-shrink-0 ml-2 transition-opacity ${activeUrlGroupId === group.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
               <button onClick={(e) => { e.stopPropagation(); setIsAddingSubgroup(true); }} className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-md" title="하위 그룹 추가"><FolderPlus size={14} /></button>
              <button onClick={handleStartEditing} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-md" title="이름 바꾸기"><Pencil size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id); }} className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-md disabled:text-gray-400"><Trash2 size={14} /></button>
            </div>
        )}
      </div>
      {isAddingSubgroup && (
        <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: `${(level + 1) * 20 + 4}px` }}>
          <input
            type="text" value={newSubgroupName}
            onChange={e => setNewSubgroupName(e.target.value)}
            placeholder={isProject ? "새 폴더 이름..." : "하위 그룹 이름..."}
            className="flex-grow h-7 py-1 px-1.5 border border-gray-300 bg-white text-gray-800 rounded-md focus:ring-1 focus:ring-blue-500 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleCreateSubgroup(); if (e.key === 'Escape') setIsAddingSubgroup(false);}}
            autoFocus
          />
           <button onClick={handleCreateSubgroup} className="p-1 text-green-600 hover:bg-green-100 rounded-md"><Check size={16} /></button>
           <button onClick={() => setIsAddingSubgroup(false)} className="p-1 text-red-600 hover:bg-red-100 rounded-md"><X size={16} /></button>
        </div>
      )}
      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {renderGroupTree(group.id, level + 1, visited)}
        </div>
      )}
    </div>
  );
};


export default KnowledgeBaseManager;
