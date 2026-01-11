import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as ChatMessageType } from '../types';

interface Props {
  message: ChatMessageType;
}

const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div 
        className={`
          max-w-[85%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm
          ${isUser 
            ? 'bg-blue-600 text-white rounded-br-none' 
            : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'
          }
        `}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* Debug/Data View (Optional - show used data sources) */}
        {!isUser && message.relatedData && message.relatedData.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 mb-2">Queried Data:</p>
            <div className="flex flex-wrap gap-2">
              {message.relatedData.map((data, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-mono">
                  {data.query.question_name} ({data.result.length} rows)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;