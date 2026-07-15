/**
 * ==========================================================================
 * ZENITH TASK MANAGER - CORE LOGIC (app.js)
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// 1. Data Models and State Initialization
// --------------------------------------------------------------------------
const STATE = {
  tasks: [],             // Tasks array
  categories: [],        // Categories array
  notifications: [],     // In-app notifications
  currentFilter: 'all',  // 'all', 'today', 'upcoming', 'pending', 'completed' or category name
  currentCategoryColor: null, // Selected color for new category modal
  activeTaskId: null,    // Track task ID currently being viewed or modified
  searchHistory: [],     // Last 5 searches
  activeSuggestionIndex: -1 // Active keyboard item
};

// Default categories loaded for new users
const DEFAULT_CATEGORIES = [
  { name: 'Work', color: '#3b82f6' },
  { name: 'Personal', color: '#10b981' },
  { name: 'Shopping', color: '#f59e0b' },
  { name: 'Health', color: '#ef4444' }
];

// Load all data from localStorage
function loadUserData() {
  // Load tasks
  const storedTasks = localStorage.getItem('zenith_tasks');
  STATE.tasks = storedTasks ? JSON.parse(storedTasks) : [];
  
  // Load categories
  const storedCategories = localStorage.getItem('zenith_categories');
  STATE.categories = storedCategories ? JSON.parse(storedCategories) : [...DEFAULT_CATEGORIES];

  // Load notifications
  const storedNotifications = localStorage.getItem('zenith_notifications');
  STATE.notifications = storedNotifications ? JSON.parse(storedNotifications) : [];

  // Load search history
  const storedSearchHistory = localStorage.getItem('zenith_search_history');
  STATE.searchHistory = storedSearchHistory ? JSON.parse(storedSearchHistory) : [];

  // If no tasks exist, load onboarding tasks
  if (STATE.tasks.length === 0 && !localStorage.getItem('zenith_loaded_before')) {
    loadOnboardingTasks();
    localStorage.setItem('zenith_loaded_before', 'true');
  }
}

// Save active data to localStorage
function saveUserData() {
  localStorage.setItem('zenith_tasks', JSON.stringify(STATE.tasks));
  localStorage.setItem('zenith_categories', JSON.stringify(STATE.categories));
  localStorage.setItem('zenith_notifications', JSON.stringify(STATE.notifications));
  localStorage.setItem('zenith_search_history', JSON.stringify(STATE.searchHistory));
}

// Pre-populate onboarding tasks for a new user
function loadOnboardingTasks() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const onboardingTasks = [
    {
      id: 'onboard-1',
      title: 'Welcome to Zenith! 🚀',
      description: 'This is your productive workspace dashboard. Here, you can view your overall completion statistics, search tasks, and filter them by category or priority.',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '23:59',
      priority: 'high',
      category: 'Work',
      status: 'inprogress',
      reminderMinutesBefore: 0,
      notified: false,
      subtasks: [
        { id: 'sub-1', name: 'Mark this subtask as completed by clicking the checkbox', completed: true, dueDate: '' },
        { id: 'sub-2', name: 'Open the task detail view by clicking anywhere on this card', completed: false, dueDate: '' },
        { id: 'sub-3', name: 'Create a brand new task of your own using the "Add Task" button', completed: false, dueDate: '' }
      ]
    },
    {
      id: 'onboard-2',
      title: 'Explore custom categories 🎨',
      description: 'Organize your tasks efficiently. You can create custom categories with tailored colors using the "+" sign next to Categories in the sidebar.',
      dueDate: tomorrowStr,
      dueTime: '09:00',
      priority: 'medium',
      category: 'Personal',
      status: 'pending',
      reminderMinutesBefore: 30,
      notified: false,
      subtasks: []
    },
    {
      id: 'onboard-3',
      title: 'Check out reminders and alerts ⏰',
      description: 'Zenith will alert you before tasks are due. Click the bell icon in the top right to view notification logs, and toggle browser push alerts.',
      dueDate: tomorrowStr,
      dueTime: '18:00',
      priority: 'low',
      category: 'Health',
      status: 'pending',
      reminderMinutesBefore: 10,
      notified: false,
      subtasks: []
    }
  ];

  STATE.tasks = onboardingTasks;
  saveUserData();
}

// --------------------------------------------------------------------------
// 3. UI Layout and Theme Engine
// --------------------------------------------------------------------------
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');
const lightIcon = themeToggle.querySelector('.theme-icon-light');
const darkIcon = themeToggle.querySelector('.theme-icon-dark');

function initTheme() {
  const savedTheme = localStorage.getItem('zenith_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);
}

function updateThemeUI(theme) {
  if (theme === 'dark') {
    lightIcon.classList.add('hidden');
    darkIcon.classList.remove('hidden');
    themeText.textContent = 'Light Mode';
  } else {
    lightIcon.classList.remove('hidden');
    darkIcon.classList.add('hidden');
    themeText.textContent = 'Dark Mode';
  }
}

themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('zenith_theme', newTheme);
  updateThemeUI(newTheme);
});

// Mobile Sidebar toggle
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const appSidebar = document.getElementById('app-sidebar');

sidebarToggle.addEventListener('click', () => {
  appSidebar.classList.add('open');
});

sidebarClose.addEventListener('click', () => {
  appSidebar.classList.remove('open');
});

// --------------------------------------------------------------------------
// 4. Categories Controller
// --------------------------------------------------------------------------
const categoryList = document.getElementById('category-list');
const categoryModal = document.getElementById('category-modal');
const categoryForm = document.getElementById('category-form');
const btnAddCategory = document.getElementById('btn-add-category');
const btnCategoryCancel = document.getElementById('btn-category-cancel');
const categoryModalClose = document.getElementById('category-modal-close');
const categoryColorPicker = document.getElementById('category-color-picker');

// Populate categories list in the sidebar navigation
function renderCategories() {
  categoryList.innerHTML = '';
  STATE.categories.forEach(cat => {
    const li = document.createElement('li');
    
    // Count tasks belonging to this category
    const catTaskCount = STATE.tasks.filter(t => t.category === cat.name).length;

    li.innerHTML = `
      <button class="nav-item ${STATE.currentFilter === 'cat-' + cat.name ? 'active' : ''}" data-filter="cat-${cat.name}">
        <span class="nav-item-dot" style="background-color: ${cat.color};"></span>
        <span>${cat.name}</span>
        <span class="badge">${catTaskCount}</span>
      </button>
    `;
    categoryList.appendChild(li);
  });

  // Attach event listeners to newly rendered items
  categoryList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterVal = btn.getAttribute('data-filter');
      setSidebarFilter(filterVal);
      // On mobile, close sidebar after selecting filter
      appSidebar.classList.remove('open');
    });
  });
}

// Populate the task form category select dropdown
function populateCategoryDropdowns() {
  const taskCategorySelect = document.getElementById('task-category');
  taskCategorySelect.innerHTML = '';
  STATE.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    taskCategorySelect.appendChild(opt);
  });
}

// Toggle Category color selector
categoryColorPicker.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    categoryColorPicker.querySelector('.color-btn.active').classList.remove('active');
    btn.classList.add('active');
    STATE.currentCategoryColor = btn.getAttribute('data-color');
  });
});

// Category Modal interactions
btnAddCategory.addEventListener('click', () => {
  // Set default selected color
  STATE.currentCategoryColor = '#3b82f6';
  categoryColorPicker.querySelector('.color-btn.active').classList.remove('active');
  categoryColorPicker.querySelector('[data-color="#3b82f6"]').classList.add('active');
  
  categoryForm.reset();
  categoryModal.classList.remove('hidden');
  document.getElementById('new-category-name').focus();
});

function closeCategoryModal() {
  categoryModal.classList.add('hidden');
}
btnCategoryCancel.addEventListener('click', closeCategoryModal);
categoryModalClose.addEventListener('click', closeCategoryModal);

categoryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const catName = document.getElementById('new-category-name').value.trim();
  const catColor = STATE.currentCategoryColor;

  if (!catName) return;

  // Check uniqueness
  const exists = STATE.categories.some(c => c.name.toLowerCase() === catName.toLowerCase());
  if (exists) {
    showToast('Category name already exists.', 'warning');
    return;
  }

  // Save category
  STATE.categories.push({ name: catName, color: catColor });
  saveUserData();
  
  renderCategories();
  populateCategoryDropdowns();
  populateFiltersDropdown(); // Update category filter options in control bar
  closeCategoryModal();
  showToast(`Category "${catName}" created!`, 'success');
});

// --------------------------------------------------------------------------
// 5. Tasks Management System (CRUD)
// --------------------------------------------------------------------------
const tasksContainer = document.getElementById('tasks-container');
const emptyState = document.getElementById('empty-state');
const btnTriggerAddTask = document.getElementById('btn-trigger-add-task');
const btnEmptyStateAdd = document.getElementById('btn-empty-state-add');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const taskModalTitle = document.getElementById('task-modal-title');
const btnTaskCancel = document.getElementById('btn-task-cancel');
const taskModalClose = document.getElementById('task-modal-close');
const taskReminderSelect = document.getElementById('task-reminder');
const customReminderGroup = document.getElementById('custom-reminder-group');

// Filter & Sort Selectors in UI
const filterPrioritySelect = document.getElementById('filter-priority');
const filterCategorySelect = document.getElementById('filter-category');
const sortTasksSelect = document.getElementById('sort-tasks');
const taskSearchInput = document.getElementById('task-search-input');

// Set sidebar filter and highlight active item
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const filter = item.getAttribute('data-filter');
    setSidebarFilter(filter);
    // On mobile, close sidebar
    appSidebar.classList.remove('open');
  });
});

function setSidebarFilter(filter) {
  STATE.currentFilter = filter;
  
  // Update sidebar active highlights
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Highlight matching category button if filter is a category
  if (filter.startsWith('cat-')) {
    const catName = filter.replace('cat-', '');
    document.getElementById('current-filter-title').textContent = `${catName} Tasks`;
  } else {
    const filterLabels = {
      all: 'All Tasks',
      today: 'Due Today',
      upcoming: 'Upcoming Tasks',
      pending: 'Pending Tasks',
      completed: 'Completed Tasks'
    };
    document.getElementById('current-filter-title').textContent = filterLabels[filter] || 'Tasks';
  }

  renderTasks();
  renderStats();
}

// Add/Edit Task Modal Toggle
function openTaskModal(taskId = null) {
  taskForm.reset();
  customReminderGroup.classList.add('hidden');
  
  // Set default due date to today, due time to 1 hour from now
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  now.setHours(now.getHours() + 1);
  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

  document.getElementById('task-due-date').value = dateStr;
  document.getElementById('task-due-time').value = timeStr;

  if (taskId) {
    // Edit Mode
    STATE.activeTaskId = taskId;
    taskModalTitle.textContent = 'Edit Task';
    const task = STATE.tasks.find(t => t.id === taskId);
    if (task) {
      document.getElementById('task-id-field').value = task.id;
      document.getElementById('task-title').value = task.title;
      document.getElementById('task-desc').value = task.description;
      document.getElementById('task-due-date').value = task.dueDate;
      document.getElementById('task-due-time').value = task.dueTime;
      document.getElementById('task-priority').value = task.priority;
      document.getElementById('task-category').value = task.category;
      
      const standardOffsets = ['0', '10', '30', '60', '1440'];
      if (standardOffsets.includes(String(task.reminderMinutesBefore))) {
        taskReminderSelect.value = String(task.reminderMinutesBefore);
        customReminderGroup.classList.add('hidden');
      } else {
        taskReminderSelect.value = 'custom';
        customReminderGroup.classList.remove('hidden');
        document.getElementById('task-reminder-custom').value = task.reminderMinutesBefore;
      }
    }
  } else {
    // Add Mode
    STATE.activeTaskId = null;
    taskModalTitle.textContent = 'Create New Task';
    document.getElementById('task-id-field').value = '';
    // Select first category as default if available
    if (STATE.categories.length > 0) {
      document.getElementById('task-category').value = STATE.categories[0].name;
    }
  }

  taskModal.classList.remove('hidden');
  document.getElementById('task-title').focus();
}

function closeTaskModal() {
  taskModal.classList.add('hidden');
}

btnTriggerAddTask.addEventListener('click', () => openTaskModal());
btnEmptyStateAdd.addEventListener('click', () => openTaskModal());
btnTaskCancel.addEventListener('click', closeTaskModal);
taskModalClose.addEventListener('click', closeTaskModal);

// Toggle custom reminder field depending on select option
taskReminderSelect.addEventListener('change', () => {
  if (taskReminderSelect.value === 'custom') {
    customReminderGroup.classList.remove('hidden');
    document.getElementById('task-reminder-custom').focus();
  } else {
    customReminderGroup.classList.add('hidden');
  }
});

// Handle Add/Edit Task Form Submission
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const idField = document.getElementById('task-id-field').value;
  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const dueDate = document.getElementById('task-due-date').value;
  const dueTime = document.getElementById('task-due-time').value;
  const priority = document.getElementById('task-priority').value;
  const category = document.getElementById('task-category').value;
  
  let reminderMinutesBefore = 0;
  if (taskReminderSelect.value === 'custom') {
    reminderMinutesBefore = parseInt(document.getElementById('task-reminder-custom').value) || 0;
  } else {
    reminderMinutesBefore = parseInt(taskReminderSelect.value);
  }

  if (idField) {
    // Edit Existing
    const taskIndex = STATE.tasks.findIndex(t => t.id === idField);
    if (taskIndex !== -1) {
      const existing = STATE.tasks[taskIndex];
      // Keep old status and subtasks
      STATE.tasks[taskIndex] = {
        ...existing,
        title,
        description,
        dueDate,
        dueTime,
        priority,
        category,
        reminderMinutesBefore,
        // Reset notified if due date/time or reminder changed
        notified: (existing.dueDate === dueDate && existing.dueTime === dueTime && existing.reminderMinutesBefore === reminderMinutesBefore) ? existing.notified : false
      };
      showToast('Task updated successfully!', 'success');
    }
  } else {
    // Create New Task
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title,
      description,
      dueDate,
      dueTime,
      priority,
      category,
      status: 'pending',
      reminderMinutesBefore,
      notified: false,
      subtasks: []
    };
    STATE.tasks.push(newTask);
    showToast('Task added to Zenith!', 'success');
  }

  saveUserData();
  closeTaskModal();
  renderTasks();
  renderStats();
  renderCategories(); // Update count badges in sidebar
});

// Update category filters list in control bar
function populateFiltersDropdown() {
  const currentVal = filterCategorySelect.value;
  filterCategorySelect.innerHTML = '<option value="all">All Categories</option>';
  STATE.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.name;
    opt.textContent = cat.name;
    filterCategorySelect.appendChild(opt);
  });
  filterCategorySelect.value = currentVal;
}

// --------------------------------------------------------------------------
// 6. Subtasks Manager
// --------------------------------------------------------------------------
const detailModal = document.getElementById('detail-modal');
const detailModalClose = document.getElementById('detail-modal-close');
const detailCategoryBadge = document.getElementById('detail-category-badge');
const detailPriorityBadge = document.getElementById('detail-priority-badge');
const detailTitle = document.getElementById('detail-title');
const detailDateTime = document.getElementById('detail-datetime');
const detailDesc = document.getElementById('detail-desc');
const subtaskProgressBarFill = document.getElementById('subtask-progress-bar-fill');
const subtaskProgressLabel = document.getElementById('subtask-progress-label');
const subtasksList = document.getElementById('subtasks-list');
const subtaskForm = document.getElementById('subtask-form');
const detailStatusSelect = document.getElementById('detail-status-select');

const btnDetailEdit = document.getElementById('btn-detail-edit');
const btnDetailPostpone = document.getElementById('btn-detail-postpone');
const btnDetailDelete = document.getElementById('btn-detail-delete');

// Open Task Detail View Modal
function openTaskDetailModal(taskId) {
  STATE.activeTaskId = taskId;
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Category Colors mapping
  const categoryObj = STATE.categories.find(c => c.name === task.category) || { color: '#64748b' };
  
  detailCategoryBadge.textContent = task.category;
  detailCategoryBadge.style.backgroundColor = `${categoryObj.color}15`;
  detailCategoryBadge.style.color = categoryObj.color;

  detailPriorityBadge.textContent = task.priority;
  detailPriorityBadge.className = `priority-badge p-${task.priority}`;

  detailTitle.textContent = task.title;
  
  // Format Date and Time
  const formattedDate = formatDateString(task.dueDate);
  detailDateTime.textContent = `Due: ${formattedDate} at ${formatTimeString(task.dueTime)}`;
  
  detailDesc.textContent = task.description || 'No description provided.';
  
  // Status select value
  detailStatusSelect.value = task.status;

  renderSubtaskList(task);
  detailModal.classList.remove('hidden');
}

function closeTaskDetailModal() {
  detailModal.classList.add('hidden');
  STATE.activeTaskId = null;
  renderTasks();
}

detailModalClose.addEventListener('click', closeTaskDetailModal);

// Render Subtasks inside detail view
function renderSubtaskList(task) {
  subtasksList.innerHTML = '';
  
  if (!task.subtasks) task.subtasks = [];

  if (task.subtasks.length === 0) {
    subtasksList.innerHTML = `<li style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No subtasks created yet</li>`;
    subtaskProgressLabel.textContent = '0% Completed (0/0)';
    subtaskProgressBarFill.style.width = '0%';
    return;
  }

  let completedCount = 0;
  
  task.subtasks.forEach(sub => {
    if (sub.completed) completedCount++;

    const li = document.createElement('li');
    li.className = `subtask-item ${sub.completed ? 'subtask-completed' : ''}`;
    
    const dueDateDisplay = sub.dueDate ? `<span class="subtask-due-span ${isOverdue(sub.dueDate, '23:59') ? 'overdue' : ''}">Due: ${formatDateString(sub.dueDate)}</span>` : '';

    li.innerHTML = `
      <div class="subtask-checkbox ${sub.completed ? 'checked' : ''}" data-sub-id="${sub.id}">
        <svg class="checkbox-icon"><use href="#icon-check"></use></svg>
      </div>
      <span class="subtask-text-span">${sub.name}</span>
      ${dueDateDisplay}
      <button class="btn-icon-small btn-subtask-delete" data-sub-id="${sub.id}" title="Delete Subtask">
        <svg class="icon-small"><use href="#icon-close"></use></svg>
      </button>
    `;

    subtasksList.appendChild(li);
  });

  // Calculate Progress
  const percentage = Math.round((completedCount / task.subtasks.length) * 100);
  subtaskProgressLabel.textContent = `${percentage}% Completed (${completedCount}/${task.subtasks.length})`;
  subtaskProgressBarFill.style.width = `${percentage}%`;

  // Attach subtask listeners
  subtasksList.querySelectorAll('.subtask-checkbox').forEach(box => {
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const subId = box.getAttribute('data-sub-id');
      toggleSubtaskCompletion(task.id, subId);
    });
  });

  subtasksList.querySelectorAll('.btn-subtask-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const subId = btn.getAttribute('data-sub-id');
      deleteSubtask(task.id, subId);
    });
  });
}

// Add Subtask Logic
subtaskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const taskId = STATE.activeTaskId;
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  const name = document.getElementById('subtask-name').value.trim();
  const dueDate = document.getElementById('subtask-due-date').value;

  if (!name) return;

  const newSub = {
    id: 'sub_' + Date.now(),
    taskId,
    name,
    completed: false,
    dueDate
  };

  if (!task.subtasks) task.subtasks = [];
  task.subtasks.push(newSub);
  
  // If status is completed, revert to inprogress since a new uncompleted subtask is added
  if (task.status === 'completed') {
    task.status = 'inprogress';
    detailStatusSelect.value = 'inprogress';
  }

  saveUserData();
  subtaskForm.reset();
  renderSubtaskList(task);
  renderStats();
});

// Toggle Subtask Checked status
function toggleSubtaskCompletion(taskId, subId) {
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  const sub = task.subtasks.find(s => s.id === subId);
  if (sub) {
    sub.completed = !sub.completed;
    
    // Auto-adjust main task status based on subtasks
    const allCompleted = task.subtasks.every(s => s.completed);
    if (allCompleted) {
      task.status = 'completed';
      detailStatusSelect.value = 'completed';
    } else if (task.status === 'completed') {
      task.status = 'inprogress';
      detailStatusSelect.value = 'inprogress';
    }

    saveUserData();
    renderSubtaskList(task);
    renderStats();
  }
}

// Delete subtask
function deleteSubtask(taskId, subId) {
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.subtasks = task.subtasks.filter(s => s.id !== subId);
  saveUserData();
  renderSubtaskList(task);
  renderStats();
}

// Status select inside detail modal
detailStatusSelect.addEventListener('change', () => {
  const taskId = STATE.activeTaskId;
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  const newStatus = detailStatusSelect.value;
  task.status = newStatus;

  // If set to completed, check off all subtasks
  if (newStatus === 'completed' && task.subtasks) {
    task.subtasks.forEach(s => s.completed = true);
  }

  saveUserData();
  renderSubtaskList(task);
  renderStats();
});

// Action buttons inside detail modal
btnDetailEdit.addEventListener('click', () => {
  const currentId = STATE.activeTaskId;
  closeTaskDetailModal();
  openTaskModal(currentId);
});

btnDetailPostpone.addEventListener('click', () => {
  const currentId = STATE.activeTaskId;
  closeTaskDetailModal();
  openPostponeModal(currentId);
});

btnDetailDelete.addEventListener('click', () => {
  const currentId = STATE.activeTaskId;
  closeTaskDetailModal();
  triggerDeleteTask(currentId);
});


// --------------------------------------------------------------------------
// 7. Postpone Module
// --------------------------------------------------------------------------
const postponeModal = document.getElementById('postpone-modal');
const postponeModalClose = document.getElementById('postpone-modal-close');
const btnPostponeCancel = document.getElementById('btn-postpone-cancel');
const postponeForm = document.getElementById('postpone-form');
const postponeTaskTitle = document.getElementById('postpone-task-title');

function openPostponeModal(taskId) {
  STATE.activeTaskId = taskId;
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  postponeTaskTitle.textContent = `"${task.title}"`;
  
  // Set values to current task deadline
  document.getElementById('postpone-due-date').value = task.dueDate;
  document.getElementById('postpone-due-time').value = task.dueTime;

  postponeModal.classList.remove('hidden');
}

function closePostponeModal() {
  postponeModal.classList.add('hidden');
  STATE.activeTaskId = null;
}

postponeModalClose.addEventListener('click', closePostponeModal);
btnPostponeCancel.addEventListener('click', closePostponeModal);

// Quick postpone handler (1h, 1d, 3d, 1w)
postponeModal.querySelectorAll('.btn-postpone-quick').forEach(btn => {
  btn.addEventListener('click', () => {
    const taskId = STATE.activeTaskId;
    const task = STATE.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Base new calculation on task's original due date/time if it's in future, else base on right now
    const originalDue = new Date(`${task.dueDate}T${task.dueTime}`);
    const baseDate = originalDue.getTime() > Date.now() ? originalDue : new Date();

    const hours = parseInt(btn.getAttribute('data-hours')) || 0;
    const days = parseInt(btn.getAttribute('data-days')) || 0;

    if (hours > 0) baseDate.setHours(baseDate.getHours() + hours);
    if (days > 0) baseDate.setDate(baseDate.getDate() + days);

    const newDateStr = baseDate.toISOString().split('T')[0];
    const newTimeStr = baseDate.toTimeString().split(' ')[0].substring(0, 5);

    task.dueDate = newDateStr;
    task.dueTime = newTimeStr;
    task.notified = false; // Reset notification trigger

    saveUserData();
    closePostponeModal();
    renderTasks();
    renderStats();
    showToast('Task postponed successfully!', 'success');
  });
});

// Custom Postpone form submission
postponeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const taskId = STATE.activeTaskId;
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  const newDate = document.getElementById('postpone-due-date').value;
  const newTime = document.getElementById('postpone-due-time').value;

  task.dueDate = newDate;
  task.dueTime = newTime;
  task.notified = false; // Reset alert triggers

  saveUserData();
  closePostponeModal();
  renderTasks();
  renderStats();
  showToast('Rescheduled task deadline.', 'success');
});

// --------------------------------------------------------------------------
// 8. Delete Confirmation Modal
// --------------------------------------------------------------------------
const deleteModal = document.getElementById('delete-modal');
const btnDeleteCancel = document.getElementById('btn-delete-cancel');
const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
const deleteModalClose = document.getElementById('delete-modal-close');
const deleteTaskTitle = document.getElementById('delete-task-title');

function triggerDeleteTask(taskId) {
  STATE.activeTaskId = taskId;
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  deleteTaskTitle.textContent = `"${task.title}"`;
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  STATE.activeTaskId = null;
}

btnDeleteCancel.addEventListener('click', closeDeleteModal);
if (deleteModalClose) deleteModalClose.addEventListener('click', closeDeleteModal);

btnDeleteConfirm.addEventListener('click', () => {
  const taskId = STATE.activeTaskId;
  if (!taskId) return;

  STATE.tasks = STATE.tasks.filter(t => t.id !== taskId);
  saveUserData();
  closeDeleteModal();
  renderTasks();
  renderStats();
  renderCategories(); // Update counts in sidebar nav
  showToast('Task permanently deleted.', 'info');
});

// --------------------------------------------------------------------------
// 8.5 Enhanced Smart Search and Suggestions panel
// --------------------------------------------------------------------------
const searchDropdownPanel = document.getElementById('search-dropdown-panel');
const searchLoadingSpinner = document.getElementById('search-loading-spinner');

// Debounce helper
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Escape HTML utility
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Regex Highlight matches
function highlightMatches(text, keywords) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  if (!keywords || keywords.length === 0) return escaped;

  // Match longer keywords first
  const sortedKeywords = [...keywords]
    .filter(k => k.length > 0)
    .sort((a, b) => b.length - a.length);

  if (sortedKeywords.length === 0) return escaped;

  const escapedKws = sortedKeywords.map(kw => kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const regex = new RegExp(`(${escapedKws.join('|')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// Smart multi-keyword match check
function matchSmartSearch(task, keywords) {
  if (!keywords || keywords.length === 0) return true;
  return keywords.every(kw => {
    const titleMatch = task.title.toLowerCase().includes(kw);
    const descMatch = (task.description || '').toLowerCase().includes(kw);
    const categoryMatch = (task.category || '').toLowerCase().includes(kw);
    const priorityMatch = (task.priority || '').toLowerCase().includes(kw);
    const statusMatch = (task.status || '').toLowerCase().includes(kw);
    
    let statusDesc = task.status;
    if (task.status === 'inprogress') statusDesc = 'in progress';
    const statusDescMatch = statusDesc.toLowerCase().includes(kw);

    const formattedDate = formatDateString(task.dueDate).toLowerCase();
    const dateMatch = formattedDate.includes(kw);
    
    return titleMatch || descMatch || categoryMatch || priorityMatch || statusMatch || statusDescMatch || dateMatch;
  });
}

// Open / Close Dropdown utilities
function openSearchDropdown() {
  if (searchDropdownPanel) {
    searchDropdownPanel.classList.remove('hidden');
    taskSearchInput.setAttribute('aria-expanded', 'true');
  }
}

function closeSearchDropdown() {
  if (searchDropdownPanel) {
    searchDropdownPanel.classList.add('hidden');
    taskSearchInput.setAttribute('aria-expanded', 'false');
    STATE.activeSuggestionIndex = -1;
    taskSearchInput.removeAttribute('aria-activedescendant');
  }
}

// History loaders
function addQueryToHistory(query) {
  const cleaned = query.trim();
  if (!cleaned) return;
  
  STATE.searchHistory = STATE.searchHistory.filter(q => q.toLowerCase() !== cleaned.toLowerCase());
  STATE.searchHistory.unshift(cleaned);
  if (STATE.searchHistory.length > 5) {
    STATE.searchHistory.pop();
  }
  localStorage.setItem('zenith_search_history', JSON.stringify(STATE.searchHistory));
}

function deleteHistoryItem(index) {
  STATE.searchHistory.splice(index, 1);
  localStorage.setItem('zenith_search_history', JSON.stringify(STATE.searchHistory));
  renderSearchDropdown();
}

function clearHistory() {
  STATE.searchHistory = [];
  localStorage.setItem('zenith_search_history', JSON.stringify(STATE.searchHistory));
  renderSearchDropdown();
}

// Render the search dropdown contents
function renderSearchDropdown() {
  if (!searchDropdownPanel) return;
  const query = taskSearchInput.value.toLowerCase().trim();
  STATE.activeSuggestionIndex = -1;
  taskSearchInput.removeAttribute('aria-activedescendant');

  if (!query) {
    // History listbox
    if (STATE.searchHistory.length === 0) {
      closeSearchDropdown();
      return;
    }

    let historyListHTML = '';
    STATE.searchHistory.forEach((q, idx) => {
      historyListHTML += `
        <li class="history-item focusable-dropdown-item" role="option" id="history-opt-${idx}" data-query="${escapeHTML(q)}">
          <span class="history-item-text">
            <svg class="icon-small" style="color: var(--text-muted);"><use href="#icon-clock"></use></svg>
            <span>${escapeHTML(q)}</span>
          </span>
          <button class="history-item-delete" data-index="${idx}" aria-label="Delete search query">
            <svg class="icon-small"><use href="#icon-close"></use></svg>
          </button>
        </li>
      `;
    });

    searchDropdownPanel.innerHTML = `
      <div class="search-dropdown-section">
        <div class="search-dropdown-title">
          <span>Recent Searches</span>
          <button id="btn-clear-search-history" class="btn-text">Clear All</button>
        </div>
        <ul class="search-dropdown-list" role="listbox">
          ${historyListHTML}
        </ul>
      </div>
    `;

    const clearBtn = document.getElementById('btn-clear-search-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearHistory();
      });
    }

    searchDropdownPanel.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const qVal = item.getAttribute('data-query');
        taskSearchInput.value = qVal;
        addQueryToHistory(qVal);
        renderTasks();
        closeSearchDropdown();
      });
    });

    searchDropdownPanel.querySelectorAll('.history-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute('data-index'));
        deleteHistoryItem(index);
      });
    });

    openSearchDropdown();
  } else {
    // Suggestions listbox
    const keywords = query.split(/\s+/).filter(k => k.length > 0);
    let matchingTasks = STATE.tasks.filter(t => matchSmartSearch(t, keywords));
    matchingTasks = matchingTasks.slice(0, 5);

    if (matchingTasks.length === 0) {
      searchDropdownPanel.innerHTML = `
        <div class="search-dropdown-section">
          <div class="search-dropdown-title">Suggestions</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); padding: 8px;">No matching tasks found</div>
        </div>
      `;
      openSearchDropdown();
      return;
    }

    let suggestionsHTML = '';
    matchingTasks.forEach((task, idx) => {
      const categoryObj = STATE.categories.find(c => c.name === task.category) || { color: '#64748b' };
      const highlightedTitle = highlightMatches(task.title, keywords);
      
      let statusLabel = task.status;
      if (task.status === 'inprogress') statusLabel = 'In Progress';
      else if (task.status === 'pending') statusLabel = 'Pending';
      else if (task.status === 'completed') statusLabel = 'Completed';

      suggestionsHTML += `
        <li class="search-dropdown-item focusable-dropdown-item" role="option" id="suggest-opt-${idx}" data-id="${task.id}">
          <div class="suggestion-title">${highlightedTitle}</div>
          <div class="suggestion-details">
            <span class="category-badge" style="background-color: ${categoryObj.color}15; color: ${categoryObj.color}; padding: 1px 6px; font-size: 0.7rem;">
              ${task.category}
            </span>
            <span class="priority-badge p-${task.priority}" style="padding: 1px 6px; font-size: 0.7rem;">
              ${task.priority}
            </span>
            <span>Due: ${formatDateString(task.dueDate)}</span>
            <span>Status: ${statusLabel}</span>
          </div>
        </li>
      `;
    });

    searchDropdownPanel.innerHTML = `
      <div class="search-dropdown-section">
        <div class="search-dropdown-title">Suggestions</div>
        <ul class="search-dropdown-list" role="listbox">
          ${suggestionsHTML}
        </ul>
      </div>
    `;

    searchDropdownPanel.querySelectorAll('.search-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.getAttribute('data-id');
        const task = STATE.tasks.find(t => t.id === taskId);
        if (task) {
          addQueryToHistory(taskSearchInput.value.trim());
          openTaskDetailModal(task.id);
        }
        closeSearchDropdown();
      });
    });

    openSearchDropdown();
  }
}

// --------------------------------------------------------------------------
// 9. Search, Filter, Sorting and Stats Logic
// --------------------------------------------------------------------------

// Re-render task grid based on active search, side filters, priority, and sorting choice
function renderTasks() {
  tasksContainer.innerHTML = '';
  
  // 1. Get initial base query
  let filteredList = [...STATE.tasks];

  // 2. Apply Sidebar Quick Filters
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (STATE.currentFilter === 'today') {
    filteredList = filteredList.filter(t => t.dueDate === todayStr);
  } else if (STATE.currentFilter === 'upcoming') {
    filteredList = filteredList.filter(t => t.dueDate > todayStr);
  } else if (STATE.currentFilter === 'pending') {
    filteredList = filteredList.filter(t => t.status !== 'completed');
  } else if (STATE.currentFilter === 'completed') {
    filteredList = filteredList.filter(t => t.status === 'completed');
  } else if (STATE.currentFilter.startsWith('cat-')) {
    const catName = STATE.currentFilter.replace('cat-', '');
    filteredList = filteredList.filter(t => t.category === catName);
  }

  // 3. Apply Controls Filters (Priority & Category dropdowns)
  const priorityVal = filterPrioritySelect.value;
  if (priorityVal !== 'all') {
    filteredList = filteredList.filter(t => t.priority === priorityVal);
  }

  const categoryVal = filterCategorySelect.value;
  if (categoryVal !== 'all') {
    filteredList = filteredList.filter(t => t.category === categoryVal);
  }

  // 4. Apply Search input query
  const query = taskSearchInput.value.toLowerCase().trim();
  const keywords = query.split(/\s+/).filter(k => k.length > 0);
  if (keywords.length > 0) {
    filteredList = filteredList.filter(t => matchSmartSearch(t, keywords));
  }

  // 5. Apply sorting
  const sortVal = sortTasksSelect.value;
  filteredList.sort((a, b) => {
    if (sortVal === 'priority-desc') {
      const priorityMap = { high: 3, medium: 2, low: 1 };
      return priorityMap[b.priority] - priorityMap[a.priority];
    } else if (sortVal === 'duedate-asc') {
      return new Date(`${a.dueDate}T${a.dueTime}`) - new Date(`${b.dueDate}T${b.dueTime}`);
    } else if (sortVal === 'duedate-desc') {
      return new Date(`${b.dueDate}T${b.dueTime}`) - new Date(`${a.dueDate}T${a.dueTime}`);
    } else if (sortVal === 'alphabetical-asc') {
      return a.title.localeCompare(b.title);
    } else if (sortVal === 'status-asc') {
      const statusMap = { pending: 1, inprogress: 2, completed: 3 };
      return statusMap[a.status] - statusMap[b.status];
    }
    return 0;
  });

  // Toggle empty layout
  if (filteredList.length === 0) {
    emptyState.classList.remove('hidden');
    tasksContainer.classList.add('hidden');
    
    // Custom messaging if searching
    if (query) {
      emptyState.querySelector('.empty-state-title').textContent = 'No matching tasks found';
      emptyState.querySelector('.empty-state-description').textContent = 'Try another keyword.';
    } else {
      emptyState.querySelector('.empty-state-title').textContent = 'No tasks found';
      emptyState.querySelector('.empty-state-description').textContent = 'Try adjusting your filters, search keyword, or create a new task to get started.';
    }
  } else {
    emptyState.classList.add('hidden');
    tasksContainer.classList.remove('hidden');
    
    // Dynamic cards insertion
    filteredList.forEach(task => {
      const card = createTaskCard(task);
      tasksContainer.appendChild(card);
    });
  }
}

// Construct DOM for a single Task Card
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card ${task.status === 'completed' ? 'task-completed' : ''}`;
  card.setAttribute('data-id', task.id);

  // Set card accent border color based on category
  const categoryObj = STATE.categories.find(c => c.name === task.category) || { color: '#64748b' };
  card.style.borderLeft = `5px solid ${categoryObj.color}`;

  // Subtasks progress percentage
  let progressSectionHTML = '';
  if (task.subtasks && task.subtasks.length > 0) {
    const completedCount = task.subtasks.filter(s => s.completed).length;
    const pct = Math.round((completedCount / task.subtasks.length) * 100);
    progressSectionHTML = `
      <div class="task-card-progress">
        <div class="task-card-progress-header">
          <span>Subtasks Progress</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

  // Overdue status check
  const isTaskOverdue = isOverdue(task.dueDate, task.dueTime) && task.status !== 'completed';
  const dueClass = isTaskOverdue ? 'overdue' : '';
  const dueLabel = isTaskOverdue ? 'Overdue: ' : 'Due: ';

  // Match text highlighting
  const query = taskSearchInput.value.toLowerCase().trim();
  const keywords = query.split(/\s+/).filter(k => k.length > 0);
  const highlightedTitle = highlightMatches(task.title, keywords);
  const highlightedDesc = highlightMatches(task.description, keywords);

  card.innerHTML = `
    <div class="task-card-header">
      <div class="task-card-title-row">
        <div class="checkbox-custom ${task.status === 'completed' ? 'checked' : ''}" title="Mark completed">
          <svg class="checkbox-icon"><use href="#icon-check"></use></svg>
        </div>
        <span class="task-title-text">${highlightedTitle}</span>
      </div>
    </div>
    
    <p class="task-card-desc">${highlightedDesc || 'No description added.'}</p>
    
    ${progressSectionHTML}
    
    <div class="task-card-footer">
      <div class="task-card-due ${dueClass}">
        <svg class="icon-small"><use href="#icon-calendar"></use></svg>
        <span>${dueLabel}${formatDateString(task.dueDate)}</span>
      </div>
      
      <div class="task-card-badge-row">
        <span class="category-badge" style="background-color: ${categoryObj.color}15; color: ${categoryObj.color};">
          ${task.category}
        </span>
        <span class="priority-badge p-${task.priority}">
          ${task.priority}
        </span>
      </div>
    </div>
  `;

  // Attach card event listeners
  card.addEventListener('click', () => {
    openTaskDetailModal(task.id);
  });

  const checkbox = card.querySelector('.checkbox-custom');
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid opening detail modal
    toggleTaskStatus(task.id);
  });

  return card;
}

// Toggle Task Status (Checkbox checked)
function toggleTaskStatus(taskId) {
  const task = STATE.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (task.status === 'completed') {
    task.status = 'pending';
    // Revert subtasks
    if (task.subtasks) task.subtasks.forEach(s => s.completed = false);
    showToast('Task marked as pending.', 'info');
  } else {
    task.status = 'completed';
    // Check off all subtasks
    if (task.subtasks) task.subtasks.forEach(s => s.completed = true);
    showToast('Task completed! Keep it up! 🎉', 'success');
  }

  saveUserData();
  renderTasks();
  renderStats();
  renderCategories(); // Update counts in sidebar nav
}

// Calculate and render all metrics / numbers
function renderStats() {
  const userTasks = STATE.tasks;
  const totalCount = userTasks.length;
  const completedCount = userTasks.filter(t => t.status === 'completed').length;
  const todayStr = new Date().toISOString().split('T')[0];

  // Completion Percentage
  let pct = 0;
  if (totalCount > 0) {
    pct = Math.round((completedCount / totalCount) * 100);
  }

  document.getElementById('stats-completion-percentage').textContent = `${pct}%`;
  document.getElementById('stats-ratio-text').textContent = `${completedCount} of ${totalCount} tasks completed`;

  // Update Progress Ring SVG
  const circle = document.getElementById('progress-ring-fill');
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  // Due Today count
  const todayCount = userTasks.filter(t => t.dueDate === todayStr && t.status !== 'completed').length;
  document.getElementById('stats-today-count').textContent = todayCount;

  // In Progress status count
  const inProgressCount = userTasks.filter(t => t.status === 'inprogress').length;
  document.getElementById('stats-inprogress-count').textContent = inProgressCount;

  // High Priority count
  const highPriorityCount = userTasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
  document.getElementById('stats-high-count').textContent = highPriorityCount;

  // Render count badges inside sidebar nav filters
  document.getElementById('count-all').textContent = totalCount;
  document.getElementById('count-today').textContent = userTasks.filter(t => t.dueDate === todayStr).length;
  document.getElementById('count-upcoming').textContent = userTasks.filter(t => t.dueDate > todayStr).length;
  document.getElementById('count-pending').textContent = userTasks.filter(t => t.status !== 'completed').length;
  document.getElementById('count-completed').textContent = completedCount;
}

// Bind selectors in control bar for live sorting and filtering
filterPrioritySelect.addEventListener('change', renderTasks);
filterCategorySelect.addEventListener('change', renderTasks);
sortTasksSelect.addEventListener('change', renderTasks);
// Bind advanced search listeners
const debouncedRenderTasks = debounce(() => {
  renderTasks();
  if (searchLoadingSpinner) searchLoadingSpinner.classList.add('hidden');
}, 300);

taskSearchInput.addEventListener('focus', renderSearchDropdown);

taskSearchInput.addEventListener('input', () => {
  if (searchLoadingSpinner) searchLoadingSpinner.classList.remove('hidden');
  renderSearchDropdown();
  debouncedRenderTasks();
});

taskSearchInput.addEventListener('keydown', (e) => {
  if (!searchDropdownPanel) return;
  const focusableItems = searchDropdownPanel.querySelectorAll('.focusable-dropdown-item');
  if (focusableItems.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (searchDropdownPanel.classList.contains('hidden')) {
      renderSearchDropdown();
    } else {
      if (STATE.activeSuggestionIndex >= 0) {
        focusableItems[STATE.activeSuggestionIndex].classList.remove('active');
      }
      STATE.activeSuggestionIndex = (STATE.activeSuggestionIndex + 1) % focusableItems.length;
      const activeItem = focusableItems[STATE.activeSuggestionIndex];
      activeItem.classList.add('active');
      activeItem.scrollIntoView({ block: 'nearest' });
      taskSearchInput.setAttribute('aria-activedescendant', activeItem.id);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!searchDropdownPanel.classList.contains('hidden')) {
      if (STATE.activeSuggestionIndex >= 0) {
        focusableItems[STATE.activeSuggestionIndex].classList.remove('active');
      }
      STATE.activeSuggestionIndex = (STATE.activeSuggestionIndex - 1 + focusableItems.length) % focusableItems.length;
      const activeItem = focusableItems[STATE.activeSuggestionIndex];
      activeItem.classList.add('active');
      activeItem.scrollIntoView({ block: 'nearest' });
      taskSearchInput.setAttribute('aria-activedescendant', activeItem.id);
    }
  } else if (e.key === 'Enter') {
    if (!searchDropdownPanel.classList.contains('hidden') && STATE.activeSuggestionIndex >= 0) {
      e.preventDefault();
      focusableItems[STATE.activeSuggestionIndex].click();
    } else {
      const qVal = taskSearchInput.value.trim();
      if (qVal) {
        addQueryToHistory(qVal);
      }
      closeSearchDropdown();
    }
  } else if (e.key === 'Escape') {
    closeSearchDropdown();
    taskSearchInput.blur();
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('search-box-container');
  if (container && !container.contains(e.target)) {
    closeSearchDropdown();
  }
});

// --------------------------------------------------------------------------
// 10. Reminder Notifications & Alerts
// --------------------------------------------------------------------------
const notificationBellBtn = document.getElementById('notification-bell-btn');
const notificationDropdown = document.getElementById('notification-dropdown');
const notificationListItems = document.getElementById('notification-list-items');
const notificationBadgeCount = document.getElementById('notification-badge-count');
const btnClearNotifications = document.getElementById('btn-clear-notifications');

// Trigger dropdown open
notificationBellBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  notificationDropdown.classList.toggle('hidden');
  
  // Set all notifications as read upon viewing
  if (!notificationDropdown.classList.contains('hidden')) {
    STATE.notifications.forEach(n => n.read = true);
    saveUserData();
    updateNotificationBadge();
  }
});

// Click outside dropdown closes it
document.addEventListener('click', () => {
  notificationDropdown.classList.add('hidden');
});
notificationDropdown.addEventListener('click', (e) => e.stopPropagation());

btnClearNotifications.addEventListener('click', () => {
  STATE.notifications = [];
  saveUserData();
  renderNotifications();
  updateNotificationBadge();
});

// Render Notification Center items
function renderNotifications() {
  notificationListItems.innerHTML = '';
  
  const userNotifications = STATE.notifications;
  
  if (userNotifications.length === 0) {
    notificationListItems.innerHTML = `<li class="empty-notifications">No new notifications</li>`;
    return;
  }

  // Render reverse chronological order
  [...userNotifications].reverse().forEach(notif => {
    const li = document.createElement('li');
    li.className = `notification-item ${!notif.read ? 'unread' : ''}`;
    li.innerHTML = `
      <div class="notification-item-text">${notif.text}</div>
      <div class="notification-item-time">${formatTimeAgo(notif.time)}</div>
    `;

    li.addEventListener('click', () => {
      notificationDropdown.classList.add('hidden');
      if (notif.taskId) {
        // Open the corresponding task details modal
        openTaskDetailModal(notif.taskId);
      }
    });

    notificationListItems.appendChild(li);
  });

  updateNotificationBadge();
}

function updateNotificationBadge() {
  const unreadCount = STATE.notifications.filter(n => !n.read).length;
  if (unreadCount > 0) {
    notificationBadgeCount.textContent = unreadCount;
    notificationBadgeCount.classList.remove('hidden');
  } else {
    notificationBadgeCount.classList.add('hidden');
  }
}

// Request permission silently (triggered on initial dashboard load)
function requestNotificationPermissionSilent() {
  if ('Notification' in window && Notification.permission === 'default') {
    // We will request explicitly when user logs in or interacts
    Notification.requestPermission();
  }
}

// Fire a Browser Push Notification and write to list logs
function fireReminderAlert(task) {
  const notificationTitle = `Zenith Reminder: ${task.title}`;
  const notificationOptions = {
    body: `Task is due at ${formatTimeString(task.dueTime)} (${task.category})`,
    icon: 'favicon.ico',
    requireInteraction: true
  };

  // 1. Trigger System Push Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(notificationTitle, notificationOptions);
      n.onclick = () => {
        window.focus();
        openTaskDetailModal(task.id);
        n.close();
      };
    } catch (err) {
      console.warn("Push notifications not supported on this platform context", err);
    }
  }

  // 2. Save into internal notifications log
  const newNotif = {
    id: 'notif_' + Date.now(),
    text: `Reminder: "${task.title}" is due soon (${formatTimeString(task.dueTime)})`,
    time: Date.now(),
    read: false,
    taskId: task.id
  };
  STATE.notifications.push(newNotif);
  saveUserData();

  // 3. Render and show in-app feedback Toast
  renderNotifications();
  showToast(`Reminder: "${task.title}" is due soon!`, 'warning');
}

// Background Alert Loop (Check every 10 seconds)
function runReminderDaemon() {
  setInterval(() => {

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    STATE.tasks.forEach(task => {
      // Skip completed tasks or already notified ones
      if (task.status === 'completed' || task.notified) return;

      const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
      const offsetMs = (task.reminderMinutesBefore || 0) * 60 * 1000;
      const alertTime = new Date(dueDateTime.getTime() - offsetMs);

      // Trigger if current time has crossed the alert trigger time,
      // but do not alert if the due date is older than 3 hours (prevent spamming old alerts)
      const maxSpamWindowMs = 3 * 60 * 60 * 1000; 

      if (now >= alertTime && now.getTime() < dueDateTime.getTime() + maxSpamWindowMs) {
        task.notified = true;
        saveUserData();
        fireReminderAlert(task);
      }
    });
  }, 10000); // 10 seconds interval check
}

// --------------------------------------------------------------------------
// 11. Helper Functions and Toast Logger
// --------------------------------------------------------------------------

// Elegant Toast Alert drawer
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Auto remove toast
  const autoRemoveTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);

  // Close manually
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(autoRemoveTimer);
    toast.remove();
  });
}

// Helper: Check if date/time has passed current local time
function isOverdue(dueDateStr, dueTimeStr) {
  const deadline = new Date(`${dueDateStr}T${dueTimeStr}`);
  return deadline < new Date();
}

// Helper: Format Date String to human readable
function formatDateString(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  
  // Custom label if date matches today/tomorrow
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (d.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }
  
  return d.toLocaleDateString('en-US', options);
}

// Helper: Format Time string
function formatTimeString(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  
  let hours = parseInt(parts[0]);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  
  return `${hours}:${minutes} ${ampm}`;
}

// Helper: Format Notification time gap labels
function formatTimeAgo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHrs = Math.round(diffMins / 60);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

// --------------------------------------------------------------------------
// 12. Startup Execution
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  initTheme();
  renderCategories();
  renderTasks();
  renderStats();
  renderNotifications();
  requestNotificationPermissionSilent();
  runReminderDaemon();
  
  // Pre-fill categories in the form dropdowns
  populateCategoryDropdowns();
  populateFiltersDropdown();
});
