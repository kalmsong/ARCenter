/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { X, Check } from 'lucide-react';

interface BulkAddUrlModalProps {
  onClose: () => void;
  onAddUrls: (urls: string[]) => void;
  maxUrls: number;
  currentUrlCount: number;
}

const BulkAddUrlModal: React.FC<BulkAddUrlModalProps> = ({ onClose, onAddUrls, maxUrls, currentUrlCount }) => {
  const [textInput, setTextInput] = useState('');
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [hasExtracted, setHasExtracted] = useState(false);

  const urlRegex = /(https?:\/\/[^\s"'<>`]+)/g;

  const handleExtract = () => {
    const foundUrls = textInput.match(urlRegex) || [];
    const uniqueUrls = Array.from(new Set(foundUrls));
    setExtractedUrls(uniqueUrls);
    setSelectedUrls(new Set(uniqueUrls));
    setHasExtracted(true);
  };
  
  const handleToggleUrl = (url: string) => {
    setSelectedUrls(prev => {
        const newSet = new Set(prev);
        if (newSet.has(url)) {
            newSet.delete(url);
        } else {
            newSet.add(url);
        }
        return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedUrls.size === extractedUrls.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(extractedUrls));
    }
  };

  const handleAdd = () => {
    const urlsToAdd = Array.from(selectedUrls);
    const availableSlots = maxUrls - currentUrlCount;
    onAddUrls(urlsToAdd.slice(0, availableSlots));
    onClose();
  };

  const availableSlots = maxUrls - currentUrlCount;
  const canAddCount = Math.min(selectedUrls.size, availableSlots);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="bulk-add-title"
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl h-full max-h-[80vh] flex flex-col border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 id="bulk-add-title" className="text-lg font-semibold text-gray-800">URL 대량 추가</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <X size={22} />
          </button>
        </header>
        <main className="flex-grow p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4">
            <div>
                <label htmlFor="url-textarea" className="text-sm font-medium text-gray-700 block mb-2">
                    URL이 포함된 텍스트를 여기에 붙여넣으세요. 앱이 자동으로 URL을 추출합니다.
                </label>
                <textarea
                    id="url-textarea"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="w-full h-32 p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="예: '참고 자료 목록:\nhttps://www.law.go.kr/lsInfoP.do?lsiSeq=261475\nhttps://www.gwangju.go.kr/build/index.do'"
                />
            </div>
             <button
                onClick={handleExtract}
                disabled={!textInput.trim()}
                className="w-full h-10 bg-gray-800 text-white rounded-md font-semibold hover:bg-gray-700 transition-colors disabled:bg-gray-300"
            >
                URL 추출하기
            </button>
            
            {hasExtracted && (
                <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between items-center mb-2">
                         <h3 className="text-sm font-semibold text-gray-800">
                           추출된 URL ({extractedUrls.length}개 찾음, {selectedUrls.size}개 선택됨)
                         </h3>
                         <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:underline font-medium">
                            {selectedUrls.size === extractedUrls.length ? '전체 선택 해제' : '전체 선택'}
                        </button>
                    </div>
                    {extractedUrls.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">유효한 URL을 찾을 수 없습니다.</p>
                    ) : (
                        <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto bg-white">
                            {extractedUrls.map((url, index) => (
                                <div key={index} className={`flex items-center p-2 text-sm border-b border-gray-100 last:border-b-0 ${selectedUrls.has(url) ? 'bg-blue-50' : ''}`}>
                                    <input
                                        type="checkbox"
                                        id={`url-check-${index}`}
                                        checked={selectedUrls.has(url)}
                                        onChange={() => handleToggleUrl(url)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                                    />
                                    <label htmlFor={`url-check-${index}`} className="truncate flex-grow cursor-pointer text-gray-700" title={url}>
                                        {url}
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </main>
         <footer className="p-4 border-t border-gray-200 flex-shrink-0 flex justify-end items-center gap-3 bg-white">
            <p className="text-xs text-gray-500 mr-auto">
                추가 가능: {canAddCount}개 / {availableSlots}개 슬롯
            </p>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                취소
            </button>
            <button 
                onClick={handleAdd}
                disabled={canAddCount === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors disabled:bg-blue-300 flex items-center gap-1.5"
            >
                <Check size={16} />
                선택한 URL 추가 ({canAddCount})
            </button>
        </footer>
      </div>
    </div>
  );
};

export default BulkAddUrlModal;
