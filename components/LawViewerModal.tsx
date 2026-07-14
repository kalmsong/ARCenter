import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { fetchLawDetail } from '../services/airtectApi';

interface LawViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: string;
  lawId?: string;
  article?: string;
}

export const LawViewerModal: React.FC<LawViewerModalProps> = ({ isOpen, onClose, target, lawId, article }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !target || !lawId) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchLawDetail(target, lawId, article);
        if (res && res.detail) {
          setData(res);
        } else {
          setError('해당 법령 정보를 불러올 수 없습니다.');
        }
      } catch (e: any) {
        setError(e.message || '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, target, lawId, article]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
             법령/조례 상세정보
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </header>
        
        <main className="p-6 overflow-y-auto flex-grow bg-white">
          {loading && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p className="text-sm font-medium">실시간 법령 데이터를 조회중입니다...</p>
            </div>
          )}
          
          {error && !loading && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">
              {error}
            </div>
          )}

          {!loading && data && data.detail && (
            <div className="space-y-6">
                {Object.entries(data.detail).map(([key, value]) => (
                    <div key={key} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-2 truncate" dangerouslySetInnerHTML={{ __html: key }}></h3>
                        <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                            {value as string}
                        </p>
                    </div>
                ))}
                
                {data.annex_forms && data.annex_forms.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">관련 별표/서식 자료</h4>
                        <div className="grid gap-3">
                           {data.annex_forms.map((item: any, idx: number) => (
                               <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg text-sm flex flex-col gap-1 shadow-sm">
                                   <div className="font-bold text-slate-700">{item.id || `별표자료 ${idx + 1}`}</div>
                               </div>
                           ))}
                        </div>
                    </div>
                )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
