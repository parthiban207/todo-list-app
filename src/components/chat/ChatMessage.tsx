import React from 'react';

interface ChatMessageProps {
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export default function ChatMessage({ sender, text, timestamp }: ChatMessageProps) {
  const formatText = (rawText: string) => {
    // 1. Escape basic HTML tags to prevent cross-site scripting
    let html = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Bold: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 3. Italic: *text* -> <em>text</em>
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 4. Code: `text` -> <code>text</code>
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // 5. Lists: • item -> <li>item</li>
    html = html.replace(/^•\s*(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');

    // 6. Ordered lists: 1. item -> <li class="num">item</li>
    html = html.replace(/^\d+\.\s*(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, '<ol>$1</ol>');

    // 7. New lines -> <br />
    html = html.replace(/\n/g, '<br />');

    return { __html: html };
  };

  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`chat-message-row ${sender}`}>
      <div className="chat-avatar">
        {sender === 'user' ? 'U' : 'Z'}
      </div>
      <div className={`chat-message-bubble ${sender}`}>
        <div className="chat-message-text" dangerouslySetInnerHTML={formatText(text)} />
        <div className="chat-message-meta">{timeStr}</div>
      </div>
    </div>
  );
}
