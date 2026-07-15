import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { ChatMessageItem } from '@/hooks/useChat';

interface ChatWindowProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: ChatMessageItem[];
  isTyping: boolean;
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
}

export default function ChatWindow({
  isOpen,
  setIsOpen,
  messages,
  isTyping,
  onSendMessage,
  onClearHistory
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages or typing status updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  return (
    <>
      {/* Floating Toggle Chat Button */}
      <button 
        className={`chat-toggle-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle AI Productivity Chat"
      >
        {isOpen ? (
          <svg className="icon" style={{ width: '22px', height: '22px' }}><use href="#icon-close" /></svg>
        ) : (
          <svg className="icon" style={{ width: '22px', height: '22px' }}><use href="#icon-bell" /></svg>
        )}
      </button>

      {/* Floating Glassmorphism Chat Panel */}
      {isOpen && (
        <div className="chat-window-panel">
          <div className="chat-window-header">
            <div className="chat-header-left">
              <div className="chat-bot-icon">
                <svg className="icon" style={{ width: '16px', height: '16px', color: 'white' }}><use href="#icon-check" /></svg>
              </div>
              <div className="chat-bot-info">
                <h3>Zenith Assistant</h3>
                <div className="chat-status">
                  <span className="status-dot" />
                  <span>Online AI Planner</span>
                </div>
              </div>
            </div>
            
            <div className="chat-header-actions">
              <button className="chat-header-btn" title="Clear Chat Logs" onClick={onClearHistory}>
                <svg className="icon-small" style={{ width: '14px', height: '14px' }}><use href="#icon-trash" /></svg>
              </button>
              <button className="chat-header-btn" title="Close Panel" onClick={() => setIsOpen(false)}>
                <svg className="icon-small" style={{ width: '14px', height: '14px' }}><use href="#icon-close" /></svg>
              </button>
            </div>
          </div>

          <div className="chat-window-body" ref={scrollRef}>
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={idx} 
                sender={msg.sender} 
                text={msg.text} 
                timestamp={msg.timestamp} 
              />
            ))}
            
            {isTyping && (
              <div className="chat-message-row ai">
                <div className="chat-avatar">Z</div>
                <TypingIndicator />
              </div>
            )}
          </div>

          <div className="chat-window-footer">
            <ChatInput onSendMessage={onSendMessage} disabled={isTyping} />
          </div>
        </div>
      )}

      {/* Scoped CSS Styles for AI Assistant components */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Toggle button floating bottom-right */
        .chat-toggle-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
          z-index: 9999;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chat-toggle-btn:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 30px rgba(99, 102, 241, 0.5);
        }
        .chat-toggle-btn.open {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          box-shadow: 0 8px 24px var(--shadow-hover);
        }

        /* Glassmorphism Panel Wrapper */
        .chat-window-panel {
          position: fixed;
          bottom: 94px;
          right: 24px;
          width: 400px;
          height: 560px;
          max-height: calc(100vh - 140px);
          border-radius: var(--radius-lg);
          background: var(--card-overlay);
          backdrop-filter: blur(16px);
          border: 1px solid var(--border-color);
          box-shadow: 0 15px 45px var(--shadow-hover);
          z-index: 9998;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: chatSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: bottom right;
        }

        @keyframes chatSlideUp {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Chat Header */
        .chat-window-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.1);
        }
        .chat-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chat-bot-icon {
          width: 32px;
          height: 32px;
          background-color: var(--primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-bot-info h3 {
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.2;
        }
        .chat-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          background-color: var(--success);
          border-radius: 50%;
          display: inline-block;
          animation: pulseStatus 2s infinite;
        }
        @keyframes pulseStatus {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .chat-header-actions {
          display: flex;
          gap: 8px;
        }
        .chat-header-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all var(--transition-fast);
        }
        .chat-header-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }

        /* Chat Scroll Body */
        .chat-window-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Chat message rows */
        .chat-message-row {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          max-width: 85%;
        }
        .chat-message-row.user {
          margin-left: auto;
          flex-direction: row-reverse;
        }
        .chat-message-row.ai {
          margin-right: auto;
        }
        .chat-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.78rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .chat-message-row.user .chat-avatar {
          background-color: var(--border-color);
          color: var(--text-secondary);
        }
        .chat-message-row.ai .chat-avatar {
          background-color: var(--primary-light);
          color: var(--primary);
        }

        /* Chat Bubble designs */
        .chat-message-bubble {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 0.88rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
          line-height: 1.4;
          box-shadow: 0 2px 6px rgba(0,0,0,0.02);
        }
        .chat-message-bubble.user {
          background-color: var(--primary);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .chat-message-bubble.ai {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border-color);
        }
        .chat-message-text strong {
          font-weight: 700;
        }
        .chat-message-text code {
          background-color: rgba(0,0,0,0.06);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.8rem;
        }
        .chat-message-bubble.user .chat-message-text code {
          background-color: rgba(255,255,255,0.2);
        }
        .chat-message-text ul, .chat-message-text ol {
          margin-top: 6px;
          padding-left: 20px;
        }
        .chat-message-text li {
          margin-bottom: 4px;
        }
        .chat-message-meta {
          font-size: 0.68rem;
          opacity: 0.6;
          text-align: right;
          align-self: flex-end;
        }

        /* Footer Input Form styling */
        .chat-window-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color);
          background-color: rgba(255,255,255,0.02);
        }
        .chat-input-form {
          display: flex;
          gap: 8px;
        }
        .chat-input-form input {
          flex: 1;
          font-family: var(--font-sans);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          outline: none;
          transition: all var(--transition-fast);
        }
        .chat-input-form input:focus {
          border-color: var(--primary);
          background-color: var(--bg-secondary);
        }
        .chat-send-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background-color: var(--primary);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .chat-send-btn:hover:not(:disabled) {
          background-color: var(--primary-hover);
        }
        .chat-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .chat-window-panel {
            width: calc(100vw - 32px);
            height: calc(100vh - 140px);
            bottom: 84px;
            right: 16px;
          }
          .chat-toggle-btn {
            bottom: 16px;
            right: 16px;
          }
        }
      `}} />
    </>
  );
}
