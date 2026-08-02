/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { ChatMessage, MessageSender } from '../types';
import { User, Sparkles, AlertTriangle } from 'lucide-react';
import { DocumentViewerPane } from './DocumentViewerPane';

const renderer = new marked.Renderer();

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
});

async function highlightCode(code: string, lang: string): Promise<string> {
  const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  return hljs.highlight(code, { language }).value;
}

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
  } else {
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
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const openInViewer = (url: string) => {
    try {
      setViewerUrl(new URL(url, window.location.href).toString());
    } catch {
      setViewerUrl(url);
    }
  };

  const handleRenderedContentClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    const href = anchor?.getAttribute('href');

    if (!href) return;

    event.preventDefault();
    event.stopPropagation();
    openInViewer(href);
  };

  const renderMessageContent = () => {
    if (isModel && !message.isLoading) {
      const proseClasses = 'prose prose-sm w-full min-w-0';
      const rawMarkup = marked.parse(message.text || '', { renderer }) as string;
      return (
        <div
          ref={contentRef}
          className={proseClasses}
          onClick={handleRenderedContentClick}
          dangerouslySetInnerHTML={{ __html: rawMarkup }}
        />
      );
    }

    return (
      <div className={`whitespace-pre-wrap text-sm ${isUser ? 'text-white' : 'text-gray-800'}`}>
        {message.text}
      </div>
    );
  };

  const bubbleClasses = `p-3 rounded-lg shadow-md w-full ${
    isUser ? 'bg-blue-500' : 'bg-white border border-gray-200'
  }`;

  return (
    <>
      <div className={`flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className="flex items-start gap-3 max-w-[90%]">
          {!isUser && <SenderAvatar sender={message.sender} />}
          <div className={bubbleClasses}>
            {message.isLoading ? (
              <div className="flex items-center space-x-1.5 p-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              </div>
            ) : (
              renderMessageContent()
            )}

            {isModel && message.groundingChunks && message.groundingChunks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 mb-1.5">
                  {message.wasSearchEnabled ? '웹 소스:' : '근거 원문:'}
                </h4>
                <ul className="space-y-1">
                  {message.groundingChunks.filter(c => c.web).map((chunk, index) => (
                    <li key={index} className="text-xs text-gray-500">
                      <button
                        type="button"
                        onClick={() => openInViewer(chunk.web!.uri)}
                        className="text-left hover:underline break-all text-blue-600"
                        title={chunk.web!.title}
                      >
                        {chunk.web!.title || chunk.web!.uri}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isModel && message.urlContext && message.urlContext.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 mb-1.5">
                  참고한 컨텍스트 URL:
                </h4>
                <ul className="space-y-1">
                  {message.urlContext.map((meta, index) => {
                    const statusText = typeof meta.urlRetrievalStatus === 'string'
                      ? meta.urlRetrievalStatus.replace('URL_RETRIEVAL_STATUS_', '')
                      : '알 수 없음';
                    const isSuccess = meta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS';

                    return (
                      <li key={index} className="text-xs text-gray-500">
                        <button
                          type="button"
                          onClick={() => openInViewer(meta.retrievedUrl)}
                          className="text-left hover:underline break-all text-blue-600"
                        >
                          {meta.retrievedUrl}
                        </button>
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

      {viewerUrl && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] pointer-events-none bg-black/20 md:bg-transparent">
          <div className="absolute inset-0 pointer-events-auto bg-white md:left-auto md:w-[min(850px,70vw)] md:shadow-2xl">
            <DocumentViewerPane
              config={{ type: 'web', url: viewerUrl }}
              onClose={() => setViewerUrl(null)}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default MessageItem;
