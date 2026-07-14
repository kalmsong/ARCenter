/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { X, Download, AlertTriangle, Edit3, Eye, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { KnowledgeFile } from '../types';
import { LawViewerModal } from './LawViewerModal';

interface FilePreviewModalProps {
  file: KnowledgeFile;
  onClose: () => void;
  onUpdateFile?: (fileId: string, updatedData: Partial<KnowledgeFile>) => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose, onUpdateFile }) => {
  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType?.startsWith('image/');
  
  const isText = 
    file.mimeType?.startsWith('text/') || 
    file.mimeType === 'application/json' || 
    file.name.endsWith('.md') || 
    file.name.endsWith('.json') ||
    !!file.content;

  const isMarkdown = file.name.endsWith('.md') || file.mimeType === 'text/markdown';

  const isPreviewable = isPdf || isImage || isText;

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [content, setContent] = useState(file.content || '');
  const [isSaving, setIsSaving] = useState(false);

  const [lawModal, setLawModal] = useState<{ isOpen: boolean; target?: string; lawId?: string; article?: string }>({ isOpen: false });

  useEffect(() => {
    // Attempt to decode base64 if it's text but only has base64Data
    if (isText && !content && file.base64Data) {
        try {
            const base64String = file.base64Data.split(',')[1];
            if (base64String) {
                const decoded = atob(base64String);
                // Handle utf8
                const utf8Decoder = new TextDecoder('utf-8');
                const array = new Uint8Array(decoded.length);
                for (let i = 0; i < decoded.length; i++) {
                    array[i] = decoded.charCodeAt(i);
                }
                setContent(utf8Decoder.decode(array));
            }
        } catch (e) {
            console.error("Failed to decode text file", e);
        }
    }
  }, [isText, file, content]);

  const handleDownload = () => {
    let downloadUrl = file.base64Data;
    
    // If it's pure text content without base64Data
    if (!downloadUrl && content) {
        const blob = new Blob([content], { type: file.mimeType || 'text/plain' });
        downloadUrl = URL.createObjectURL(blob);
    }
    
    if (!downloadUrl) return;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
      if (!onUpdateFile) return;
      setIsSaving(true);
      try {
          await onUpdateFile(file.id, { content });
          setMode('preview');
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0 bg-white z-10 rounded-t-lg">
          <div className="flex items-center gap-3 pr-4 min-w-0">
             <h2 id="file-preview-title" className="text-lg font-semibold text-gray-800 truncate" title={file.name}>
               {file.name}
             </h2>
             {isText && (
               <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
                 <button
                   onClick={() => setMode('preview')}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Eye size={14} /> 미리보기
                 </button>
                 <button
                   onClick={() => setMode('edit')}
                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'edit' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Edit3 size={14} /> 편집
                 </button>
               </div>
             )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isText && mode === 'edit' && (
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    <Save size={16} />
                    {isSaving ? '저장 중...' : '저장'}
                </button>
            )}
             <button
              onClick={handleDownload}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="파일 다운로드"
              title="파일 다운로드"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="미리보기 닫기"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <main className="flex-grow p-4 overflow-auto bg-gray-50 flex flex-col">
          {isImage && (
            <div className="flex items-center justify-center h-full">
                <img src={file.base64Data || file.content} alt={file.name} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          
          {isPdf && (
            <embed src={file.base64Data} type="application/pdf" className="w-full h-full" />
          )}

          {isText && mode === 'edit' && (
              <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full flex-grow p-4 bg-white border border-slate-200 rounded-xl shadow-inner font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none whitespace-pre-wrap"
                  placeholder="내용을 입력하세요..."
              />
          )}

          {isText && mode === 'preview' && (
             <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex-grow overflow-auto">
                 {isMarkdown ? (
                     <div className="markdown-body text-slate-800 leading-relaxed max-w-none">
                         <style>{`
                             .markdown-body h1 { font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; }
                             .markdown-body h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.75rem; }
                             .markdown-body h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1.25em; margin-bottom: 0.5rem; }
                             .markdown-body p { margin-top: 0; margin-bottom: 1rem; }
                             .markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
                             .markdown-body ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
                             .markdown-body li { margin-bottom: 0.25rem; }
                             .markdown-body strong { font-weight: 600; color: #0f172a; }
                             .markdown-body code { font-family: monospace; background-color: #f1f5f9; padding: 0.2em 0.4em; border-radius: 0.25rem; font-size: 85%; }
                             .markdown-body pre { background-color: #f8fafc; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1rem; border: 1px solid #e2e8f0; }
                             .markdown-body pre code { background-color: transparent; padding: 0; border-radius: 0; }
                         `}</style>
                         <ReactMarkdown
                             components={{
                                 a: ({ node, ...props }) => {
                                     return (
                                         <a
                                             {...props}
                                             target="_blank"
                                             rel="noopener noreferrer"
                                             className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 underline-offset-2"
                                             onClick={(e) => {
                                                 if (props.href?.startsWith('law://')) {
                                                     e.preventDefault();
                                                     e.stopPropagation();
                                                     try {
                                                         const urlParams = new URLSearchParams(props.href.replace('law://', ''));
                                                         setLawModal({
                                                             isOpen: true,
                                                             target: urlParams.get('target') || 'law',
                                                             lawId: urlParams.get('law_id') || '',
                                                             article: urlParams.get('article') || undefined
                                                         });
                                                     } catch (err) {
                                                         console.error("Failed to parse law link", err);
                                                     }
                                                 }
                                             }}
                                         />
                                     );
                                 }
                             }}
                         >{content}</ReactMarkdown>
                     </div>
                 ) : (
                     <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800">
                         {content}
                     </pre>
                 )}
             </div>
          )}

          {!isPreviewable && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <AlertTriangle size={48} className="text-yellow-500 mb-4" />
                <p className="text-lg font-medium text-gray-700">미리보기를 사용할 수 없음</p>
                <p className="mb-6">이 파일 형식({file.mimeType})은 브라우저에서 미리 볼 수 없습니다.</p>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors"
                >
                    <Download size={18} />
                    파일 다운로드
                </button>
            </div>
          )}
        </main>
      </div>
      
      {/* Interactive Law Viewer */}
      <LawViewerModal 
        isOpen={lawModal.isOpen} 
        target={lawModal.target} 
        lawId={lawModal.lawId} 
        article={lawModal.article} 
        onClose={() => setLawModal({ isOpen: false })} 
      />
    </div>
  );
};

export default FilePreviewModal;