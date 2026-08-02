/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Edit3, Eye, Save, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { KnowledgeFile } from '../types';
import {
  createKnowledgeFileUrl,
  downloadKnowledgeFile,
  parseStorageLocation,
} from '../utils/fileUtils';
import { LawViewerModal } from './LawViewerModal';

interface FilePreviewModalProps {
  file: KnowledgeFile;
  onClose: () => void;
  onUpdateFile?: (fileId: string, updatedData: Partial<KnowledgeFile>) => void;
}

function decodeLegacyDataUri(value: string): string {
  const base64 = value.split(',')[1];
  if (!base64) return '';

  const decoded = atob(base64);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onUpdateFile,
}) => {
  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType?.startsWith('image/');
  const isText =
    file.mimeType?.startsWith('text/') ||
    file.mimeType === 'application/json' ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.json') ||
    Boolean(file.content);
  const isMarkdown =
    file.name.endsWith('.md') || file.mimeType === 'text/markdown';

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [content, setContent] = useState(file.content || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lawModal, setLawModal] = useState<{
    isOpen: boolean;
    target?: string;
    lawId?: string;
    article?: string;
  }>({ isOpen: false });

  const storageReference = file.storageReference || file.base64Data;
  const isPreviewable = isPdf || isImage || isText;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setFileError(null);

      if (isText && !file.content && storageReference) {
        setIsLoadingFile(true);
        try {
          if (storageReference.startsWith('data:')) {
            const decoded = decodeLegacyDataUri(storageReference);
            if (active) setContent(decoded);
          } else if (parseStorageLocation(storageReference)) {
            const blob = await downloadKnowledgeFile(storageReference);
            if (active && blob) setContent(await blob.text());
          }
        } catch (error) {
          if (active) {
            setFileError(
              error instanceof Error ? error.message : '파일을 읽지 못했습니다.',
            );
          }
        } finally {
          if (active) setIsLoadingFile(false);
        }
      }

      if ((isPdf || isImage) && storageReference) {
        setIsLoadingFile(true);
        try {
          const url = await createKnowledgeFileUrl(storageReference);
          if (active) setPreviewUrl(url);
        } catch (error) {
          if (active) {
            setFileError(
              error instanceof Error ? error.message : '미리보기를 열지 못했습니다.',
            );
          }
        } finally {
          if (active) setIsLoadingFile(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [file.content, isImage, isPdf, isText, storageReference]);

  const sourceUrl = useMemo(
    () => previewUrl || (storageReference?.startsWith('data:') ? storageReference : null),
    [previewUrl, storageReference],
  );

  const handleDownload = async () => {
    try {
      let downloadUrl = await createKnowledgeFileUrl(storageReference, 60);

      if (!downloadUrl && content) {
        downloadUrl = URL.createObjectURL(
          new Blob([content], { type: file.mimeType || 'text/plain' }),
        );
      }

      if (!downloadUrl) return;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      setFileError(
        error instanceof Error ? error.message : '파일을 내려받지 못했습니다.',
      );
    }
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
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0 bg-white rounded-t-lg">
          <div className="flex items-center gap-3 pr-4 min-w-0">
            <h2
              id="file-preview-title"
              className="text-lg font-semibold text-gray-800 truncate"
              title={file.name}
            >
              {file.name}
            </h2>
            {isText && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
                <button
                  onClick={() => setMode('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
                    mode === 'preview'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  <Eye size={14} /> 미리보기
                </button>
                <button
                  onClick={() => setMode('edit')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
                    mode === 'edit'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500'
                  }`}
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
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? '저장 중...' : '저장'}
              </button>
            )}
            <button
              onClick={() => void handleDownload()}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
              aria-label="파일 다운로드"
            >
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
              aria-label="미리보기 닫기"
            >
              <X size={22} />
            </button>
          </div>
        </header>

        <main className="flex-grow p-4 overflow-auto bg-gray-50 flex flex-col">
          {isLoadingFile && (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              파일을 안전하게 불러오는 중...
            </div>
          )}

          {!isLoadingFile && fileError && (
            <div className="flex h-full flex-col items-center justify-center text-center text-red-600">
              <AlertTriangle size={42} className="mb-3" />
              <p>{fileError}</p>
            </div>
          )}

          {!isLoadingFile && !fileError && isImage && sourceUrl && (
            <div className="flex items-center justify-center h-full">
              <img
                src={sourceUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {!isLoadingFile && !fileError && isPdf && sourceUrl && (
            <embed
              src={sourceUrl}
              type="application/pdf"
              className="w-full h-full"
            />
          )}

          {!isLoadingFile && !fileError && isText && mode === 'edit' && (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="w-full flex-grow p-4 bg-white border border-slate-200 rounded-xl font-mono text-sm resize-none"
              placeholder="내용을 입력하세요..."
            />
          )}

          {!isLoadingFile && !fileError && isText && mode === 'preview' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex-grow overflow-auto">
              {isMarkdown ? (
                <div className="markdown-body text-slate-800 leading-relaxed max-w-none">
                  <ReactMarkdown
                    components={{
                      a: ({ ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={(event) => {
                            if (!props.href?.startsWith('law://')) return;

                            event.preventDefault();
                            event.stopPropagation();
                            const params = new URLSearchParams(
                              props.href.replace('law://', ''),
                            );
                            setLawModal({
                              isOpen: true,
                              target: params.get('target') || 'law',
                              lawId: params.get('law_id') || '',
                              article: params.get('article') || undefined,
                            });
                          }}
                        />
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm text-slate-800">
                  {content}
                </pre>
              )}
            </div>
          )}

          {!isLoadingFile && !fileError && !isPreviewable && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <AlertTriangle size={48} className="text-yellow-500 mb-4" />
              <p className="text-lg font-medium text-gray-700">
                미리보기를 사용할 수 없음
              </p>
              <p className="mb-6">
                이 파일 형식({file.mimeType})은 브라우저에서 미리 볼 수 없습니다.
              </p>
            </div>
          )}
        </main>
      </div>

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
