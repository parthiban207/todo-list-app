import { useState, useEffect } from 'react';
import { sendMessageToAI, ChatResponse, ChatAction } from '@/services/chatService';
import { parseTaskMessageLocal } from '@/services/taskParser';

export interface ChatMessageItem {
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface UseChatProps {
  userId: string;
  tasks: any[];
  categories: any[];
  addTask: (title: string, desc: string, dueDate: string, dueTime: string, priority: 'high' | 'medium' | 'low', category: string) => Promise<any>;
  updateTask: (taskId: string, updates: Record<string, any>) => Promise<any>;
  toggleTaskStatus: (taskId: string) => Promise<any>;
  deleteTask: (taskId: string) => Promise<any>;
  postponeTask: (taskId: string, dueDate: string) => Promise<any>;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function useChat({
  userId,
  tasks,
  categories,
  addTask,
  updateTask,
  toggleTaskStatus,
  deleteTask,
  postponeTask,
  showToast
}: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: string;
    taskId: string;
    taskTitle: string;
    suggestedDate?: string;
    suggestions?: any[];
  } | null>(null);

  // Load chat history from localStorage on startup
  useEffect(() => {
    if (userId) {
      const stored = localStorage.getItem(`zenith_chat_history_${userId}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        // Welcome message
        const welcomeMsg: ChatMessageItem = {
          sender: 'ai',
          text: "Hello! I'm **Zenith**, your productivity assistant. 🚀\n\nHow can I help you manage your tasks today? Try asking me to add, search, update, or complete tasks!",
          timestamp: Date.now()
        };
        setMessages([welcomeMsg]);
        localStorage.setItem(`zenith_chat_history_${userId}`, JSON.stringify([welcomeMsg]));
      }
    }
  }, [userId]);

  // Save chat history to localStorage
  const saveHistory = (nextMessages: ChatMessageItem[]) => {
    setMessages(nextMessages);
    localStorage.setItem(`zenith_chat_history_${userId}`, JSON.stringify(nextMessages));
  };

  const clearChatHistory = () => {
    const welcomeMsg: ChatMessageItem = {
      sender: 'ai',
      text: "Hello! I'm **Zenith**, your productivity assistant. 🚀\n\nHow can I help you manage your tasks today?",
      timestamp: Date.now()
    };
    saveHistory([welcomeMsg]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // 1. Add user message
    const userMsg: ChatMessageItem = {
      sender: 'user',
      text: text.trim(),
      timestamp: Date.now()
    };
    const updatedMessages = [...messages, userMsg];
    saveHistory(updatedMessages);
    setIsTyping(true);

    try {
      const cleanText = text.trim().toLowerCase();

      // --- Intercept Confirmations ---
      if (pendingConfirmation) {
        if (cleanText === 'yes' || cleanText === 'sure' || cleanText === 'ok' || cleanText === 'confirm' || cleanText === 'reschedule them') {
          const actionType = pendingConfirmation.type;
          
          if (actionType === 'delete_task') {
            await deleteTask(pendingConfirmation.taskId);
            const aiReply: ChatMessageItem = {
              sender: 'ai',
              text: `I've deleted the task **"${pendingConfirmation.taskTitle}"** for you.`,
              timestamp: Date.now()
            };
            saveHistory([...updatedMessages, aiReply]);
          } else if (actionType === 'suggest_postpone' && pendingConfirmation.suggestions) {
            // Postpone all suggested tasks
            for (const sugg of pendingConfirmation.suggestions) {
              await postponeTask(sugg.taskId, sugg.suggestedDate);
            }
            const aiReply: ChatMessageItem = {
              sender: 'ai',
              text: `Great, I've rescheduled those ${pendingConfirmation.suggestions.length} tasks to give you more breathing room today.`,
              timestamp: Date.now()
            };
            saveHistory([...updatedMessages, aiReply]);
          }

          setPendingConfirmation(null);
          setIsTyping(false);
          return;
        } else if (cleanText === 'no' || cleanText === 'cancel' || cleanText === 'nope') {
          const aiReply: ChatMessageItem = {
            sender: 'ai',
            text: "Okay, I've cancelled that action. What else can I help with?",
            timestamp: Date.now()
          };
          saveHistory([...updatedMessages, aiReply]);
          setPendingConfirmation(null);
          setIsTyping(false);
          return;
        }
      }

      // 2. Call AI backend route
      let aiResult: ChatResponse;
      try {
        aiResult = await sendMessageToAI(text, tasks, categories);
      } catch (apiErr) {
        // network fallback
        console.warn("API Route error, falling back to local regex parser:", apiErr);
        aiResult = { reply: '', action: { type: 'none' }, fallback: true };
      }

      // 3. Fallback to Local Regex Parser if flagged by route handler or if call failed
      if (aiResult.fallback) {
        aiResult = parseTaskMessageLocal(text, tasks, categories);
      }

      // 4. Intercept actions and execute callbacks
      const { action, reply } = aiResult;
      
      if (action && action.type !== 'none') {
        await executeAction(action);
      }

      // 5. Save AI response
      const aiResponseMsg: ChatMessageItem = {
        sender: 'ai',
        text: reply || "I'm not sure how to handle that command.",
        timestamp: Date.now()
      };
      saveHistory([...updatedMessages, aiResponseMsg]);
    } catch (err: any) {
      console.error('Error sending message:', err.message);
      const errMsg: ChatMessageItem = {
        sender: 'ai',
        text: "Sorry, I had trouble parsing that. Please try again.",
        timestamp: Date.now()
      };
      saveHistory([...updatedMessages, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const executeAction = async (action: ChatAction) => {
    const { type, params } = action;

    try {
      switch (type) {
        case 'add_task':
          await addTask(
            params.title,
            params.description || '',
            params.dueDate || new Date().toISOString().split('T')[0],
            params.dueTime || '23:59',
            params.priority || 'medium',
            params.category || categories[0]?.name || 'Work'
          );
          break;

        case 'update_task':
          if (params.taskId && params.updates) {
            await updateTask(params.taskId, params.updates);
          }
          break;

        case 'complete_task':
          await toggleTaskStatus(params.taskId);
          break;

        case 'delete_task':
          // If we receive delete_task directly, we delete it
          await deleteTask(params.taskId);
          break;

        case 'postpone_task':
          await postponeTask(params.taskId, params.dueDate);
          break;

        case 'ask_confirmation':
          setPendingConfirmation({
            type: params.confirmationType,
            taskId: params.taskId,
            taskTitle: params.taskTitle
          });
          break;

        case 'suggest_postpone':
          setPendingConfirmation({
            type: 'suggest_postpone',
            taskId: '',
            taskTitle: '',
            suggestions: params.suggestions
          });
          break;

        // search_tasks, show_today, show_pending are display-only — the reply text
        // already contains the formatted task list. No Supabase mutation needed.
        case 'search_tasks':
        case 'show_today':
        case 'show_pending':
          break;

        default:
          break;
      }
    } catch (err: any) {
      console.error('Failed to execute AI task action:', err.message);
      showToast('AI Task update failed: ' + err.message, 'error');
    }
  };

  return {
    messages,
    isTyping,
    isOpen,
    setIsOpen,
    handleSendMessage,
    clearChatHistory
  };
}
