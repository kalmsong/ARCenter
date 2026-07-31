import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Layout, Save, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { KnowledgeFile } from '../types';
import {
  createKnowledgeFileUrl,
  downloadKnowledgeFile,
  parseStorageLocation,
} from '../utils/fileUtils';

interface DocumentViewerPaneProps {
  config:
    | { type: 'none' }
    | { type: 'web'; url: string }
    | { type: 'file'; file: KnowledgeFile }
    | { type: 'law'; target: string; lawId: string; article?: string };
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
  isSidebarOpen,
  onToggleSidebar,
  isResizing = false,
  rightDrawerWidth,
  onSetWidth,
}) => {
  if (config.type === 'none') return null;

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden shadow-xl border-l border-gray-200">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          {!isSidebarOpen && onToggleSidebar && config.type !== 'web' && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-gray-400 hover:text-gray-900 rounded-md hover:bg-gray-200/50"
              title="자료실 열기"
            >
              <Layout size={16} />
            </button>
          )}
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-200/50 px-2 py-0.5 rounded">
            {config.type === 'web'
              ? 'Web Viewer'
              : config.type === 'law'
                ? 'Law Viewer'
                : 'Document Viewer'}
          </span>
          <h3 className="font-bold text-gray-800 text-xs truncate flex-1 min-w-0">
            {config.type === 'web'
              ? config.url
              : config.type === 'law'
                ? '법령 뷰어'
                : config.file.name}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-3">
          {onSetWidth && rightDrawerWidth && (
            <div className="flex items-center gap-1 border-r border-gray-200 pr-2.5 mr-1 bg-gray-100/60 p-0.5 rounded-lg">
              {[550, 850, 1250].map((width) => (
                <button
                  key={width}
                  onClick={() => onSetWidth(width)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded text-gray-500 hover:text-purple-700"
                >
                  {width === 550 ? '보통' : width === 850 ? '넓게' : '최대'}
                </button>
              ))}
            </div>
          )}

          {config.type === 'web' && (
            <a
              href={config.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-blue-500 rounded-md"
              title="새 창에서 열기"
            >
              <ExternalLink size={14} />
            </a>
          )}

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        {config.type === 'web' && (
          <iframe
            src={config.url}
            className={`w-full h-full border-none ${
              isResizing ? 'pointer-events-none' : ''
            }`}
            title="Web Preview"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}

        {config.type === 'law' && (
          <iframe
            src={`https://law.go.kr/lsInfoP.do?lsiSeq=${config.lawId}&efYd=0#${
              config.article ? `J${config.article}` : '0000'
            }`}
            className={`w-full h-full border-none ${
              isResizing ? 'pointer-events-none' : ''
            }`}
            title="Korean Law Viewer"
          />
        )}

        {config.type === 'file' && (
          <FileEditor file={config.file} onUpdate={onUpdateFile} />
        )}
      </div>
    </div>
  );
};

const FileEditor: React.FC<{
  file: KnowledgeFile;
  onUpdate?: (id: string, updatedData: Partial<KnowledgeFile>) => void;
}> = ({ file, onUpdate }) => {
  const isMarkdown =
    file.name.toLowerCase().endsWith('.md') ||
    file.mimeType === 'text/markdown';
  const isText =
    isMarkdown ||
    file.mimeType?.startsWith('text/') ||
    file.mimeType === 'application/json';
  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType?.startsWith('image/');
  const storageReference = file.storageReference || file.base64Data;

  const [content, setContent] = useState(file.content || '');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!file.content && Boolean(storageReference));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const timeOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!storageReference) {
        setIsLoading(false);
        return;
      }

      try {
        if (isText && !file.content) {
          if (storageReference.startsWith('data:')) {
            const base64 = storageReference.split(',')[1];
            if (base64) {
              const decoded = atob(base64);
              const bytes = Uint8Array.from(decoded, (char) =>
                char.charCodeAt(0),
              );
              if (active) {
                setContent(new TextDecoder('utf-8').decode(bytes));
              }
            }
          } else if (parseStorageLocation(storageReference)) {
            const blob = await downloadKnowledgeFile(storageReference);
            if (active && blob) setContent(await blob.text());
          }
        } else {
          const signedUrl = await createKnowledgeFileUrl(storageReference);
          if (active) setFileUrl(signedUrl);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : '파일을 불러오지 못했습니다.',
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
      if (timeOutRef.current) clearTimeout(timeOutRef.current);
    };
  }, [file.content, isText, storageReference]);

  const handleContentChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const nextContent = event.target.value;
    setContent(nextContent);

    if (timeOutRef.current) clearTimeout(timeOutRef.current);
    setIsSaving(true);

    timeOutRef.current = setTimeout(() => {
      onUpdate?.(file.id, { content: nextContent });
      setIsSaving(false);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        파일을 안전하게 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (isPdf && fileUrl) {
    return <embed src={fileUrl} type="application/pdf" className="w-full h-full" />;
  }

  if (isImage && fileUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 p-6">
        <img
          src={fileUrl}
          alt={file.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (!isText) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
        <ExternalLink size={24} className="mb-4" />
        <p className="text-sm font-medium mb-3">
          미리보기를 지원하지 않는 파일 형식입니다.
        </p>
        {fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline flex items-center gap-1 text-sm font-bold"
          >
            다운로드 또는 새 창에서 열기 <ExternalLink size={14} />
          </a>
        )}
      </div>
    );
  }

  if (isMarkdown && !isEditing) {
    return (
      <div
        className="relative h-full flex flex-col group cursor-text"
        onClick={() => setIsEditing(true)}
      >
        <div className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-[10px] text-gray-400 bg-white/90 shadow px-2 py-1 rounded-md font-bold tracking-wider uppercase">
            클릭하여 편집
          </div>
        </div>
        <div className="p-8 pb-32 prose prose-slate prose-sm max-w-none min-h-full font-sans leading-relaxed">
          <Markdown>{content || '*내용이 없습니다.*'}</Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative w-full">
      <div
        className={`absolute top-2 right-4 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
          isSaving
            ? 'bg-amber-50 text-amber-600'
            : 'bg-emerald-50 text-emerald-600'
        }`}
      >
        {isSaving ? (
          <>
            <Save size={12} className="animate-pulse" /> 저장 중...
          </>
        ) : (
          <>
            <Check size={12} /> 저장됨
          </>
        )}
      </div>
      {isMarkdown && (
        <div className="absolute bottom-4 right-6">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-lg"
          >
            미리보기 및 편집 종료
          </button>
        </div>
      )}
      <textarea
        value={content}
        onChange={handleContentChange}
        className="w-full h-full p-8 pb-32 resize-none outline-none text-[13px] bg-slate-50/50 font-mono text-gray-800 leading-relaxed border-none"
        placeholder="내용을 입력하세요..."
        spellCheck={false}
        autoFocus
      />
    </div>
  );
};
