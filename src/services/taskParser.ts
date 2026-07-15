import { ChatResponse } from './chatService';

export function parseTaskMessageLocal(
  message: string,
  tasks: any[],
  categories: any[]
): ChatResponse {
  const msg = message.toLowerCase().trim();
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to find a task by fuzzy matching its title
  const findTask = (titleQuery: string) => {
    const query = titleQuery.trim().toLowerCase();
    if (!query) return null;
    return tasks.find(t => t.title.toLowerCase().includes(query)) || null;
  };

  // Helper to resolve relative dates (today, tomorrow, friday, etc.)
  const resolveRelativeDate = (dateStr: string): string => {
    const d = new Date();
    const clean = dateStr.trim().toLowerCase();
    if (clean === 'today') {
      return d.toISOString().split('T')[0];
    }
    if (clean === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
    
    // Resolve weekday (e.g. friday, monday)
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayIndex = daysOfWeek.indexOf(clean);
    if (targetDayIndex !== -1) {
      const currentDayIndex = d.getDay();
      let diff = targetDayIndex - currentDayIndex;
      if (diff <= 0) diff += 7; // Next week's day
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }

    // Try parsing YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    return todayStr; // fallback
  };

  // Helper to parse time strings like 6 PM or 14:00
  const resolveTime = (timeStr: string): string => {
    const clean = timeStr.trim().toLowerCase();
    const pmAmMatch = clean.match(/(\d+)\s*(pm|am)/);
    if (pmAmMatch) {
      let hours = parseInt(pmAmMatch[1]);
      const isPm = pmAmMatch[2] === 'pm';
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:00`;
    }
    const hhMmMatch = clean.match(/(\d{1,2}):(\d{2})/);
    if (hhMmMatch) {
      return `${hhMmMatch[1].padStart(2, '0')}:${hhMmMatch[2]}`;
    }
    return '23:59'; // default end of day
  };

  // --- Pattern: Search Tasks ---
  const searchMatch = msg.match(/(?:search|find|look for|look up|where is|do i have)\s+(?:task[s]?\s+)?(?:about\s+|for\s+|called\s+)?(.+)/);
  if (searchMatch && !msg.includes('delete') && !msg.includes('complete') && !msg.includes('finish') && !msg.includes('move') && !msg.includes('postpone')) {
    const query = searchMatch[1].replace(/[?"']/g, '').trim();
    const matchedTasks = tasks.filter((t: any) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(query.toLowerCase())) ||
      (t.category && t.category.toLowerCase().includes(query.toLowerCase()))
    );

    if (matchedTasks.length === 0) {
      return {
        reply: `I couldn't find any tasks matching **"${query}"**. Try a different keyword or check your spelling.`,
        action: { type: 'none' }
      };
    }

    const listText = matchedTasks.map((t: any, idx: number) => {
      const pColor = t.priority === 'high' ? '🔴' : (t.priority === 'medium' ? '🟡' : '🔵');
      const statusIcon = t.status === 'completed' ? '✅' : '⏳';
      return `${idx + 1}. ${pColor} ${statusIcon} **${t.title}** — due ${formatDateFriendly(t.dueDate)} at ${formatTimeFriendly(t.dueTime)}`;
    }).join('\n');

    return {
      reply: `I found **${matchedTasks.length}** task(s) matching **"${query}"**:\n\n${listText}`,
      action: { type: 'search_tasks', params: { query } }
    };
  }

  // --- Pattern: Show Today's Tasks ---
  if (msg.includes('what') && msg.includes('do') && msg.includes('today') || msg.includes('today\'s tasks') || msg.includes('list today') || msg.includes('show today') || msg.includes('my agenda') || msg.includes('schedule today')) {
    const pendingToday = tasks.filter((t: any) => t.dueDate === todayStr && t.status !== 'completed');
    if (pendingToday.length === 0) {
      return {
        reply: "You have no pending tasks scheduled for today! Great job! 🎉",
        action: { type: 'show_today', params: {} }
      };
    }
    
    // Sort high > medium > low
    const pMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
    pendingToday.sort((a: any, b: any) => pMap[b.priority] - pMap[a.priority]);

    const taskListText = pendingToday.map((t: any, idx: number) => {
      const pColor = t.priority === 'high' ? '🔴' : (t.priority === 'medium' ? '🟡' : '🔵');
      return `${idx + 1}. ${pColor} **${t.title}** [${t.priority.toUpperCase()}] - due at ${formatTimeFriendly(t.dueTime)}`;
    }).join('\n');

    return {
      reply: `Here are your pending tasks for today in priority order:\n\n${taskListText}`,
      action: { type: 'show_today', params: {} }
    };
  }

  // --- Pattern: Show Pending Tasks ---
  if (msg.includes('show pending') || msg.includes('pending tasks') || msg.includes('incomplete') || msg.includes('unfinished') || msg.includes('not done') || msg.includes('still open')) {
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    if (pendingTasks.length === 0) {
      return {
        reply: "You have no pending tasks. Everything is completed! 🎉",
        action: { type: 'show_pending', params: {} }
      };
    }

    const pMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
    pendingTasks.sort((a: any, b: any) => pMap[b.priority] - pMap[a.priority]);

    const listText = pendingTasks.map((t: any, idx: number) => {
      const pColor = t.priority === 'high' ? '🔴' : (t.priority === 'medium' ? '🟡' : '🔵');
      return `${idx + 1}. ${pColor} **${t.title}** — due ${formatDateFriendly(t.dueDate)} at ${formatTimeFriendly(t.dueTime)}`;
    }).join('\n');

    return {
      reply: `You have **${pendingTasks.length}** pending task(s):\n\n${listText}`,
      action: { type: 'show_pending', params: {} }
    };
  }

  // --- Pattern: Delete Task ---
  const deleteMatch = msg.match(/(?:delete|remove)\s+(?:task\s+)?(.+)/);
  if (deleteMatch && !msg.includes('subtask')) {
    const targetTitle = deleteMatch[1].replace(/["']/g, '');
    const task = findTask(targetTitle);
    if (task) {
      return {
        reply: `Are you sure you want to permanently delete the task **"${task.title}"**?`,
        action: {
          type: 'ask_confirmation',
          params: {
            confirmationType: 'delete_task',
            taskId: task.id,
            taskTitle: task.title
          }
        }
      };
    } else {
      return {
        reply: `I couldn't find a task matching "${targetTitle}" to delete.`,
        action: { type: 'none' }
      };
    }
  }

  // --- Pattern: Complete/Finish Task ---
  const completeMatch = msg.match(/(?:complete|finish|mark\s+complete|mark\s+completed|done)\s+(?:task\s+)?(.+)/);
  if (completeMatch) {
    const targetTitle = completeMatch[1].replace(/["']/g, '');
    const task = findTask(targetTitle);
    if (task) {
      return {
        reply: `I've marked the task **"${task.title}"** as completed!`,
        action: {
          type: 'complete_task',
          params: {
            taskId: task.id,
            taskTitle: task.title
          }
        }
      };
    } else {
      return {
        reply: `I couldn't find a task matching "${targetTitle}" to complete.`,
        action: { type: 'none' }
      };
    }
  }

  // --- Pattern: Update Task ---
  const updateMatch = msg.match(/(?:change|rename|set|update|edit)\s+(?:task\s+)?(?:the\s+)?(.+?)\s+(?:to|as|priority|title|category)\s+(.+)/);
  if (updateMatch) {
    const targetTitle = updateMatch[1].replace(/["']/g, '').trim();
    const newValue = updateMatch[2].replace(/["']/g, '').trim();
    const task = findTask(targetTitle);
    
    if (task) {
      const updates: any = {};
      let updateDesc = '';

      // Detect what's being updated
      if (msg.includes('priority')) {
        const priorityMatch = newValue.match(/(?:high|medium|low)/i);
        if (priorityMatch) {
          updates.priority = priorityMatch[0].toLowerCase();
          updateDesc = `priority to **${updates.priority}**`;
        }
      } else if (msg.includes('category')) {
        updates.category = newValue.charAt(0).toUpperCase() + newValue.slice(1);
        updateDesc = `category to **${updates.category}**`;
      } else if (msg.includes('rename') || msg.includes('title')) {
        updates.title = newValue.charAt(0).toUpperCase() + newValue.slice(1);
        updateDesc = `title to **"${updates.title}"**`;
      } else {
        // Default: treat as rename
        updates.title = newValue.charAt(0).toUpperCase() + newValue.slice(1);
        updateDesc = `title to **"${updates.title}"**`;
      }

      return {
        reply: `I've updated **"${task.title}"** — changed ${updateDesc}.`,
        action: {
          type: 'update_task',
          params: {
            taskId: task.id,
            taskTitle: task.title,
            updates
          }
        }
      };
    } else {
      return {
        reply: `I couldn't find a task matching "${targetTitle}" to update.`,
        action: { type: 'none' }
      };
    }
  }

  // --- Pattern: Postpone/Move Task ---
  const moveMatch = msg.match(/(?:move|postpone|reschedule)\s+(.+?)\s+to\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})/);
  if (moveMatch) {
    const targetTitle = moveMatch[1].replace(/["']/g, '');
    const relativeDate = moveMatch[2];
    const task = findTask(targetTitle);
    if (task) {
      const resolvedDate = resolveRelativeDate(relativeDate);
      const friendlyDate = formatDateFriendly(resolvedDate);
      return {
        reply: `I've postponed **"${task.title}"** to **${friendlyDate}**.`,
        action: {
          type: 'postpone_task',
          params: {
            taskId: task.id,
            dueDate: resolvedDate
          }
        }
      };
    } else {
      return {
        reply: `I couldn't find a task matching "${targetTitle}" to postpone.`,
        action: { type: 'none' }
      };
    }
  }

  // --- Pattern: Show Completed Tasks ---
  if (msg.includes('show completed') || msg.includes('completed tasks') || msg.includes('list completed')) {
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    if (completedTasks.length === 0) {
      return {
        reply: "You haven't completed any tasks yet. Tick some off to see them here!",
        action: { type: 'none' }
      };
    }
    const listText = completedTasks.map((t: any, idx: number) => `${idx + 1}. ✅ **${t.title}** (Completed)`).join('\n');
    return {
      reply: `Here are your completed tasks:\n\n${listText}`,
      action: { type: 'none' }
    };
  }

  // --- Pattern: Overloaded/Overwhelmed (Suggest Postpone) ---
  if (msg.includes('too many tasks') || msg.includes('overwhelmed') || msg.includes('busy')) {
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    if (pendingTasks.length <= 2) {
      return {
        reply: `You only have ${pendingTasks.length} pending task(s) on your list. You've got this! Let me know if you need to reschedule any.`,
        action: { type: 'none' }
      };
    }

    // Suggest postponing low/medium priority tasks due today or in the past
    const candidates = pendingTasks.filter((t: any) => t.priority !== 'high' && t.dueDate <= todayStr);
    if (candidates.length === 0) {
      return {
        reply: "You have several pending tasks, but they are either high priority or due in the future. Try tackling them one by one, starting with high priority first!",
        action: { type: 'none' }
      };
    }

    // Suggest moving them: tomorrow for the first, day after for the second, etc.
    const suggestions = candidates.map((t: any, idx: number) => {
      const fut = new Date();
      fut.setDate(fut.getDate() + 1 + idx); // Tomorrow, 2 days, etc.
      return {
        taskId: t.id,
        title: t.title,
        suggestedDate: fut.toISOString().split('T')[0]
      };
    });

    const suggestionsText = suggestions.map((s: any) => `• Move **"${s.title}"** to **${formatDateFriendly(s.suggestedDate)}**`).join('\n');

    return {
      reply: `I see you have ${pendingTasks.length} pending tasks. To help ease your schedule, I suggest postponing these lower-priority tasks:\n\n${suggestionsText}\n\nWould you like me to reschedule them? (Say "yes" or "reschedule them")`,
      action: {
        type: 'suggest_postpone',
        params: {
          suggestions: suggestions.map((s: any) => ({ taskId: s.taskId, suggestedDate: s.suggestedDate }))
        }
      }
    };
  }

  // --- Pattern: Productivity Tips / Daily Schedule ---
  if (msg.includes('productivity tip') || msg.includes('tips') || msg.includes('advice')) {
    const tips = [
      "Try the **Pomodoro Technique**: work for 25 minutes, then take a 5-minute break. Repeat 4 times, then take a longer break.",
      "Identify your **One Big Thing** (OBT) every morning. Tackle that first before checking email or chat.",
      "Use **Time Blocking**: schedule specific blocks of time in your calendar for focused task work rather than working from a list.",
      "Clear your workspace and close unused browser tabs. A clean space leads to a focused mind!"
    ];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    return {
      reply: `💡 **Productivity Tip:**\n\n${randomTip}`,
      action: { type: 'none' }
    };
  }

  // --- Pattern: Greetings / Help ---
  if (msg === 'hello' || msg === 'hi' || msg === 'hey' || msg.includes('help') || msg === 'who are you') {
    return {
      reply: `Hello! I'm **Zenith**, your productivity assistant. 🚀\n\nI can help you manage your tasks in natural language. Try saying:\n• *"I need to finish my assignment tomorrow at 4 PM"*\n• *"Remind me to call John at 6 PM"*\n• *"What should I do today?"*\n• *"Show pending tasks"*\n• *"Search for gym"*\n• *"Change gym priority to high"*\n• *"Move gym to Friday"*\n• *"Mark assignment complete"*\n• *"Delete my shopping task"*`,
      action: { type: 'none' }
    };
  }

  // --- Default: Parse Add Task ---
  let cleanTaskTitle = message;
  let resolvedDate = todayStr;
  let resolvedTimeVal = '23:59';
  let priorityVal: 'high' | 'medium' | 'low' = 'medium';

  // 1. Detect Priority
  if (msg.includes('urgent') || msg.includes('asap') || msg.includes('high priority') || msg.includes('important')) {
    priorityVal = 'high';
  } else if (msg.includes('low priority') || msg.includes('leisure')) {
    priorityVal = 'low';
  }

  // Remove prefixes
  cleanTaskTitle = cleanTaskTitle.replace(/^(?:remind me to|i need to|i have to|want to|please|add task|add)\s+/i, '');

  // 2. Detect Relative Date
  const dateRegex = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const dateMatch = cleanTaskTitle.match(dateRegex);
  if (dateMatch) {
    resolvedDate = resolveRelativeDate(dateMatch[1]);
    cleanTaskTitle = cleanTaskTitle.replace(new RegExp(`\\s*(?:on|by|due)?\\s*\\b${dateMatch[1]}\\b`, 'i'), '');
  }

  // 3. Detect Time
  const timeRegex = /\b(?:at|by)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i;
  const timeMatch = cleanTaskTitle.match(timeRegex);
  if (timeMatch) {
    resolvedTimeVal = resolveTime(timeMatch[1]);
    cleanTaskTitle = cleanTaskTitle.replace(new RegExp(`\\s*(?:at|by)?\\s*\\b${timeMatch[1]}\\b`, 'i'), '');
  }

  // Clean title cleanup
  cleanTaskTitle = cleanTaskTitle.replace(/\s+(?:due|on|by|at)\s*$/i, '').trim();

  // If title is empty, ask for details instead of guessing
  if (!cleanTaskTitle || cleanTaskTitle.length < 2) {
    return {
      reply: "I couldn't quite catch the task details. What would you like me to remind you about?",
      action: { type: 'none' }
    };
  }

  // Capitalize task title
  cleanTaskTitle = cleanTaskTitle.charAt(0).toUpperCase() + cleanTaskTitle.slice(1);

  const friendlyDate = formatDateFriendly(resolvedDate);
  const friendlyTime = formatTimeFriendly(resolvedTimeVal);

  return {
    reply: `I've created the task **"${cleanTaskTitle}"** due **${friendlyDate}** at **${friendlyTime}**.`,
    action: {
      type: 'add_task',
      params: {
        title: cleanTaskTitle,
        dueDate: resolvedDate,
        dueTime: resolvedTimeVal,
        priority: priorityVal,
        category: categories[0]?.name || 'Work'
      }
    }
  };
}

// Helpers for friendly output
function formatDateFriendly(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeFriendly(timeStr: string) {
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0]);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}
