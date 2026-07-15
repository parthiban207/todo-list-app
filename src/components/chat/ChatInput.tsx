import React, { useState } from 'react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <input 
        type="text" 
        placeholder="Type a task prompt... (e.g. Move Gym to tomorrow)" 
        value={input}
        onChange={e => setInput(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      <button type="submit" className="chat-send-btn" disabled={disabled || !input.trim()} title="Send Message">
        <svg className="icon-small" style={{ width: '14px', height: '14px', transform: 'rotate(45deg)' }}>
          <use href="#icon-plus" />
        </svg>
      </button>
    </form>
  );
}
