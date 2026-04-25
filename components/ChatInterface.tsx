/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageSender, KnowledgeUrl, ToastNotification } from '../types'; 
import MessageItem from './MessageItem';
import { Send, Menu, Globe, Lightbulb, Info, AlertTriangle, XCircle, X, MapPin, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { User } from '../services/firebase';

// --- Toast Notification Component ---
interface ToastProps {
  notification: ToastNotification;
  onClose: (id: string) => void;
}
const Toast: React.FC<ToastProps> = ({ notification, onClose }) => {
  const { id, message, type } = notification;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(id), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(id), 300);
  };

  const icons = {
    info: <Info size={20} />,
    warning: <AlertTriangle size={20} />,
    error: <XCircle size={20} />,
  };

  const colors = {
    info: 'bg-blue-500 border-blue-600',
    warning: 'bg-yellow-500 border-yellow-600',
    error: 'bg-red-500 border-red-600',
  };

  return (
    <div
      className={`
        w-full max-w-sm rounded-lg shadow-lg text-white p-4 flex items-start gap-3 border-l-4
        transition-all duration-300 ease-in-out pointer-events-auto
        ${colors[type]}
        ${visible ? 'transform-none opacity-100' : 'translate-y-4 opacity-0'}
      `}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <p className="flex-grow text-sm font-medium">{message}</p>
      <button onClick={handleClose} className="flex-shrink-0 p-1 -m-1 rounded-full hover:bg-black/20 transition-colors">
        <X size={18} />
      </button>
    </div>
  );
};


interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  isLoading: boolean;
  placeholderText?: string;
  initialQuerySuggestions?: string[];
  onSuggestedQueryClick?: (query: string) => void;
  isFetchingSuggestions?: boolean;
  onFetchSuggestions?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isSearchEnabled?: boolean;
  onToggleSearch?: () => void;
  activeGroupPath?: string;
  activeGroupAddress?: string;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  notifications: ToastNotification[];
  onRemoveNotification: (id: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage,
  isLoading, 
  placeholderText,
  initialQuerySuggestions,
  onSuggestedQueryClick,
  isFetchingSuggestions,
  onFetchSuggestions,
  onToggleSidebar,
  isSidebarOpen,
  isSearchEnabled,
  onToggleSearch,
  activeGroupPath,
  activeGroupAddress,
  user,
  onLogin,
  onLogout,
  notifications,
  onRemoveNotification,
}) => {
  const [userQuery, setUserQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (userQuery.trim() && !isLoading) {
      onSendMessage(userQuery.trim());
      setUserQuery('');
    }
  };

  const canShowSuggestionsArea = messages.filter(m => m.sender !== MessageSender.SYSTEM).length < 1;
  const suggestionsToShow = initialQuerySuggestions || [];
  const hasSuggestionsToShow = suggestionsToShow.length > 0;


  return (
    <div className="relative flex flex-col h-full bg-white rounded-lg shadow-md border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-3 min-w-0">
           {onToggleSidebar && !isSidebarOpen && (
            <button 
              onClick={onToggleSidebar}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="자료실 열기"
            >
              <Menu size={22} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 truncate">건축법규검토 어시스턴트</h2>
            {activeGroupPath && (
                <p className="text-xs text-gray-500 mt-1 truncate" title={`검색 범위: ${activeGroupPath}`}>
                    <span className="font-semibold">검색 범위:</span> {activeGroupPath}
                </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 mr-2">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-bold text-gray-900">{user.displayName}</span>
                <span className="text-[10px] text-gray-500">{user.email}</span>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <UserIcon size={16} />
                </div>
              )}
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="로그아웃"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm mr-2"
            >
              <LogIn size={16} />
              <span>로그인</span>
            </button>
          )}
          <button
            onClick={onToggleSearch}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
              ${isSearchEnabled 
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}
            `}
          >
            <Globe size={14} className={isSearchEnabled ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">{isSearchEnabled ? '웹 검색 ON' : '웹 검색 OFF'}</span>
          </button>
        </div>
      </div>

      {/* Project Context Banner */}
      {activeGroupAddress && !isSearchEnabled && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-md z-10 animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={14} className="flex-shrink-0" />
            <div className="text-xs font-medium truncate">
              <span className="opacity-80 mr-1">대상지:</span>
              <span className="font-bold">{activeGroupAddress}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
             <div className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">Project Mode</div>
          </div>
        </div>
      )}

      <div className="flex-grow p-4 overflow-y-auto chat-container bg-gray-50">
        <div className="max-w-4xl mx-auto w-full">
          {messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
            />
          ))}
          
          {canShowSuggestionsArea && hasSuggestionsToShow && onSuggestedQueryClick && (
            <div className="my-4 px-1">
              <p className="text-xs text-gray-500 mb-2 font-medium">다음 중 하나를 시도해 보세요:</p>
              <div className="flex flex-wrap gap-2">
                {suggestionsToShow.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestedQueryClick(suggestion)}
                    className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm hover:bg-blue-200/60 transition-colors shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canShowSuggestionsArea && !hasSuggestionsToShow && onFetchSuggestions && (
            <div className="my-4 px-1 text-center">
                <button
                  onClick={onFetchSuggestions}
                  disabled={isFetchingSuggestions}
                  className="bg-white border border-gray-300 text-gray-700 px-6 py-2.5 rounded-full text-sm hover:bg-gray-50 transition-all shadow-sm hover:shadow-md disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-wait flex items-center gap-2 mx-auto font-medium"
                >
                  {isFetchingSuggestions ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      <span>제안 가져오는 중...</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb size={18} className="text-yellow-500" />
                      <span>질문 제안받기</span>
                    </>
                  )}
                </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <textarea
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder={placeholderText || "질문을 입력하세요..."}
              className="flex-grow h-10 min-h-[40px] py-2 px-3 border border-gray-300 bg-white text-gray-800 placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none text-sm"
              rows={1}
              disabled={isLoading || isFetchingSuggestions}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {onToggleSearch && (
              <button
                id="tutorial-web-search"
                onClick={onToggleSearch}
                disabled={isLoading || isFetchingSuggestions}
                className={`h-10 w-10 p-2 rounded-lg transition-all disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center flex-shrink-0 relative ${
                  isSearchEnabled 
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200/60 ring-1 ring-blue-500' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                }`}
                aria-label="웹 검색 토글"
                title={isSearchEnabled ? '웹 검색 ON' : '웹 검색 OFF'}
              >
                {isSearchEnabled && <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>}
                <Globe size={20} />
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={isLoading || isFetchingSuggestions || !userQuery.trim()}
              className="h-10 w-10 p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center flex-shrink-0"
              aria-label="메시지 보내기"
            >
              {(isLoading && messages[messages.length-1]?.isLoading && messages[messages.length-1]?.sender === MessageSender.MODEL) ? 
                <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div> 
                : <Send size={20} />
              }
            </button>
          </div>
        </div>
      </div>
      
      {/* Toast Container */}
      <div aria-live="assertive" className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 flex flex-col items-center space-y-2 pointer-events-none z-10">
          {notifications.map(notification => (
              <Toast key={notification.id} notification={notification} onClose={onRemoveNotification} />
          ))}
      </div>
    </div>
  );
};

export default ChatInterface;