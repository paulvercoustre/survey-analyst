import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as ChatMessageType } from '../types';
import ProgressiveTraceComponent from './ProgressiveTrace';

interface Props {
  message: ChatMessageType;
}

const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className="w-full mb-6">
      {/* Render traces BEFORE the message bubble (chronological order) */}
      {!isUser && message.traces && message.traces.length > 0 && (
        <div className="mb-2">
          {message.traces.map((trace) => (
            <ProgressiveTraceComponent key={trace.id} trace={trace} />
          ))}
        </div>
      )}

      {/* Message Bubble */}
      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
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
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
