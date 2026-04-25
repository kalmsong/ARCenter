/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage, MessageSender } from '../types';
import { User, Sparkles, AlertTriangle } from 'lucide-react';

// Configure marked to use highlight.js for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-',
} as any);

// Custom renderer to open links in new tabs
const renderer = new marked.Renderer();
const linkRenderer = renderer.link;
renderer.link = (args: any) => {
    const html = linkRenderer.call(renderer, args);
    return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" ');
};

interface MessageItemProps {
  message: ChatMessage;
}

const SenderAvatar: React.FC<{ sender: MessageSender }> = ({ sender }) => {
  let icon: React.ReactNode;
  let bgColorClass = '';
  let iconColorClass = '';

  if (sender === MessageSender.USER) {
    icon = <User size={18} />;
    bgColorClass = 'bg-gray-200';
    iconColorClass = 'text-gray-700';
  } else if (sender === MessageSender.MODEL) {
    icon = <Sparkles size={18} />;
    bgColorClass = 'bg-blue-500';
    iconColorClass = 'text-white';
  } else { // SYSTEM
    icon = <AlertTriangle size={18} />;
    bgColorClass = 'bg-yellow-500';
    iconColorClass = 'text-white';
  }

  return (
    <div className={`w-8 h-8 rounded-full ${bgColorClass} ${iconColorClass} flex items-center justify-center flex-shrink-0 shadow-md`}>
      {icon}
    </div>
  );
};

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === MessageSender.USER;
  const isModel = message.sender === MessageSender.MODEL;
  
  const contentRef = useRef<HTMLDivElement>(null);

  const renderMessageContent = () => {
    if (isModel && !message.isLoading) {
      const proseClasses = "prose prose-sm w-full min-w-0"; 
      const rawMarkup = marked.parse(message.text || "", { renderer }) as string;
      return <div ref={contentRef} className={proseClasses} dangerouslySetInnerHTML={{ __html: rawMarkup }} />;
    }
    
    return <div className={`whitespace-pre-wrap text-sm ${isUser ? 'text-white' : 'text-gray-800'}`}>{message.text}</div>;
  };
  
  const bubbleClasses = `p-3 rounded-lg shadow-md w-full ${
    isUser 
      ? 'bg-blue-500' 
      : 'bg-white border border-gray-200'
  }`;

  return (
    <div className={`flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-3 max-w-[90%]`}>
        {!isUser && <SenderAvatar sender={message.sender} />}
        <div className={bubbleClasses}>
          {message.isLoading ? (
            <div className="flex items-center space-x-1.5 p-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
          ) : (
            renderMessageContent()
          )}
          
          {isModel && message.wasSearchEnabled && message.groundingChunks && message.groundingChunks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 mb-1.5">
                웹 소스:
              </h4>
              <ul className="space-y-1">
                {message.groundingChunks.filter(c => c.web).map((chunk, index) => (
                  <li key={index} className="text-xs text-gray-500">
                    <a href={chunk.web!.uri} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="hover:underline break-all text-blue-600" title={chunk.web!.title}>
                      {chunk.web!.title || chunk.web!.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isModel && message.urlContext && message.urlContext.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 mb-1.5">참고한 컨텍스트 URL:</h4>
              <ul className="space-y-1">
                {message.urlContext.map((meta, index) => {
                  const statusText = typeof meta.urlRetrievalStatus === 'string' 
                    ? meta.urlRetrievalStatus.replace('URL_RETRIEVAL_STATUS_', '') 
                    : '알 수 없음';
                  const isSuccess = meta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS';

                  return (
                    <li key={index} className="text-xs text-gray-500">
                      <a href={meta.retrievedUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="hover:underline break-all text-blue-600">
                        {meta.retrievedUrl}
                      </a>
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        isSuccess
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {statusText}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
         {isUser && <SenderAvatar sender={message.sender} />}
      </div>
    </div>
  );
};

export default MessageItem;