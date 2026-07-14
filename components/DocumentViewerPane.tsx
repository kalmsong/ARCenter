import React, { useRef, useState } from 'react';
import { X, ExternalLink, Save, Check, Layout } from 'lucide-react';
import { KnowledgeFile } from '../types';
import Markdown from 'react-markdown';

interface DocumentViewerPaneProps {
  config: {
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
  onClose: () => void;
  onUpdateFile?: (id: string, updatedData: Partial<KnowledgeFile>) => void;
  onOpenViewer?: (config: any) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isResizing?: boolean;
  rightDrawerWidth?: number;
  onSetWidth?: (width: number) => void;
}

export const DocumentViewerPane: React.FC<DocumentViewerPaneProps> = ({ 
  config, 
  onClose, 
  onUpdateFile, 
  onOpenViewer, 
  isSidebarOpen, 
  onToggleSidebar,
  isResizing = false,
  rightDrawerWidth,
  onSetWidth
}) => {
  if (config.type === 'none') return null;

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden shadow-xl border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {!isSidebarOpen && onToggleSidebar && config.type !== 'web' && (
              <button 
                  onClick={onToggleSidebar}
                  className="p-1.5 text-gray-400 hover:text-gray-900 rounded-md hover:bg-gray-200/50 transition-colors"
                  title="자료실 열기"
              >
                  <Layout size={16} />
              </button>
          )}
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-200/50 px-2 py-0.5 rounded">
            {config.type === 'web' ? 'Web Viewer' : config.type === 'law' ? 'Law Viewer' : 'Document Viewer'}
          </span>
          <h3 className="font-bold text-gray-800 text-xs truncate flex-1 min-w-0">
            {config.type === 'web' ? config.url : config.type === 'law' ? '법령 뷰어' : config.file.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pl-3">
          {onSetWidth && rightDrawerWidth && (
            <div className="flex items-center gap-1 border-r border-gray-200 pr-2.5 mr-1 bg-gray-100/60 p-0.5 rounded-lg">
              <button
                onClick={() => onSetWidth(550)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${rightDrawerWidth <= 600 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                title="보통 너비 (550px)"
              >
                보통
              </button>
              <button
                onClick={() => onSetWidth(850)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${rightDrawerWidth > 600 && rightDrawerWidth <= 1000 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                title="넓게 보기 (850px)"
              >
                넓게
              </button>
              <button
                onClick={() => onSetWidth(1250)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${rightDrawerWidth > 1000 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
                title="최대 너비 (1250px)"
              >
                최대
              </button>
            </div>
          )}
          {config.type === 'web' && (
            <a 
              href={config.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 text-[10px] uppercase font-bold"
              title="새 창에서 열기"
            >
               <ExternalLink size={14} />
            </a>
          )}
          {config.type === 'file' && config.file.url && (
             <a 
               href={config.file.url} 
               target="_blank" 
               rel="noopener noreferrer" 
               className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-1 text-[10px] uppercase font-bold"
               title="원본 다운로드"
             >
                <ExternalLink size={14} />
             </a>
          )}
          <button 
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          >
              <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white relative">
        {config.type === 'web' && (
           <iframe src={config.url} className={`w-full h-full border-none ${isResizing ? 'pointer-events-none' : ''}`} title="Web Preview" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" />
        )}

        {config.type === 'law' && (
           <iframe 
             src={`https://law.go.kr/lsInfoP.do?lsiSeq=${config.lawId}&efYd=0#${config.article ? `J${config.article}` : '0000'}`} 
             className={`w-full h-full border-none ${isResizing ? 'pointer-events-none' : ''}`} 
             title="Korean Law Viewer" 
           />
        )}

        {config.type === 'file' && (
            <FileEditor file={config.file} onUpdate={onUpdateFile} onOpenViewer={(cfg) => {/* DocumentViewerPane is replaced completely, or maybe DocumentViewerPane is replaced? Let's just pass window.postMessage or something. Wait, we can't do that easily if we are already in DocumentViewerPane. But if we replace ViewerConfig with a new view, we lose the file view! Maybe we shouldn't open it from inside itself, but we can pass a callback that sets the root viewerConfig */}}/>
        )}
      </div>
    </div>
  );
};

const FileEditor: React.FC<{ 
  file: KnowledgeFile, 
  onUpdate?: (id: string, updatedData: Partial<KnowledgeFile>) => void,
  onOpenViewer?: (config: any) => void
}> = ({ file, onUpdate, onOpenViewer }) => {
    const isMarkdown = file.name.toLowerCase().endsWith('.md') || file.mimeType === 'text/markdown';
    const isText = isMarkdown || file.mimeType?.startsWith('text/');
    
    // Auto-save logic
    const [content, setContent] = useState(file.content || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    const timeOutRef = useRef<NodeJS.Timeout | null>(null);

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        if (timeOutRef.current) clearTimeout(timeOutRef.current);
        setIsSaving(true);
        
        timeOutRef.current = setTimeout(() => {
            if (onUpdate) {
                onUpdate(file.id, { content: e.target.value });
            }
            setIsSaving(false);
        }, 1500);
    };

    if (!isText) {
       return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
             <div className="w-16 h-16 mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                 <ExternalLink size={24} className="text-gray-400" />
             </div>
             <p className="text-sm font-medium mb-2">미리보기를 지원하지 않는 파일 형식입니다.</p>
             {file.url && (
                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 text-sm font-bold">
                    다운로드 또는 새 창에서 열기 <ExternalLink size={14} />
                </a>
             )}
          </div>
       );
    }

    if (isMarkdown && !isEditing) {
        return (
            <div className="relative h-full flex flex-col group cursor-text" onClick={() => setIsEditing(true)}>
               <div className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-[10px] text-gray-400 bg-white/90 shadow px-2 py-1 rounded-md font-bold tracking-wider uppercase backdrop-blur-md">
                     클릭하여 편집 
                  </div>
               </div>
               <div className="p-8 pb-32 prose prose-slate prose-sm max-w-none min-h-full font-sans leading-relaxed selection:bg-purple-100">
                  <Markdown>{content || '*내용이 없습니다.*'}</Markdown>
               </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col relative w-full">
            <div className={`absolute top-2 right-4 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5 ${isSaving ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {isSaving ? <><Save size={12} className="animate-pulse" /> 저장 중...</> : <><Check size={12} /> 저장됨</>}
            </div>
            {isMarkdown && (
                <div className="absolute bottom-4 right-6">
                    <button 
                        onClick={() => setIsEditing(false)} 
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-gray-800 transition-colors"
                    >
                        미리보기 및 편집 종료
                    </button>
                </div>
            )}
            <textarea 
                value={content}
                onChange={handleContentChange}
                className="w-full h-full p-8 pb-32 resize-none outline-none text-[13px] bg-slate-50/50 font-mono text-gray-800 leading-relaxed custom-scrollbar border-none"
                placeholder="내용을 입력하세요..."
                spellCheck={false}
                autoFocus
            />
        </div>
    );
};
