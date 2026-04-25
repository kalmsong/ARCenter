/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, ReactNode, Fragment } from 'react';
import { Plus, Trash2, X, Pencil, Check, Upload, File as FileIcon, FileText, Image as ImageIcon, FileSpreadsheet, Presentation, MoveRight, LinkIcon, Eye, Folder, ChevronRight, ChevronDown, FolderPlus, Info, UploadCloud, DownloadCloud, PanelLeftClose, ChevronLeft, Briefcase, Copy, Scale, FolderTree, Database, ShieldCheck, ToggleLeft, ToggleRight, Save, MapPin, Search, Sparkles } from 'lucide-react';
import { URLGroup, KnowledgeFile, KnowledgeUrl, PersonalRule } from '../types';
import FilePreviewModal from './FilePreviewModal';
import { analyzeProjectAddress } from '../services/geminiService';

interface KnowledgeBaseManagerProps {
  urls: KnowledgeUrl[];
  files: KnowledgeFile[];
  onAddUrl: (url: string) => void;
  onRemoveUrl: (urlId: string) => void;
  onRenameUrl: (urlId: string, newName: string) => void;
  onAddFiles: (files: FileList) => void;
  onRemoveFile: (fileId: string) => void;
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
  personalRules: PersonalRule[];
  onAddRule: (text: string) => void;
  onRemoveRule: (id: string) => void;
  onToggleRule: (id: string) => void;
  onUpdateRule: (id: string, text: string) => void;
}

const getFileIcon = (mimeType: string): ReactNode => {
  if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-pink-500 flex-shrink-0" />;
  if (mimeType === 'application/pdf') return <FileText size={20} className="text-red-500 flex-shrink-0" />;
  if (mimeType.includes('wordprocessing')) return <FileText size={20} className="text-blue-500 flex-shrink-0" />;
  if (mimeType.includes('spreadsheet')) return <FileSpreadsheet size={20} className="text-green-500 flex-shrink-0" />;
  if (mimeType.includes('presentation')) return <Presentation size={20} className="text-orange-500 flex-shrink-0" />;
  return <FileIcon size={20} className="text-gray-500 flex-shrink-0" />;
};

const PROJECTS_ROOT_ID = 'projects';

// Helper to check if a group is part of the "Projects" section
const isDescendantOf = (childId: string, parentId: string, groups: URLGroup[]): boolean => {
    let current = groups.find(g => g.id === childId);
    while (current) {
        if (current.parentId === parentId) {
            return true;
        }
        if (current.id === parentId) {
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
  personalRules,
  onAddRule,
  onRemoveRule,
  onToggleRule,
  onUpdateRule
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
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [projectAddress, setProjectAddress] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [librarySubView, setLibrarySubView] = useState<'groups' | 'assets'>('groups');
  const [workspaceSubView, setWorkspaceSubView] = useState<'projects' | 'rules'>('projects');
  const [mobileView, setMobileView] = useState<'library' | 'workspace'>('library');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
     const initialState: Record<string, boolean> = {};
     urlGroups.forEach(g => { if(g.parentId) initialState[g.parentId] = true; });
     // Automatically expand ancestors of the active group
     let currentGroup = urlGroups.find(g => g.id === activeUrlGroupId);
     while(currentGroup && currentGroup.parentId) {
        initialState[currentGroup.parentId] = true;
        currentGroup = urlGroups.find(g => g.id === currentGroup?.parentId);
     }
     initialState['root'] = true; // Always expand the root
     initialState[PROJECTS_ROOT_ID] = true; // Always expand projects
     return initialState;
  });

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
    setLibrarySubView('assets');
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

  const handleCreateProject = async () => {
    if (newGroupName.trim()) {
      onAddGroup(newGroupName.trim(), PROJECTS_ROOT_ID);
      
      // If address is provided, we could analyze it here or later
      // For now, let's just add it.
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

  const getAllDescendantIds = (groupId: string): string[] => {
    const children = urlGroups.filter(g => g.parentId === groupId);
    const descendantIds: string[] = [];
    for (const child of children) {
      descendantIds.push(child.id);
      descendantIds.push(...getAllDescendantIds(child.id));
    }
    return descendantIds;
  };

  const descendantIds = getAllDescendantIds(activeUrlGroupId);
  const allRelevantGroups = urlGroups.filter(g => g.id === activeUrlGroupId || descendantIds.includes(g.id));
  const recursiveUrlCount = allRelevantGroups.reduce((acc, g) => acc + g.urls.length, 0);
  const recursiveFileCount = allRelevantGroups.reduce((acc, g) => acc + g.files.length, 0);
  const totalRecursiveAssets = recursiveUrlCount + recursiveFileCount;

  const activeGroup = urlGroups.find(g => g.id === activeUrlGroupId);
  const activeGroupName = activeGroup?.name || "그룹 선택";
  const totalAssets = (activeGroup?.urls.length || 0) + (activeGroup?.files.length || 0);
  const isProjectGroup = isDescendantOf(activeUrlGroupId, PROJECTS_ROOT_ID, urlGroups);
  const hasSubfolders = descendantIds.length > 0;

  const renderGroupTree = (parentId: string | null = null, level = 0, filterProjects = false): React.ReactNode => {
    const childGroups = urlGroups.filter(g => g.parentId === parentId).sort((a,b) => a.name.localeCompare(b.name));

    return childGroups.map(group => {
      const isProject = group.id === PROJECTS_ROOT_ID || isDescendantOf(group.id, PROJECTS_ROOT_ID, urlGroups);
      
      // Filter logic
      if (filterProjects && !isProject && parentId === null) return null;
      if (!filterProjects && isProject && parentId === null) return null;
      if (group.id === PROJECTS_ROOT_ID && !filterProjects) return null;

      return (
        <GroupItem
          key={group.id}
          group={group}
          level={level}
          isProject={isProject}
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
          renderGroupTree={(p, l) => renderGroupTree(p, l, filterProjects)}
        />
      );
    });
  };
  
  const renderMoveGroupOptions = (parentId: string | null, level = 0): React.ReactNode => {
     return urlGroups
        .filter(g => g.parentId === parentId)
        .filter(g => g.id !== activeUrlGroupId)
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(group => {
          const isProject = group.id === PROJECTS_ROOT_ID || isDescendantOf(group.id, PROJECTS_ROOT_ID, urlGroups);
          return (
            <Fragment key={group.id}>
              <button
                onClick={() => handlePerformMove(group.id)}
                className="w-full text-left p-2 rounded-md text-sm hover:bg-gray-100 transition-colors text-gray-700 flex items-center"
                style={{ paddingLeft: `${level * 20 + 12}px` }}
              >
               {isProject ? <Briefcase size={16} className="mr-2 flex-shrink-0 text-purple-500" /> : <Folder size={16} className="mr-2 flex-shrink-0 text-gray-400" />}
                {group.name}
              </button>
              {renderMoveGroupOptions(group.id, level + 1)}
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

  const projectGroups = urlGroups.filter(g => g.parentId === PROJECTS_ROOT_ID);

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
            id="tutorial-tab-library"
            onClick={() => setMobileView('library')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
              mobileView === 'library' ? 'text-blue-600 border-blue-600 bg-white shadow-sm' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Database size={16} />
            <span>라이브러리</span>
          </button>
          <button
            id="tutorial-tab-workspace"
            onClick={() => setMobileView('workspace')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
              mobileView === 'workspace' ? 'text-purple-600 border-purple-600 bg-white shadow-sm' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Briefcase size={16} />
            <span>워크스페이스</span>
          </button>
        </div>

        <div className="flex flex-col flex-grow overflow-hidden">
          {/* Library Pane */}
          <div className={`w-full h-full flex flex-col ${mobileView === 'library' ? 'flex' : 'hidden'}`}>
            {/* Library Sub-tabs */}
            <div className="flex p-1 bg-gray-100/50 m-2 rounded-lg gap-1">
              <button
                id="tutorial-subtab-groups"
                onClick={() => setLibrarySubView('groups')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  librarySubView === 'groups' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FolderTree size={14} />
                자료실
              </button>
              <button
                id="tutorial-subtab-assets"
                onClick={() => setLibrarySubView('assets')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  librarySubView === 'assets' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Database size={14} />
                현재 목록
              </button>
            </div>

            {/* Group Manager Content */}
            <div className={`flex-grow flex flex-col overflow-hidden ${librarySubView === 'groups' ? 'flex' : 'hidden'}`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                    {onCloseSidebar && (
                      <button onClick={onCloseSidebar} className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors" aria-label="자료실 닫기">
                        <PanelLeftClose size={18} />
                      </button>
                    )}
                    <h2 className="text-sm font-bold text-gray-700">자료실 (폴더 구조)</h2>
                </div>
                <div id="tutorial-import-export" className="flex items-center gap-1">
                  <input type="file" ref={importInputRef} onChange={handleImportFileSelect} className="hidden" accept="application/json" />
                  <button onClick={() => importInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="구성 가져오기 (.json)"><UploadCloud size={16} /></button>
                  <button onClick={onExportGroups} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" title="구성 내보내기 (.json)"><DownloadCloud size={16} /></button>
                  {onShowTutorial && (
                    <button onClick={onShowTutorial} className="p-1.5 text-blue-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors" title="튜토리얼 다시 보기">
                      <Info size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex-grow overflow-y-auto p-2 chat-container">
                  <div className="space-y-1">
                    {renderGroupTree(null, 0, false)}
                  </div>
              </div>

              <div className="p-2 border-t border-gray-100 flex-shrink-0">
                {isAddingGroup ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="새 그룹 이름..." className="flex-grow h-8 py-1 px-3 border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500/30 transition-all text-xs" onKeyPress={e => e.key === 'Enter' && handleCreateGroup()} autoFocus />
                    <button onClick={handleCreateGroup} className="h-8 w-8 p-1 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0"><Check size={16} /></button>
                    <button onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }} className="h-8 w-8 p-1 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0"><X size={16} /></button>
                  </div>
                ) : (
                   <button onClick={() => setIsAddingGroup(true)} className="w-full h-8 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-[11px] font-bold border border-blue-100">
                      <Plus size={14} /> 그룹 추가
                  </button>
                )}
              </div>
            </div>

            {/* Asset Manager Content */}
            <div className={`flex-grow flex flex-col overflow-hidden ${librarySubView === 'assets' ? 'flex' : 'hidden'}`}>
              <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 flex-shrink-0 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-bold text-gray-700 truncate" title={`"${activeGroupName}" 자료`}>
                        "{activeGroupName}" 자료 {hasSubfolders ? (
                          <span className="text-[10px] font-normal text-blue-500 ml-1 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                            하위 포함 {totalRecursiveAssets}개
                          </span>
                        ) : `(${totalAssets})`}
                    </h3>
                </div>
              </div>

              <div className="p-3 space-y-2 border-b border-gray-100 flex-shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <input type="url" value={currentUrlInput} onChange={(e) => setCurrentUrlInput(e.target.value)} placeholder="법령/지침 URL 입력..." className="flex-grow h-9 py-1 px-3 border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500/30 transition-all text-sm" onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()} />
                  <button onClick={handleAddUrl} disabled={urls.length >= maxUrls} className="h-9 w-9 p-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:bg-gray-300 flex items-center justify-center flex-shrink-0"><Plus size={18} /></button>
                </div>
                <button onClick={() => fileInputRef.current?.click()} disabled={files.length >= maxFiles} className="w-full h-9 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-xs font-bold border border-gray-200 disabled:opacity-50"><Upload size={14} /> 파일 업로드</button>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
              </div>

              <div className="flex-grow overflow-y-auto p-3 chat-container bg-white">
                {error && <p className="text-[10px] text-red-600 mb-2 bg-red-50 p-1.5 rounded border border-red-100">{error}</p>}
                
                <div className="space-y-1.5">
                  {totalAssets === 0 && (
                    <div className="text-center py-8 px-4 text-xs text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-100 mt-2">
                      <Database size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="font-bold text-gray-500 mb-1">자료가 없습니다.</p>
                      <p>URL을 추가하거나 파일을 업로드하세요.</p>
                    </div>
                  )}

                  {urls.map((urlItem) => (
                    <div key={urlItem.id} className="flex items-center p-2 bg-white hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg text-xs group transition-all">
                      <LinkIcon size={14} className="text-blue-400 mr-2 flex-shrink-0" />
                      {editingUrlId === urlItem.id ? (
                        <input type="text" value={editingUrlName} onChange={(e) => setEditingUrlName(e.target.value)} className="flex-grow h-6 py-1 px-1.5 border border-blue-300 bg-white text-gray-800 rounded-md focus:ring-1 focus:ring-blue-500 outline-none text-xs" onKeyDown={(e) => e.key === 'Enter' && handleSaveUrlRename()} autoFocus />
                      ) : (
                        <a href={urlItem.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="text-gray-700 hover:text-blue-600 truncate flex-grow font-medium" title={urlItem.url}>{urlItem.name}</a>
                      )}
                      <div className="flex items-center ml-2">
                        {editingUrlId === urlItem.id ? (
                          <div className="flex items-center flex-shrink-0">
                            <button onClick={handleSaveUrlRename} className="p-1 text-green-600 hover:bg-green-100 rounded-md"><Check size={14} /></button>
                            <button onClick={handleCancelUrlEditing} className="p-1 text-red-600 hover:bg-red-100 rounded-md"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleStartUrlEditing(urlItem)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="이름 수정"><Pencil size={14} /></button>
                            {!isProjectGroup && projectGroups.length > 0 && (
                              <button onClick={() => setCopyingUrl(urlItem)} className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md" title="프로젝트로 복사"><Copy size={14} /></button>
                            )}
                            <button onClick={() => setMovingAsset({id: urlItem.id, type: 'url'})} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="이동"><MoveRight size={14} /></button>
                            <button onClick={() => onRemoveUrl(urlItem.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="삭제"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {files.map((file) => (
                    <div key={file.id} className="flex items-center p-2 bg-white hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-lg text-xs group transition-all">
                      {file.mimeType.startsWith('image/') ? (
                          <img src={file.base64Data} alt={file.name} className="w-7 h-7 object-cover rounded-md mr-2 flex-shrink-0 cursor-pointer" onClick={() => setPreviewFile(file)} />
                      ) : (
                          <button className="mr-2" onClick={() => setPreviewFile(file)}>{getFileIcon(file.mimeType)}</button>
                      )}
                      <button className="truncate flex-grow text-left text-gray-700 font-medium hover:text-blue-600" title={file.name} onClick={() => setPreviewFile(file)}>{file.name}</button>
                      <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => {e.stopPropagation(); setPreviewFile(file);}} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="미리보기"><Eye size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); setMovingAsset({ id: file.id, type: 'file' });}} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="이동"><MoveRight size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); onRemoveFile(file.id);}} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="삭제"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Workspace Pane */}
          <div className={`w-full h-full flex flex-col ${mobileView === 'workspace' ? 'flex' : 'hidden'}`}>
            {/* Workspace Sub-tabs */}
            <div className="flex p-1 bg-gray-100/50 m-2 rounded-lg gap-1">
              <button
                id="tutorial-subtab-projects"
                onClick={() => setWorkspaceSubView('projects')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  workspaceSubView === 'projects' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Briefcase size={14} />
                내 프로젝트
              </button>
              <button
                id="tutorial-subtab-rules"
                onClick={() => setWorkspaceSubView('rules')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  workspaceSubView === 'rules' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShieldCheck size={14} />
                나의 원칙
              </button>
            </div>

            {/* Project Manager Content */}
            <div className={`flex-grow flex flex-col overflow-hidden ${workspaceSubView === 'projects' ? 'flex' : 'hidden'}`}>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-sm font-bold text-gray-700">프로젝트 목록</h2>
              </div>
              
              <div className="flex-grow overflow-y-auto p-2 chat-container">
                  <div className="space-y-1">
                    {renderGroupTree(null, 0, true)}
                  </div>
              </div>

              <div className="p-2 border-t border-gray-100 flex-shrink-0">
                {isAddingProject ? (
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
                    <input 
                      type="text" 
                      value={newGroupName} 
                      onChange={e => setNewGroupName(e.target.value)} 
                      placeholder="프로젝트 이름..." 
                      className="w-full h-8 py-1 px-3 border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500/30 transition-all text-xs" 
                    />
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-gray-400" />
                      <input 
                        type="text" 
                        value={projectAddress} 
                        onChange={e => setProjectAddress(e.target.value)} 
                        placeholder="대상지 주소 (선택)" 
                        className="flex-grow h-8 py-1 px-3 border border-gray-200 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-purple-500/30 transition-all text-xs" 
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setIsAddingProject(false); setNewGroupName(''); setProjectAddress(''); }} className="px-2 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded">취소</button>
                      <button onClick={handleCreateProject} className="px-3 py-1 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 font-bold">생성</button>
                    </div>
                  </div>
                ) : (
                   <button onClick={() => setIsAddingProject(true)} className="w-full h-8 flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-[11px] font-bold border border-purple-100">
                      <Plus size={14} /> 프로젝트 추가
                  </button>
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

      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
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
  onUpdateAddress?: (id: string, address: string) => void;
  onAnalyzeAddress?: (id: string, address: string) => void;
  onRemoveGroup: (id: string) => void;
  onAddGroup: (name: string, parentId?: string | null) => void;
  renderGroupTree: (parentId: string, level: number) => React.ReactNode;
}

const GroupItem: React.FC<GroupItemProps> = ({
  group, level, isProject, urlGroups, activeUrlGroupId, editingGroupId, isExpanded,
  onSetGroupId, onToggleExpand, setEditingGroupId,
  onRenameGroup, onUpdateAddress, onAnalyzeAddress, onRemoveGroup, onAddGroup,
  renderGroupTree
}) => {
  const [editingName, setEditingName] = useState(group.name);
  const [editingAddress, setEditingAddress] = useState(group.projectAddress || '');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isAddingSubgroup, setIsAddingSubgroup] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState('');

  const hasChildren = urlGroups.some(g => g.parentId === group.id);
  
  const countAssetsInGroup = (g: URLGroup): number => g.urls.length + g.files.length;
  
  const countAllAssets = (g: URLGroup): number => {
    let totalAssets = countAssetsInGroup(g);
    const children = urlGroups.filter(child => child.parentId === g.id);
    for (const child of children) {
      totalAssets += countAllAssets(child);
    }
    return totalAssets;
  };

  const totalAssets = countAllAssets(group);

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
  
  const IconComponent = isRootLawGroup ? Scale : (isProject ? Briefcase : Folder);
  const iconColor = isRootLawGroup
    ? (activeUrlGroupId === group.id ? 'text-blue-600' : 'text-blue-500')
    : isProject 
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
        style={{ paddingLeft: `${level * 20 + 4}px` }}
      >
        <div className="flex items-center flex-grow min-w-0">
          <button onClick={(e) => { e.stopPropagation(); onToggleExpand(group.id); }} className="p-1 -ml-1 text-gray-400 hover:text-gray-800" disabled={!hasChildren}>
            {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-[14px] h-[14px] inline-block"/> }
          </button>
          
          <IconComponent size={16} className={`mr-2 flex-shrink-0 ${iconColor}`} />

          {editingGroupId === group.id ? (
            <input
              type="text" value={editingName}
              onChange={e => setEditingName(e.target.value)}
              className="flex-grow h-6 py-1 px-1.5 border border-gray-300 bg-white text-gray-800 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if(e.key === 'Escape') setEditingGroupId(null); }}
              onClick={e => e.stopPropagation()} autoFocus
              onBlur={handleSave}
            />
          ) : (
            <span className="truncate" title={`${group.name} (${totalAssets}개 자료)`}>{group.name} ({totalAssets})</span>
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
      {isExpanded && isProject && group.id !== PROJECTS_ROOT_ID && (
        <div className="mt-1 mb-2 px-3 py-2 bg-purple-50/50 rounded-lg border border-purple-100 mx-1" style={{ marginLeft: `${level * 20 + 24}px` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-purple-600 flex items-center gap-1">
              <MapPin size={10} /> 대상지 정보
            </span>
            {!isEditingAddress && (
              <button onClick={(e) => { e.stopPropagation(); setIsEditingAddress(true); }} className="text-[10px] text-purple-500 hover:underline">수정</button>
            )}
          </div>
          {isEditingAddress ? (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <input 
                type="text" 
                value={editingAddress} 
                onChange={e => setEditingAddress(e.target.value)}
                placeholder="주소 입력..."
                className="flex-grow text-xs p-1 border border-purple-200 rounded outline-none focus:ring-1 focus:ring-purple-400"
                autoFocus
              />
              <button onClick={handleSaveAddress} className="p-1 bg-purple-600 text-white rounded"><Check size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-600 truncate">{group.projectAddress || '주소 없음'}</p>
              {group.projectAddress && onAnalyzeAddress && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onAnalyzeAddress(group.id, group.projectAddress!); }}
                  className="flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] hover:bg-purple-700 transition-colors shadow-sm font-bold"
                  title="라이브러리에서 관련 자료를 자동으로 찾아 프로젝트에 추가합니다."
                >
                  <Sparkles size={10} /> 스마트 매칭
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {isAddingSubgroup && (
        <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: `${(level + 1) * 20 + 4}px` }}>
          <input
            type="text" value={newSubgroupName}
            onChange={e => setNewSubgroupName(e.target.value)}
            placeholder="하위 그룹 이름..."
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
          {renderGroupTree(group.id, level + 1)}
        </div>
      )}
    </div>
  );
};


export default KnowledgeBaseManager;