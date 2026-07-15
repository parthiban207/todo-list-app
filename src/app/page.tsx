'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ChatWindow from '@/components/chat/ChatWindow';
import { useChat } from '@/hooks/useChat';



interface Subtask {
  id: string;
  task_id: string;
  name: string;
  completed: boolean;
  due_date: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  status: 'pending' | 'inprogress' | 'completed';
  reminderMinutesBefore: number;
  notified: boolean;
  subtasks: Subtask[];
}

interface Category {
  id?: string;
  name: string;
  color: string;
}

interface NotificationItem {
  id: string;
  text: string;
  time: number;
  read: boolean;
  taskId?: string;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Work', color: '#3b82f6' },
  { name: 'Personal', color: '#10b981' },
  { name: 'Shopping', color: '#f59e0b' },
  { name: 'Health', color: '#ef4444' }
];

export default function Home() {

  const apiFetch = async (url: string, options: any = {}) => {
    let token = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        token = session.access_token;
      }
    } catch (e) {}
    
    const headers = {
      ...options.headers,
      ...(token ? { 'Authorization': \`Bearer \${token}\` } : {})
    };
    
    return fetch(url, { ...options, headers });
  };

  // --- Authentication States ---
  const [userId, setUserId] = useState<string>('');
  const [appReady, setAppReady] = useState(false);

  // --- App States ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // --- Filtering & Sorting States ---
  const [currentFilter, setCurrentFilter] = useState('all'); // 'all', 'today', 'upcoming', 'pending', 'completed' or 'cat-[Name]'
  const [filterPriority, setFilterPriority] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [filterCategory, setFilterCategory] = useState('all'); // 'all', or category name
  const [sortBy, setSortBy] = useState('priority-desc'); // 'priority-desc', 'duedate-asc', 'duedate-desc', 'alphabetical-asc', 'status-asc'
  const [searchQuery, setSearchQuery] = useState('');

  // --- Theme State ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // --- Modal States ---
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalMode, setTaskModalMode] = useState<'add' | 'edit'>('add');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPostponeModalOpen, setIsPostponeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Form States ---
  // Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskCategory, setTaskCategory] = useState('');
  const [taskReminder, setTaskReminder] = useState('0'); // string value for option select
  const [taskCustomReminder, setTaskCustomReminder] = useState(15);
  // Category Form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6');
  // Subtask Form
  const [subtaskName, setSubtaskName] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
  // Postpone Form
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeTime, setPostponeTime] = useState('');

  // --- Keyboard Suggestions Navigation State ---
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  // --- Refs ---
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notificationContainerRef = useRef<HTMLDivElement>(null);

  // --- Toast Trigger helper ---
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // --- 1. Core API Task CRUD Operations (Optimistic UI Updates) ---
  const apiAddTask = async (
    title: string,
    description: string,
    dueDate: string,
    dueTime: string,
    priority: 'high' | 'medium' | 'low',
    categoryName: string
  ) => {
    if (!userId) { showToast('Still authenticating, please wait...', 'warning'); return; }
    
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        title,
        description,
        due_date: dueDate,
        due_time: dueTime,
        priority,
        category_name: categoryName,
        status: 'pending',
        reminder_minutes_before: 0,
        notified: false
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add task');
    }

    const data = await res.json();
    if (data && data[0]) {
      const newTask: Task = {
        id: data[0].id,
        title: data[0].title,
        description: data[0].description || '',
        dueDate: data[0].due_date,
        dueTime: data[0].due_time,
        priority: data[0].priority,
        category: data[0].category_name,
        status: data[0].status,
        reminderMinutesBefore: data[0].reminder_minutes_before,
        notified: data[0].notified,
        subtasks: []
      };
      setTasks(prev => [...prev, newTask]);
    }
  };

  const apiToggleTaskStatus = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    const res = await apiFetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, status: newStatus })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to toggle task status');
    }

    let nextSubtasks = [...task.subtasks];
    const subtaskRes = await apiFetch('/api/subtasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, completed: newStatus === 'completed' })
    });

    if (subtaskRes.ok) {
      nextSubtasks = nextSubtasks.map(s => ({ ...s, completed: newStatus === 'completed' }));
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: newStatus,
          subtasks: nextSubtasks
        };
      }
      return t;
    }));
  };

  const apiDeleteTask = async (taskId: string) => {
    const res = await apiFetch(`/api/tasks?id=${taskId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete task');
    }

    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const apiPostponeTask = async (taskId: string, dueDate: string, dueTime?: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updates: any = { due_date: dueDate, notified: false };
    if (dueTime) {
      updates.due_time = dueTime;
    }

    const res = await apiFetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, ...updates })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to postpone task');
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nextTask = { ...t, dueDate, notified: false };
        if (dueTime) {
          nextTask.dueTime = dueTime;
        }
        return nextTask;
      }
      return t;
    }));
  };

  const apiUpdateTask = async (taskId: string, updates: Record<string, any>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const dbUpdates: Record<string, any> = {};
    const localUpdates: Partial<Task> = {};

    if (updates.title !== undefined) {
      dbUpdates.title = updates.title;
      localUpdates.title = updates.title;
    }
    if (updates.description !== undefined) {
      dbUpdates.description = updates.description;
      localUpdates.description = updates.description;
    }
    if (updates.dueDate !== undefined) {
      dbUpdates.due_date = updates.dueDate;
      dbUpdates.notified = false;
      localUpdates.dueDate = updates.dueDate;
      localUpdates.notified = false;
    }
    if (updates.dueTime !== undefined) {
      dbUpdates.due_time = updates.dueTime;
      dbUpdates.notified = false;
      localUpdates.dueTime = updates.dueTime;
      localUpdates.notified = false;
    }
    if (updates.priority !== undefined) {
      dbUpdates.priority = updates.priority;
      localUpdates.priority = updates.priority;
    }
    if (updates.category !== undefined) {
      dbUpdates.category_name = updates.category;
      localUpdates.category = updates.category;
    }

    const res = await apiFetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, ...dbUpdates })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update task');
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, ...localUpdates };
      }
      return t;
    }));
  };

  // --- 2. Initialize useChat AI Coordinator ---
  const chat = useChat({
    userId,
    tasks,
    categories,
    addTask: apiAddTask,
    updateTask: apiUpdateTask,
    toggleTaskStatus: apiToggleTaskStatus,
    deleteTask: apiDeleteTask,
    postponeTask: apiPostponeTask,
    showToast
  });

  // --- 3. Startup and Event Listeners ---
  useEffect(() => {
    // Authenticate to get a user ID for Supabase operations
    const initAuth = async () => {
      let uid: string | null = null;

      // Strategy 1: Reuse an existing Supabase auth session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          uid = session.user.id;
        }
      } catch (_) {}

      // Strategy 2: Anonymous sign-in (if enabled in Supabase dashboard)
      if (!uid) {
        try {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (!error && data?.user?.id) {
            uid = data.user.id;
          }
        } catch (_) {}
      }

      // Strategy 3: Use a locally-generated stable UUID (works when service role key
      // is configured in .env, which bypasses RLS and doesn't require auth)
      if (!uid) {
        let storedId = localStorage.getItem('zenith_local_user_id');
        if (!storedId) {
          storedId = crypto.randomUUID();
          localStorage.setItem('zenith_local_user_id', storedId);
        }
        uid = storedId;
      }

      setUserId(uid);
      loadUserData(uid);
    };

    initAuth();

    // Theme Initializer
    const savedTheme = localStorage.getItem('zenith_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Click outside search and notification dropdowns
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (notificationContainerRef.current && !notificationContainerRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // --- 4. Load User Data (Tasks, Categories, Notifications) from Supabase ---
  const loadUserData = async (userId: string) => {
    try {
      const storedHistory = localStorage.getItem(`zenith_search_history_${userId}`);
      setSearchHistory(storedHistory ? JSON.parse(storedHistory) : []);

      await fetchCategories(userId);
      await fetchTasks(userId);
      await fetchNotifications(userId);

      setAppReady(true);
      requestNotificationPermissionSilent();
    } catch (err: any) {
      console.error('Error loading user data:', err.message);
      setAppReady(true);
    }
  };

  const fetchCategories = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/categories?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();

      if (data && data.length > 0) {
        setCategories(data);
      } else {
        const defaultCats = DEFAULT_CATEGORIES.map(c => ({
          user_id: userId,
          name: c.name,
          color: c.color
        }));

        const insertRes = await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(defaultCats)
        });

        if (insertRes.ok) {
          const inserted = await insertRes.json();
          setCategories(inserted);
        }
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err.message);
    }
  };

  const fetchTasks = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/tasks?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();

      if (data) {
        const mappedTasks: Task[] = data.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          dueDate: t.due_date,
          dueTime: t.due_time,
          priority: t.priority,
          category: t.category_name,
          status: t.status,
          reminderMinutesBefore: t.reminder_minutes_before,
          notified: t.notified,
          subtasks: (t.subtasks || []).map((s: any) => ({
            id: s.id,
            task_id: s.task_id,
            name: s.name,
            completed: s.completed,
            due_date: s.due_date || ''
          })).sort((a: any, b: any) => a.id.localeCompare(b.id))
        }));

        if (mappedTasks.length === 0 && !localStorage.getItem(`zenith_onboarded_${userId}`)) {
          await createOnboardingTasks(userId);
        } else {
          setTasks(mappedTasks);
        }
      }
    } catch (err: any) {
      showToast('Failed to fetch tasks: ' + err.message, 'error');
    }
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/notifications?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();

      if (data) {
        setNotifications(data.map((n: any) => ({
          id: n.id,
          text: n.text,
          time: Number(n.time),
          read: n.read,
          taskId: n.task_id
        })));
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err.message);
    }
  };

  const createOnboardingTasks = async (userId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const onboardingTasks = [
      {
        user_id: userId,
        title: 'Welcome to Zenith! 🚀',
        description: 'This is your productive workspace dashboard. Here, you can view your overall completion statistics, search tasks, and filter them by category or priority.',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '23:59',
        priority: 'high',
        category_name: 'Work',
        status: 'inprogress',
        reminder_minutes_before: 0,
        notified: false
      },
      {
        user_id: userId,
        title: 'Explore custom categories 🎨',
        description: 'Organize your tasks efficiently. You can create custom categories with tailored colors using the "+" sign next to Categories in the sidebar.',
        due_date: tomorrowStr,
        due_time: '09:00',
        priority: 'medium',
        category_name: 'Personal',
        status: 'pending',
        reminder_minutes_before: 30,
        notified: false
      },
      {
        user_id: userId,
        title: 'Check out reminders and alerts ⏰',
        description: 'Zenith will alert you before tasks are due. Click the bell icon in the top right to view notification logs, and toggle browser push alerts.',
        due_date: tomorrowStr,
        due_time: '18:00',
        priority: 'low',
        category_name: 'Health',
        status: 'pending',
        reminder_minutes_before: 10,
        notified: false
      }
    ];

    try {
      const taskRes = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardingTasks)
      });

      if (!taskRes.ok) throw new Error('Failed to create onboarding tasks');
      const insertedTasks = await taskRes.json();

      if (insertedTasks) {
        const welcomeTask = insertedTasks.find((t: any) => t.title.startsWith('Welcome'));
        if (welcomeTask) {
          const onboardingSubtasks = [
            {
              task_id: welcomeTask.id,
              name: 'Mark this subtask as completed by clicking the checkbox',
              completed: true
            },
            {
              task_id: welcomeTask.id,
              name: 'Open the task detail view by clicking anywhere on this card',
              completed: false
            },
            {
              task_id: welcomeTask.id,
              name: 'Create a brand new task of your own using the "Add Task" button',
              completed: false
            }
          ];
          
          await apiFetch('/api/subtasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(onboardingSubtasks)
          });
        }
      }

      localStorage.setItem(`zenith_onboarded_${userId}`, 'true');
      await fetchTasks(userId);
    } catch (err: any) {
      console.error('Error creating onboarding tasks:', err.message);
    }
  };

  // --- 5. Background Alert Loop Daemon ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTasks(prevTasks => {
        const updatedTasks = [...prevTasks];
        let changed = false;

        updatedTasks.forEach(task => {
          if (task.status === 'completed' || task.notified) return;

          const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
          const offsetMs = task.reminderMinutesBefore * 60 * 1000;
          const alertTime = new Date(dueDateTime.getTime() - offsetMs);
          const maxSpamWindowMs = 3 * 60 * 60 * 1000;

          if (now >= alertTime && now.getTime() < dueDateTime.getTime() + maxSpamWindowMs) {
            task.notified = true;
            changed = true;
            fireReminderAlert(task);
          }
        });

        if (changed) {
          updatedTasks.forEach(async task => {
            if (task.notified) {
              await apiFetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: task.id, notified: true })
              });
            }
          });
          return updatedTasks;
        }
        return prevTasks;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fireReminderAlert = async (task: Task) => {
    const notificationTitle = `Zenith Reminder: ${task.title}`;
    const notificationOptions = {
      body: `Task is due at ${formatTimeString(task.dueTime)} (${task.category})`,
      requireInteraction: true
    };

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(notificationTitle, notificationOptions);
        n.onclick = () => {
          window.focus();
          handleOpenTaskDetails(task.id);
          n.close();
        };
      } catch (err) {
        console.warn("Push notifications not supported in this environment context", err);
      }
    }

    const timeVal = Date.now();
    try {
      const res = await apiFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          task_id: task.id,
          text: `Reminder: "${task.title}" is due soon (${formatTimeString(task.dueTime)})`,
          time: timeVal,
          read: false
        })
      });

      if (!res.ok) throw new Error('Failed to create reminder alert');
      const inserted = await res.json();

      if (inserted && inserted[0]) {
        setNotifications(prev => [
          {
            id: inserted[0].id,
            text: inserted[0].text,
            time: Number(inserted[0].time),
            read: inserted[0].read,
            taskId: inserted[0].task_id
          },
          ...prev
        ]);
      }
    } catch (err: any) {
      console.error('Error logging notification to DB:', err.message);
    }

    showToast(`Reminder: "${task.title}" is due soon!`, 'warning');
  };

  const requestNotificationPermissionSilent = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  // --- 6. User Authentication Triggers ---
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('zenith_theme', newTheme);
  };

  // --- 7. Task Form Modal Actions ---
  const handleOpenAddTask = () => {
    setTaskModalMode('add');
    setTaskTitle('');
    setTaskDesc('');
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    now.setHours(now.getHours() + 1);
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    setTaskDueDate(dateStr);
    setTaskDueTime(timeStr);
    
    setTaskPriority('medium');
    setTaskCategory(categories[0]?.name || 'Work');
    setTaskReminder('0');
    setTaskCustomReminder(15);
    
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setTaskModalMode('edit');
    setActiveTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDesc(task.description);
    setTaskDueDate(task.dueDate);
    setTaskDueTime(task.dueTime);
    setTaskPriority(task.priority);
    setTaskCategory(task.category);
    
    const standardOffsets = ['0', '10', '30', '60', '1440'];
    if (standardOffsets.includes(String(task.reminderMinutesBefore))) {
      setTaskReminder(String(task.reminderMinutesBefore));
    } else {
      setTaskReminder('custom');
      setTaskCustomReminder(task.reminderMinutesBefore);
    }
    
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate || !taskDueTime) {
      showToast('Please fill in required fields', 'warning');
      return;
    }

    let reminderMinutes = parseInt(taskReminder);
    if (taskReminder === 'custom') {
      reminderMinutes = taskCustomReminder || 0;
    }

    try {
      if (taskModalMode === 'add') {
        await apiAddTask(
          taskTitle.trim(),
          taskDesc.trim(),
          taskDueDate,
          taskDueTime,
          taskPriority,
          taskCategory
        );
        showToast('Task added to Zenith!', 'success');
      } else {
        if (!activeTaskId) return;
        
        const currentTask = tasks.find(t => t.id === activeTaskId);
        const isDateChanged = currentTask 
          ? (currentTask.dueDate !== taskDueDate || currentTask.dueTime !== taskDueTime || currentTask.reminderMinutesBefore !== reminderMinutes)
          : false;

        const updateRes = await apiFetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeTaskId,
            title: taskTitle.trim(),
            description: taskDesc.trim(),
            due_date: taskDueDate,
            due_time: taskDueTime,
            priority: taskPriority,
            category_name: taskCategory,
            reminder_minutes_before: reminderMinutes,
            notified: isDateChanged ? false : (currentTask?.notified || false)
          })
        });

        if (!updateRes.ok) {
          const err = await updateRes.json();
          throw new Error(err.error || 'Failed to update task');
        }

        setTasks(prev => prev.map(t => {
          if (t.id === activeTaskId) {
            return {
              ...t,
              title: taskTitle.trim(),
              description: taskDesc.trim(),
              dueDate: taskDueDate,
              dueTime: taskDueTime,
              priority: taskPriority,
              category: taskCategory,
              reminderMinutesBefore: reminderMinutes,
              notified: isDateChanged ? false : t.notified
            };
          }
          return t;
        }));
        showToast('Task updated successfully!', 'success');
      }
      setIsTaskModalOpen(false);
    } catch (err: any) {
      showToast('Failed to save task: ' + err.message, 'error');
    }
  };

  // --- 8. UI Handlers mapped to unified API actions ---
  const handleToggleTaskStatus = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiToggleTaskStatus(taskId);
    } catch (err: any) {
      showToast('Failed to update status: ' + err.message, 'error');
    }
  };

  const handleOpenDeleteConfirm = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsDetailModalOpen(false);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!activeTaskId) return;
    try {
      await apiDeleteTask(activeTaskId);
      showToast('Task permanently deleted.', 'info');
      setIsDeleteModalOpen(false);
      setActiveTaskId(null);
    } catch (err: any) {
      showToast('Failed to delete task: ' + err.message, 'error');
    }
  };

  const handleOpenPostpone = (taskId: string) => {
    setActiveTaskId(taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setPostponeDate(task.dueDate);
      setPostponeTime(task.dueTime);
    }
    setIsDetailModalOpen(false);
    setIsPostponeModalOpen(true);
  };

  const handlePostponeQuick = async (hours: number, days: number) => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    const originalDue = new Date(`${task.dueDate}T${task.dueTime}`);
    const baseDate = originalDue.getTime() > Date.now() ? originalDue : new Date();

    if (hours > 0) baseDate.setHours(baseDate.getHours() + hours);
    if (days > 0) baseDate.setDate(baseDate.getDate() + days);

    const newDateStr = baseDate.toISOString().split('T')[0];
    const newTimeStr = baseDate.toTimeString().split(' ')[0].substring(0, 5);

    try {
      await apiPostponeTask(activeTaskId, newDateStr, newTimeStr);
      showToast('Task postponed successfully!', 'success');
      setIsPostponeModalOpen(false);
      setActiveTaskId(null);
    } catch (err: any) {
      showToast('Failed to postpone task: ' + err.message, 'error');
    }
  };

  const handlePostponeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskId || !postponeDate || !postponeTime) return;

    try {
      await apiPostponeTask(activeTaskId, postponeDate, postponeTime);
      showToast('Rescheduled task deadline.', 'success');
      setIsPostponeModalOpen(false);
      setActiveTaskId(null);
    } catch (err: any) {
      showToast('Failed to reschedule task: ' + err.message, 'error');
    }
  };

  // --- 9. Subtasks & Detail Modal Handlers ---
  const handleOpenTaskDetails = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsDetailModalOpen(true);
  };

  const handleSubtaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskId || !subtaskName.trim()) return;

    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    try {
      const res = await apiFetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: activeTaskId,
          name: subtaskName.trim(),
          completed: false,
          due_date: subtaskDueDate || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add subtask');
      }

      const data = await res.json();

      if (data && data[0]) {
        const newSub: Subtask = {
          id: data[0].id,
          task_id: data[0].task_id,
          name: data[0].name,
          completed: data[0].completed,
          due_date: data[0].due_date || ''
        };

        setTasks(prev => prev.map(t => {
          if (t.id === activeTaskId) {
            const originalStatus = t.status;
            const statusVal = originalStatus === 'completed' ? 'inprogress' : originalStatus;
            if (originalStatus === 'completed') {
              apiFetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: activeTaskId, status: 'inprogress' })
              });
            }
            return {
              ...t,
              status: statusVal,
              subtasks: [...t.subtasks, newSub].sort((a, b) => a.id.localeCompare(b.id))
            };
          }
          return t;
        }));

        setSubtaskName('');
        setSubtaskDueDate('');
      }
    } catch (err: any) {
      showToast('Failed to add subtask: ' + err.message, 'error');
    }
  };

  const handleToggleSubtask = async (subId: string) => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    const sub = task.subtasks.find(s => s.id === subId);
    if (!sub) return;

    const newCompleted = !sub.completed;

    try {
      const res = await apiFetch('/api/subtasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subId, completed: newCompleted })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update subtask');
      }

      const nextSubtasks = task.subtasks.map(s => {
        if (s.id === subId) return { ...s, completed: newCompleted };
        return s;
      });

      const allCompleted = nextSubtasks.every(s => s.completed);
      let updatedStatus = task.status;
      if (allCompleted) {
        updatedStatus = 'completed';
        await apiFetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: activeTaskId, status: 'completed' })
        });
      } else if (task.status === 'completed') {
        updatedStatus = 'inprogress';
        await apiFetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: activeTaskId, status: 'inprogress' })
        });
      }

      setTasks(prev => prev.map(t => {
        if (t.id === activeTaskId) {
          return {
            ...t,
            status: updatedStatus,
            subtasks: nextSubtasks
          };
        }
        return t;
      }));
    } catch (err: any) {
      showToast('Failed to update subtask: ' + err.message, 'error');
    }
  };

  const handleDeleteSubtask = async (subId: string) => {
    if (!activeTaskId) return;

    try {
      const res = await apiFetch(`/api/subtasks?id=${subId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete subtask');
      }

      setTasks(prev => prev.map(t => {
        if (t.id === activeTaskId) {
          return {
            ...t,
            subtasks: t.subtasks.filter(s => s.id !== subId)
          };
        }
        return t;
      }));
    } catch (err: any) {
      showToast('Failed to delete subtask: ' + err.message, 'error');
    }
  };

  const handleDetailStatusChange = async (newStatus: 'pending' | 'inprogress' | 'completed') => {
    if (!activeTaskId) return;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    try {
      const res = await apiFetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeTaskId, status: newStatus })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }

      let nextSubtasks = [...task.subtasks];
      if (newStatus === 'completed') {
        const subtaskRes = await apiFetch('/api/subtasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: activeTaskId, completed: true })
        });
        if (subtaskRes.ok) {
          nextSubtasks = nextSubtasks.map(s => ({ ...s, completed: true }));
        }
      }

      setTasks(prev => prev.map(t => {
        if (t.id === activeTaskId) {
          return {
            ...t,
            status: newStatus,
            subtasks: nextSubtasks
          };
        }
        return t;
      }));
    } catch (err: any) {
      showToast('Failed to update status: ' + err.message, 'error');
    }
  };

  // --- 10. Custom Category Modal ---
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const nameVal = newCategoryName.trim();

    const exists = categories.some(c => c.name.toLowerCase() === nameVal.toLowerCase());
    if (exists) {
      showToast('Category name already exists.', 'warning');
      return;
    }

    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          name: nameVal,
          color: newCategoryColor
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add category');
      }

      const data = await res.json();

      if (data && data[0]) {
        setCategories(prev => [...prev, data[0]]);
        showToast(`Category "${nameVal}" created!`, 'success');
        setNewCategoryName('');
        setIsCategoryModalOpen(false);
      }
    } catch (err: any) {
      showToast('Failed to add category: ' + err.message, 'error');
    }
  };

  // --- 11. Search History & Suggestions ---
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setActiveSuggestionIndex(-1);
  };

  const handleSuggestionClick = (taskId: string) => {
    addSearchToHistory(searchQuery);
    setIsSearchFocused(false);
    handleOpenTaskDetails(taskId);
  };

  const handleHistoryItemClick = (query: string) => {
    setSearchQuery(query);
    addSearchToHistory(query);
    setIsSearchFocused(false);
  };

  const addSearchToHistory = (query: string) => {
    const cleaned = query.trim();
    if (!cleaned) return;

    const nextHistory = searchHistory.filter(q => q.toLowerCase() !== cleaned.toLowerCase());
    nextHistory.unshift(cleaned);
    const cropped = nextHistory.slice(0, 5);

    setSearchHistory(cropped);
    localStorage.setItem(`zenith_search_history_${userId}`, JSON.stringify(cropped));
  };

  const handleDeleteHistoryItem = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const nextHistory = [...searchHistory];
    nextHistory.splice(index, 1);
    setSearchHistory(nextHistory);
    localStorage.setItem(`zenith_search_history_${userId}`, JSON.stringify(nextHistory));
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem(`zenith_search_history_${userId}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    const filteredSuggestions = getFilteredSearchSuggestions();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchFocused) {
        setIsSearchFocused(true);
      } else if (filteredSuggestions.length > 0) {
        setActiveSuggestionIndex(prev => (prev + 1) % Math.min(filteredSuggestions.length, 5));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isSearchFocused && filteredSuggestions.length > 0) {
        setActiveSuggestionIndex(prev => (prev - 1 + Math.min(filteredSuggestions.length, 5)) % Math.min(filteredSuggestions.length, 5));
      }
    } else if (e.key === 'Enter') {
      if (isSearchFocused && activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
        e.preventDefault();
        handleSuggestionClick(filteredSuggestions[activeSuggestionIndex].id);
      } else {
        addSearchToHistory(searchQuery);
        setIsSearchFocused(false);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const getFilteredSearchSuggestions = () => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    const keywords = query.split(/\s+/).filter(k => k.length > 0);
    return tasks.filter(task => {
      return keywords.every(kw => {
        const titleMatch = task.title.toLowerCase().includes(kw);
        const descMatch = task.description.toLowerCase().includes(kw);
        const catMatch = task.category.toLowerCase().includes(kw);
        const priorityMatch = task.priority.toLowerCase().includes(kw);
        const statusMatch = task.status.toLowerCase().includes(kw);
        const dateMatch = formatDateString(task.dueDate).toLowerCase().includes(kw);
        return titleMatch || descMatch || catMatch || priorityMatch || statusMatch || dateMatch;
      });
    });
  };

  const highlightMatches = (text: string, query: string) => {
    if (!text) return '';
    const escaped = escapeHTML(text);
    const cleaned = query.toLowerCase().trim();
    if (!cleaned) return escaped;

    const keywords = cleaned.split(/\s+/).filter(k => k.length > 0).sort((a, b) => b.length - a.length);
    if (keywords.length === 0) return escaped;

    const escapedKws = keywords.map(kw => kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKws.join('|')})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  const escapeHTML = (str: string) => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // --- 12. Notification Bell clicks ---
  const handleBellClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsNotificationOpen(prev => !prev);
    
    if (!isNotificationOpen && notifications.some(n => !n.read)) {
      apiFetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, read: true })
      }).then((res) => {
        if (res.ok) {
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
      });
    }
  };

  const handleClearNotifications = async () => {
    const res = await apiFetch(`/api/notifications?userId=${userId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      showToast('Failed to clear notifications', 'error');
    } else {
      setNotifications([]);
    }
  };

  // --- 13. Filters and Sorting ---
  const getFilteredTasks = () => {
    let list = [...tasks];

    const todayStrVal = new Date().toISOString().split('T')[0];
    if (currentFilter === 'today') {
      list = list.filter(t => t.dueDate === todayStrVal);
    } else if (currentFilter === 'upcoming') {
      list = list.filter(t => t.dueDate > todayStrVal);
    } else if (currentFilter === 'pending') {
      list = list.filter(t => t.status !== 'completed');
    } else if (currentFilter === 'completed') {
      list = list.filter(t => t.status === 'completed');
    } else if (currentFilter.startsWith('cat-')) {
      const catName = currentFilter.replace('cat-', '');
      list = list.filter(t => t.category === catName);
    }

    if (filterPriority !== 'all') {
      list = list.filter(t => t.priority === filterPriority);
    }

    if (filterCategory !== 'all') {
      list = list.filter(t => t.category === filterCategory);
    }

    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const keywords = query.split(/\s+/).filter(k => k.length > 0);
      list = list.filter(task => {
        return keywords.every(kw => {
          const titleMatch = task.title.toLowerCase().includes(kw);
          const descMatch = task.description.toLowerCase().includes(kw);
          const catMatch = task.category.toLowerCase().includes(kw);
          const priorityMatch = task.priority.toLowerCase().includes(kw);
          const statusMatch = task.status.toLowerCase().includes(kw);
          const dateMatch = formatDateString(task.dueDate).toLowerCase().includes(kw);
          return titleMatch || descMatch || catMatch || priorityMatch || statusMatch || dateMatch;
        });
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'priority-desc') {
        const pMap = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      } else if (sortBy === 'duedate-asc') {
        return new Date(`${a.dueDate}T${a.dueTime}`).getTime() - new Date(`${b.dueDate}T${b.dueTime}`).getTime();
      } else if (sortBy === 'duedate-desc') {
        return new Date(`${b.dueDate}T${b.dueTime}`).getTime() - new Date(`${a.dueDate}T${a.dueTime}`).getTime();
      } else if (sortBy === 'alphabetical-asc') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'status-asc') {
        const sMap = { pending: 1, inprogress: 2, completed: 3 };
        return sMap[a.status] - sMap[b.status];
      }
      return 0;
    });

    return list;
  };

  // --- 14. UI Helpers & Formatters ---
  const totalCount = tasks.length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const todayStrVal = new Date().toISOString().split('T')[0];
  const dueTodayCount = tasks.filter(t => t.dueDate === todayStrVal && t.status !== 'completed').length;
  const inProgressCount = tasks.filter(t => t.status === 'inprogress').length;
  const highPriorityCount = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

  const countAll = totalCount;
  const countToday = tasks.filter(t => t.dueDate === todayStrVal).length;
  const countUpcoming = tasks.filter(t => t.dueDate > todayStrVal).length;
  const countPending = tasks.filter(t => t.status !== 'completed').length;
  const countCompleted = completedCount;

  const progressRingRadius = 32;
  const progressRingCircumference = 2 * Math.PI * progressRingRadius;
  const progressRingOffset = progressRingCircumference - (completionPercentage / 100) * progressRingCircumference;

  const selectedTask = tasks.find(t => t.id === activeTaskId);

  const isTaskOverdue = (dueDateStr: string, dueTimeStr: string) => {
    const deadline = new Date(`${dueDateStr}T${dueTimeStr}`);
    return deadline < new Date();
  };

  function formatDateString(dateStr: string) {
    if (!dateStr) return '';
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

  function formatTimeString(timeStr: string) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  function formatTimeAgo(timestamp: number) {
    const diffMs = Date.now() - timestamp;
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHrs = Math.round(diffMins / 60);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  if (!appReady) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ fontFamily: 'var(--font-sans)', fontWeight: '600' }}>Initializing Zenith Dashboard...</p>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />
        </div>
        <ChatWindow 
          isOpen={chat.isOpen}
          setIsOpen={chat.setIsOpen}
          messages={chat.messages}
          isTyping={chat.isTyping}
          onSendMessage={chat.handleSendMessage}
          onClearHistory={chat.clearChatHistory}
        />
      </>
    );
  }

    const filteredTaskList = getFilteredTasks();
  const searchSuggestions = getFilteredSearchSuggestions();

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>&times;</button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <svg className="logo-icon"><use href="#icon-check" /></svg>
            <span className="logo-text">Zenith</span>
          </div>
          <button className="btn-icon mobile-only" onClick={() => setIsSidebarOpen(false)}>
            <svg className="icon"><use href="#icon-close" /></svg>
          </button>
        </div>


        <nav className="sidebar-nav">
          <div className="nav-section-title">Filters</div>
          <ul className="nav-list">
            <li>
              <button className={`nav-item ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => { setCurrentFilter('all'); setIsSidebarOpen(false); }}>
                <svg className="icon"><use href="#icon-list" /></svg>
                <span>All Tasks</span>
                <span className="badge">{countAll}</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${currentFilter === 'today' ? 'active' : ''}`} onClick={() => { setCurrentFilter('today'); setIsSidebarOpen(false); }}>
                <svg className="icon"><use href="#icon-calendar" /></svg>
                <span>Today</span>
                <span className="badge">{countToday}</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${currentFilter === 'upcoming' ? 'active' : ''}`} onClick={() => { setCurrentFilter('upcoming'); setIsSidebarOpen(false); }}>
                <svg className="icon"><use href="#icon-clock" /></svg>
                <span>Upcoming</span>
                <span className="badge">{countUpcoming}</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${currentFilter === 'pending' ? 'active' : ''}`} onClick={() => { setCurrentFilter('pending'); setIsSidebarOpen(false); }}>
                <svg className="icon"><use href="#icon-flag" /></svg>
                <span>Pending</span>
                <span className="badge">{countPending}</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${currentFilter === 'completed' ? 'active' : ''}`} onClick={() => { setCurrentFilter('completed'); setIsSidebarOpen(false); }}>
                <svg className="icon"><use href="#icon-check" /></svg>
                <span>Completed</span>
                <span className="badge">{countCompleted}</span>
              </button>
            </li>
          </ul>

          <div className="nav-section-title-row">
            <span className="nav-section-title">Categories</span>
            <button className="btn-icon-small" title="Add Category" onClick={() => setIsCategoryModalOpen(true)}>
              <svg className="icon-small"><use href="#icon-plus" /></svg>
            </button>
          </div>
          <ul className="nav-list">
            {categories.map(cat => {
              const catCount = tasks.filter(t => t.category === cat.name).length;
              const filterId = `cat-${cat.name}`;
              return (
                <li key={cat.name}>
                  <button className={`nav-item ${currentFilter === filterId ? 'active' : ''}`} onClick={() => { setCurrentFilter(filterId); setIsSidebarOpen(false); }}>
                    <span className="nav-item-dot" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                    <span className="badge">{catCount}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-theme-toggle" onClick={toggleTheme}>
            <svg className={`icon theme-icon-light ${theme === 'dark' ? 'hidden' : ''}`}><use href="#icon-sun" /></svg>
            <svg className={`icon theme-icon-dark ${theme === 'light' ? 'hidden' : ''}`}><use href="#icon-moon" /></svg>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <button className="btn-icon mobile-only" aria-label="Toggle Navigation" onClick={() => setIsSidebarOpen(true)}>
              <svg className="icon"><use href="#icon-menu" /></svg>
            </button>
            <h1 className="header-title">
              {currentFilter.startsWith('cat-') ? `${currentFilter.replace('cat-', '')} Tasks` : (
                currentFilter === 'all' ? 'All Tasks' : (
                  currentFilter === 'today' ? 'Due Today' : (
                    currentFilter === 'upcoming' ? 'Upcoming Tasks' : (
                      currentFilter === 'pending' ? 'Pending Tasks' : 'Completed Tasks'
                    )
                  )
                )
              )}
            </h1>
          </div>

          <div className="header-right">
            <div className="search-box" ref={searchContainerRef}>
              <svg className="search-icon"><use href="#icon-search" /></svg>
              <input 
                type="text" 
                placeholder="Search tasks, descriptions..." 
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
              />
              
              {isSearchFocused && (
                <div className="search-dropdown-panel">
                  {!searchQuery ? (
                    searchHistory.length > 0 ? (
                      <div className="search-dropdown-section">
                        <div className="search-dropdown-title">
                          <span>Recent Searches</span>
                          <button className="btn-text" onClick={handleClearHistory}>Clear All</button>
                        </div>
                        <ul className="search-dropdown-list">
                          {searchHistory.map((q, idx) => (
                            <li key={idx} className={`history-item ${activeSuggestionIndex === idx ? 'active' : ''}`} onClick={() => handleHistoryItemClick(q)}>
                              <span className="history-item-text">
                                <svg className="icon-small" style={{ color: 'var(--text-muted)' }}><use href="#icon-clock" /></svg>
                                <span>{q}</span>
                              </span>
                              <button className="history-item-delete" aria-label="Delete history item" onClick={(e) => handleDeleteHistoryItem(e, idx)}>
                                <svg className="icon-small"><use href="#icon-close" /></svg>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  ) : (
                    <div className="search-dropdown-section">
                      <div className="search-dropdown-title">Suggestions</div>
                      {searchSuggestions.length > 0 ? (
                        <ul className="search-dropdown-list">
                          {searchSuggestions.slice(0, 5).map((task, idx) => {
                            const catObj = categories.find(c => c.name === task.category) || { color: '#64748b' };
                            return (
                              <li 
                                key={task.id} 
                                className={`search-dropdown-item ${activeSuggestionIndex === idx ? 'active' : ''}`}
                                onClick={() => handleSuggestionClick(task.id)}
                              >
                                <div className="suggestion-title" dangerouslySetInnerHTML={{ __html: highlightMatches(task.title, searchQuery) }} />
                                <div className="suggestion-details">
                                  <span className="category-badge" style={{ backgroundColor: `${catObj.color}15`, color: catObj.color, padding: '1px 6px', fontSize: '0.7rem' }}>
                                    {task.category}
                                  </span>
                                  <span className={`priority-badge p-${task.priority}`} style={{ padding: '1px 6px', fontSize: '0.7rem' }}>
                                    {task.priority}
                                  </span>
                                  <span>Due: {formatDateString(task.dueDate)}</span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '8px' }}>No matching tasks found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="notification-center" ref={notificationContainerRef}>
              <button className="btn-icon relative" title="Notifications" onClick={handleBellClick}>
                <svg className="icon"><use href="#icon-bell" /></svg>
                {notifications.some(n => !n.read) && (
                  <span className="notification-badge" />
                )}
              </button>
              
              {isNotificationOpen && (
                <div className="notification-dropdown">
                  <div className="notification-dropdown-header">
                    <h3>Notifications</h3>
                    <button className="btn-text" onClick={handleClearNotifications}>Clear All</button>
                  </div>
                  <ul className="notification-list">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <li 
                          key={notif.id} 
                          className={`notification-item ${!notif.read ? 'unread' : ''}`}
                          onClick={() => {
                            setIsNotificationOpen(false);
                            if (notif.taskId) handleOpenTaskDetails(notif.taskId);
                          }}
                        >
                          <div className="notification-item-text">{notif.text}</div>
                          <div className="notification-item-time">{formatTimeAgo(notif.time)}</div>
                        </li>
                      ))
                    ) : (
                      <li className="empty-notifications">No new notifications</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card progress-card">
            <div className="stat-card-content">
              <h3 className="stat-title">Overall Progress</h3>
              <div className="stat-value">{completionPercentage}%</div>
              <p className="stat-subtitle">{completedCount} of {totalCount} tasks completed</p>
            </div>
            <div className="stat-progress-ring">
              <svg className="progress-ring" width="80" height="80">
                <circle className="progress-ring-bg" stroke="var(--border-color)" strokeWidth="8" fill="transparent" r={progressRingRadius} cx="40" cy="40"/>
                <circle 
                  className="progress-ring-circle" 
                  stroke="var(--primary)" 
                  strokeWidth="8" 
                  fill="transparent" 
                  r={progressRingRadius} 
                  cx="40" 
                  cy="40" 
                  strokeDasharray={progressRingCircumference} 
                  strokeDashoffset={progressRingOffset}
                />
              </svg>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper p-blue">
              <svg className="icon"><use href="#icon-calendar" /></svg>
            </div>
            <div className="stat-info">
              <div className="stat-value">{dueTodayCount}</div>
              <h3 className="stat-title">Due Today</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper p-orange">
              <svg className="icon"><use href="#icon-clock" /></svg>
            </div>
            <div className="stat-info">
              <div className="stat-value">{inProgressCount}</div>
              <h3 className="stat-title">In Progress</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper p-red">
              <svg className="icon"><use href="#icon-flag" /></svg>
            </div>
            <div className="stat-info">
              <div className="stat-value">{highPriorityCount}</div>
              <h3 className="stat-title">High Priority</h3>
            </div>
          </div>
        </section>

        <section className="controls-bar">
          <div className="filter-group">
            <select className="control-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>

            <select className="control-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select className="control-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="priority-desc">Priority: High to Low</option>
              <option value="duedate-asc">Due Date: Nearest First</option>
              <option value="duedate-desc">Due Date: Furthest First</option>
              <option value="alphabetical-asc">Title: A to Z</option>
              <option value="status-asc">Status: Pending First</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={handleOpenAddTask}>
            <svg className="icon-small"><use href="#icon-plus" /></svg>
            <span>Add Task</span>
          </button>
        </section>

        <section className="task-list-section">
          {filteredTaskList.length > 0 ? (
            <div className="tasks-container">
              {filteredTaskList.map(task => {
                const catObj = categories.find(c => c.name === task.category) || { color: '#64748b' };
                const pct = task.subtasks.length > 0 
                  ? Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100)
                  : 0;

                const isOverdueCheck = isTaskOverdue(task.dueDate, task.dueTime) && task.status !== 'completed';

                return (
                  <div 
                    key={task.id} 
                    className={`task-card ${task.status === 'completed' ? 'task-completed' : ''}`}
                    style={{ borderLeft: `5px solid ${catObj.color}` }}
                    onClick={() => handleOpenTaskDetails(task.id)}
                  >
                    <div className="task-card-header">
                      <div className="task-card-title-row">
                        <div 
                          className={`checkbox-custom ${task.status === 'completed' ? 'checked' : ''}`}
                          title="Toggle Completion Status"
                          onClick={(e) => handleToggleTaskStatus(task.id, e)}
                        >
                          <svg className="checkbox-icon"><use href="#icon-check" /></svg>
                        </div>
                        <span 
                          className="task-title-text" 
                          dangerouslySetInnerHTML={{ __html: highlightMatches(task.title, searchQuery) }}
                        />
                      </div>
                    </div>

                    <p 
                      className="task-card-desc" 
                      dangerouslySetInnerHTML={{ __html: highlightMatches(task.description || 'No description added.', searchQuery) }}
                    />

                    {task.subtasks.length > 0 && (
                      <div className="task-card-progress">
                        <div className="task-card-progress-header">
                          <span>Subtasks Progress</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: task.status === 'completed' ? 'var(--success)' : 'var(--primary)' }} />
                        </div>
                      </div>
                    )}

                    <div className="task-card-footer">
                      <div className={`task-card-due ${isOverdueCheck ? 'overdue' : ''}`}>
                        <svg className="icon-small"><use href="#icon-calendar" /></svg>
                        <span>{isOverdueCheck ? 'Overdue: ' : 'Due: '}{formatDateString(task.dueDate)}</span>
                      </div>
                      
                      <div className="task-card-badge-row">
                        <span className="category-badge" style={{ backgroundColor: `${catObj.color}15`, color: catObj.color }}>
                          {task.category}
                        </span>
                        <span className={`priority-badge p-${task.priority}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-illustration">
                <svg className="empty-icon"><use href="#icon-check" /></svg>
              </div>
              <h2 className="empty-state-title">{searchQuery ? 'No matching tasks found' : 'No tasks found'}</h2>
              <p className="empty-state-description">
                {searchQuery ? 'Try adjusting your search query keyword.' : 'Try adjusting your filters, or create a brand new task to get started.'}
              </p>
              {!searchQuery && (
                <button className="btn btn-secondary" onClick={handleOpenAddTask}>Create a Task</button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* --- FLOATING AI ASSISTANT WINDOW --- */}
      <ChatWindow 
        isOpen={chat.isOpen}
        setIsOpen={chat.setIsOpen}
        messages={chat.messages}
        isTyping={chat.isTyping}
        onSendMessage={chat.handleSendMessage}
        onClearHistory={chat.clearChatHistory}
      />

      {/* --- ADD / EDIT TASK MODAL --- */}
      {isTaskModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{taskModalMode === 'add' ? 'Create New Task' : 'Edit Task'}</h2>
              <button className="btn-icon" aria-label="Close Modal" onClick={() => setIsTaskModalOpen(false)}>
                <svg className="icon"><use href="#icon-close" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group">
                <label htmlFor="task-title">Title <span className="required">*</span></label>
                <input 
                  type="text" 
                  id="task-title" 
                  placeholder="What needs to be done?" 
                  required 
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="task-desc">Description</label>
                <textarea 
                  id="task-desc" 
                  rows={3} 
                  placeholder="Add more details about this task..." 
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="task-due-date">Due Date</label>
                  <input 
                    type="date" 
                    id="task-due-date" 
                    required 
                    value={taskDueDate}
                    onChange={e => setTaskDueDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="task-due-time">Due Time</label>
                  <input 
                    type="time" 
                    id="task-due-time" 
                    required 
                    value={taskDueTime}
                    onChange={e => setTaskDueTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="task-priority">Priority</label>
                  <select id="task-priority" value={taskPriority} onChange={e => setTaskPriority(e.target.value as any)}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="task-category">Category</label>
                  <select id="task-category" value={taskCategory} onChange={e => setTaskCategory(e.target.value)}>
                    {categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="task-reminder">Reminder Notification</label>
                  <select id="task-reminder" value={taskReminder} onChange={e => setTaskReminder(e.target.value)}>
                    <option value="0">At Time of Due Date</option>
                    <option value="10">10 Minutes Before</option>
                    <option value="30">30 Minutes Before</option>
                    <option value="60">1 Hour Before</option>
                    <option value="1440">1 Day Before</option>
                    <option value="custom">Custom Timing</option>
                  </select>
                </div>
                {taskReminder === 'custom' && (
                  <div className="form-group">
                    <label htmlFor="task-reminder-custom">Minutes Before Due</label>
                    <input 
                      type="number" 
                      id="task-reminder-custom" 
                      min={1} 
                      value={taskCustomReminder}
                      onChange={e => setTaskCustomReminder(parseInt(e.target.value) || 0)}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsTaskModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TASK DETAIL & SUBTASK MODAL --- */}
      {isDetailModalOpen && selectedTask && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card detail-modal-card">
            <div className="modal-header">
              <div className="detail-header-meta">
                {(() => {
                  const catObj = categories.find(c => c.name === selectedTask.category) || { color: '#64748b' };
                  return (
                    <>
                      <span className="category-badge" style={{ backgroundColor: `${catObj.color}15`, color: catObj.color }}>
                        {selectedTask.category}
                      </span>
                      <span className={`priority-badge p-${selectedTask.priority}`}>
                        {selectedTask.priority}
                      </span>
                    </>
                  );
                })()}
              </div>
              <button className="btn-icon" aria-label="Close Modal" onClick={() => setIsDetailModalOpen(false)}>
                <svg className="icon"><use href="#icon-close" /></svg>
              </button>
            </div>

            <div className="detail-content">
              <h2 className="detail-title">{selectedTask.title}</h2>
              <div className="detail-schedule">
                <svg className="icon-small"><use href="#icon-calendar" /></svg>
                <span>Due: {formatDateString(selectedTask.dueDate)} at {formatTimeString(selectedTask.dueTime)}</span>
              </div>
              
              <p className="detail-desc">{selectedTask.description || 'No description provided.'}</p>

              <hr className="detail-divider" />

              <div className="subtasks-section">
                <div className="subtasks-header">
                  <h3>Subtasks</h3>
                  <span className="subtask-progress-text">
                    {(() => {
                      const total = selectedTask.subtasks.length;
                      const done = selectedTask.subtasks.filter(s => s.completed).length;
                      const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
                      return `${percentage}% Completed (${done}/${total})`;
                    })()}
                  </span>
                </div>

                <div className="subtasks-progress-bar-wrapper">
                  <div 
                    className="subtasks-progress-bar-fill" 
                    style={{ 
                      width: `${selectedTask.subtasks.length > 0 
                        ? (selectedTask.subtasks.filter(s => s.completed).length / selectedTask.subtasks.length) * 100 
                        : 0}%` 
                    }} 
                  />
                </div>

                <ul className="subtasks-list">
                  {selectedTask.subtasks.length > 0 ? (
                    selectedTask.subtasks.map(sub => (
                      <li key={sub.id} className={`subtask-item ${sub.completed ? 'subtask-completed' : ''}`}>
                        <div 
                          className={`subtask-checkbox ${sub.completed ? 'checked' : ''}`}
                          onClick={() => handleToggleSubtask(sub.id)}
                        >
                          <svg className="checkbox-icon"><use href="#icon-check" /></svg>
                        </div>
                        <span className="subtask-text-span">{sub.name}</span>
                        {sub.due_date && (
                          <span className={`subtask-due-span ${isTaskOverdue(sub.due_date, '23:59') && !sub.completed ? 'overdue' : ''}`}>
                            Due: {formatDateString(sub.due_date)}
                          </span>
                        )}
                        <button className="btn-icon-small btn-subtask-delete" title="Delete Subtask" onClick={() => handleDeleteSubtask(sub.id)}>
                          <svg className="icon-small"><use href="#icon-close" /></svg>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No subtasks created yet</li>
                  )}
                </ul>

                <form className="subtask-form" onSubmit={handleSubtaskSubmit}>
                  <input 
                    type="text" 
                    placeholder="Add a subtask..." 
                    required 
                    value={subtaskName}
                    onChange={e => setSubtaskName(e.target.value)}
                    autoComplete="off"
                  />
                  <input 
                    type="date" 
                    title="Optional subtask deadline"
                    value={subtaskDueDate}
                    onChange={e => setSubtaskDueDate(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only" title="Add Subtask">
                    <svg className="icon-small"><use href="#icon-plus" /></svg>
                  </button>
                </form>
              </div>
            </div>

            <div className="modal-footer detail-modal-footer">
              <div className="detail-footer-status">
                <label htmlFor="detail-status-select">Status:</label>
                <select 
                  id="detail-status-select" 
                  value={selectedTask.status} 
                  onChange={e => handleDetailStatusChange(e.target.value as any)}
                >
                  <option value="pending">Pending</option>
                  <option value="inprogress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              
              <div className="detail-footer-actions">
                <button className="btn btn-secondary" onClick={() => { setIsDetailModalOpen(false); handleOpenEditTask(selectedTask); }}>
                  <svg className="icon-small"><use href="#icon-edit" /></svg>
                  <span>Edit</span>
                </button>
                <button className="btn btn-secondary" onClick={() => handleOpenPostpone(selectedTask.id)}>
                  <svg className="icon-small"><use href="#icon-clock" /></svg>
                  <span>Postpone</span>
                </button>
                <button className="btn btn-danger" onClick={() => handleOpenDeleteConfirm(selectedTask.id)}>
                  <svg className="icon-small"><use href="#icon-trash" /></svg>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- POSTPONE QUICK MODAL --- */}
      {isPostponeModalOpen && selectedTask && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card postpone-modal-card">
            <div className="modal-header">
              <h2>Postpone Task</h2>
              <button className="btn-icon" aria-label="Close Modal" onClick={() => setIsPostponeModalOpen(false)}>
                <svg className="icon"><use href="#icon-close" /></svg>
              </button>
            </div>

            <div className="postpone-content">
              <p className="postpone-text">Choose a quick option or select custom deadline for <strong>"{selectedTask.title}"</strong>.</p>
              
              <div className="postpone-quick-grid">
                <button className="btn btn-outline btn-postpone-quick" onClick={() => handlePostponeQuick(1, 0)}>1 Hour Later</button>
                <button className="btn btn-outline btn-postpone-quick" onClick={() => handlePostponeQuick(0, 1)}>Tomorrow</button>
                <button className="btn btn-outline btn-postpone-quick" onClick={() => handlePostponeQuick(0, 3)}>3 Days Later</button>
                <button className="btn btn-outline btn-postpone-quick" onClick={() => handlePostponeQuick(0, 7)}>1 Week Later</button>
              </div>

              <form className="postpone-form" onSubmit={handlePostponeSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="postpone-due-date">New Due Date</label>
                    <input 
                      type="date" 
                      id="postpone-due-date" 
                      required 
                      value={postponeDate}
                      onChange={e => setPostponeDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="postpone-due-time">New Due Time</label>
                    <input 
                      type="time" 
                      id="postpone-due-time" 
                      required 
                      value={postponeTime}
                      onChange={e => setPostponeTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="modal-footer postpone-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsPostponeModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Reschedule</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {isDeleteModalOpen && selectedTask && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card delete-modal-card">
            <div className="delete-icon-wrapper">
              <svg className="delete-icon"><use href="#icon-trash" /></svg>
            </div>
            <h2>Delete Task?</h2>
            <p>Are you sure you want to permanently delete <strong>"{selectedTask.title}"</strong>? This action cannot be undone.</p>
            
            <div className="modal-footer delete-footer">
              <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteTask}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD CATEGORY MODAL --- */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card category-modal-card">
            <div className="modal-header">
              <h2>Add Custom Category</h2>
              <button className="btn-icon" aria-label="Close Modal" onClick={() => setIsCategoryModalOpen(false)}>
                <svg className="icon"><use href="#icon-close" /></svg>
              </button>
            </div>

            <form onSubmit={handleCategorySubmit}>
              <div className="form-group">
                <label htmlFor="new-category-name">Category Name <span className="required">*</span></label>
                <input 
                  type="text" 
                  id="new-category-name" 
                  placeholder="e.g. Health, Work, Study" 
                  required 
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              
              <div className="form-group">
                <label>Choose Color</label>
                <div className="color-picker-grid">
                  {['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'].map(color => (
                    <button 
                      key={color}
                      type="button" 
                      className={`color-btn ${newCategoryColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewCategoryColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
