import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
      <style dangerouslySetInnerHTML={{ __html: `
        .typing-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 12px 16px;
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-md);
          border-bottom-left-radius: 4px;
          width: fit-content;
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          background-color: var(--text-secondary);
          border-radius: 50%;
          opacity: 0.4;
          animation: typing-bounce 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) {
          animation-delay: -0.32s;
        }
        .typing-dot:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); opacity: 1; }
        }
      `}} />
    </div>
  );
}
