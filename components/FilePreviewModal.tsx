/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';
import { KnowledgeFile } from '../types';

interface FilePreviewModalProps {
  file: KnowledgeFile;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const isPdf = file.mimeType === 'application/pdf';
  const isImage = file.mimeType.startsWith('image/');
  const isPreviewable = isPdf || isImage;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.base64Data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <header className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <h2 id="file-preview-title" className="text-lg font-semibold text-gray-800 truncate pr-4" title={file.name}>
            {file.name}
          </h2>
          <div className="flex items-center gap-2">
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

        <main className="flex-grow p-4 overflow-auto bg-gray-50">
          {isImage && (
            <div className="flex items-center justify-center h-full">
                <img src={file.base64Data} alt={file.name} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {isPdf && (
            <embed src={file.base64Data} type="application/pdf" className="w-full h-full" />
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
    </div>
  );
};

export default FilePreviewModal;