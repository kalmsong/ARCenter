import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface WebIframeModalProps {
    url: string;
    onClose: () => void;
}

const WebIframeModal: React.FC<WebIframeModalProps> = ({ url, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/80 backdrop-blur-md">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <span className="text-xs font-bold text-gray-500 bg-gray-200/50 px-2.5 py-1 rounded-md">웹 문서 Viewer</span>
                        <h3 className="font-bold text-gray-800 text-sm truncate flex-1 min-w-0">{url}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <a 
                           href={url} 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
                        >
                           <ExternalLink size={14} /> 새창
                        </a>
                        <button 
                            onClick={onClose}
                            className="p-2 bg-gray-100 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-grow bg-white flex relative">
                   {/* Some websites deny framing (X-Frame-Options: DENY or SAMEORIGIN). We provide a fallback just in case or the browser will show connection refused. */}
                   <iframe src={url} className="w-full h-full border-none" title="Web Preview" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" />
                </div>
            </div>
        </div>
    );
};

export default WebIframeModal;
