export interface ChatAction {
  type:
    | 'add_task'
    | 'update_task'
    | 'delete_task'
    | 'complete_task'
    | 'postpone_task'
    | 'search_tasks'
    | 'show_today'
    | 'show_pending'
    | 'suggest_postpone'
    | 'ask_confirmation'
    | 'none';
  params?: any;
}

export interface ChatResponse {
  reply: string;
  action: ChatAction;
  fallback?: boolean;
}

export async function sendMessageToAI(
  message: string,
  tasks: any[],
  categories: any[]
): Promise<ChatResponse> {
  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      tasks,
      categories,
      currentTime
    })
  });

  if (!response.ok) {
    throw new Error('API server returned an error');
  }

  return response.json();
}
