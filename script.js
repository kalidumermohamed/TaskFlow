/* ============================================
   TASKFLOW - Modern Task Manager
   JavaScript Logic
   ============================================ */

// ============================================
// STATE MANAGEMENT
// ============================================

const app = {
    tasks: [],
    currentFilter: 'all',
    searchTerm: '',
    editingTaskId: null,
    draggedTaskId: null,

    // Initialize the app
    init() {
        this.loadTasks();
        this.loadTheme();
        // setupEventListeners is a function declared below; call it directly
        setupEventListeners();
        this.render();
        
        console.log('TaskFlow initialized ✨');
    },

    // Load tasks from localStorage
    loadTasks() {
        const saved = localStorage.getItem('taskflow_tasks');
        this.tasks = saved ? JSON.parse(saved) : [];
    },

    // Save tasks to localStorage
    saveTasks() {
        localStorage.setItem('taskflow_tasks', JSON.stringify(this.tasks));
    },

    // Load theme preference
    loadTheme() {
        const saved = localStorage.getItem('taskflow_theme');
        if (saved === 'dark' || (!saved && this.prefersDark())) {
            // call the global helper (assigned to app later)
            enableDarkMode();
        }
    },

    // Check if user prefers dark mode
    prefersDark() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },

    // Save theme preference
    saveTheme(isDark) {
        localStorage.setItem('taskflow_theme', isDark ? 'dark' : 'light');
    }
};

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Task Form
    const taskForm = document.getElementById('taskForm');
    taskForm.addEventListener('submit', handleAddTask);

    // Edit Form
    const editForm = document.getElementById('editForm');
    editForm.addEventListener('submit', handleSaveEdit);

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearch);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleTheme);

    // Filter Buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', handleFilter);
    });

    // Modal Controls
    const confirmCancel = document.getElementById('confirmCancel');
    const editCancel = document.getElementById('editCancel');
    const modalOverlay = document.querySelectorAll('.modal-overlay');

    confirmCancel.addEventListener('click', closeConfirmModal);
    editCancel.addEventListener('click', closeEditModal);
    
    modalOverlay.forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                closeConfirmModal();
                closeEditModal();
            }
        });
    });

    // FAB (Floating Action Button)
    const fab = document.getElementById('fabButton');
    fab.addEventListener('click', openAddForm);

    // Add Task buttons
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) addTaskBtn.addEventListener('click', openAddForm);
    const startTaskBtn = document.getElementById('startTask');
    if (startTaskBtn) startTaskBtn.addEventListener('click', openAddForm);

    // Setup task list event delegation
    const tasksList = document.getElementById('tasksList');
    tasksList.addEventListener('change', handleTaskToggle);
    tasksList.addEventListener('click', handleTaskActions);
    tasksList.addEventListener('dragstart', handleDragStart);
    tasksList.addEventListener('dragover', handleDragOver);
    tasksList.addEventListener('drop', handleDrop);
    tasksList.addEventListener('dragend', handleDragEnd);

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    app.setupEventListeners = setupEventListeners;
}

// ============================================
// TASK MANAGEMENT
// ============================================

function handleAddTask(e) {
    e.preventDefault();

    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;

    if (!title) {
        showToast('error', 'Validation Error', 'Please enter a task title');
        return;
    }

    const task = {
        id: Date.now(),
        title,
        description,
        priority,
        dueDate,
        completed: false,
        createdAt: new Date().toISOString()
    };

    app.tasks.unshift(task);
    app.saveTasks();
    app.render();

    // Close the add form to return to task list view
    closeAddForm();

    // Reset form
    e.target.reset();
    document.getElementById('taskPriority').value = 'medium';

    showToast('success', 'Task Created', `"${title}" added to your tasks`);
}

function handleTaskToggle(e) {
    if (e.target.classList.contains('task-checkbox')) {
        const taskId = parseInt(e.target.closest('.task-card').dataset.taskId);
        const task = app.tasks.find(t => t.id === taskId);

        if (task) {
            task.completed = !task.completed;
            app.saveTasks();
            app.render();

            showToast(
                'success',
                task.completed ? 'Task Completed' : 'Task Reactivated',
                task.completed ? '🎉 Great job!' : 'Task moved back to active'
            );
        }
    }
}

function handleTaskActions(e) {
    const taskCard = e.target.closest('.task-card');
    if (!taskCard) return;

    const taskId = parseInt(taskCard.dataset.taskId);

    if (e.target.closest('.btn-edit')) {
        openEditModal(taskId);
    } else if (e.target.closest('.btn-delete')) {
        openConfirmModal(taskId);
    }
}

function handleSaveEdit(e) {
    e.preventDefault();

    const taskId = app.editingTaskId;
    const task = app.tasks.find(t => t.id === taskId);

    if (!task) return;

    task.title = document.getElementById('editTaskTitle').value.trim();
    task.description = document.getElementById('editTaskDescription').value.trim();
    task.priority = document.getElementById('editTaskPriority').value;
    task.dueDate = document.getElementById('editTaskDueDate').value;

    app.saveTasks();
    app.render();
    closeEditModal();

    showToast('success', 'Task Updated', 'Your changes have been saved');
}

function deleteTask(taskId) {
    const task = app.tasks.find(t => t.id === taskId);
    app.tasks = app.tasks.filter(t => t.id !== taskId);
    app.saveTasks();
    app.render();

    showToast('success', 'Task Deleted', `"${task.title}" has been removed`);
}

// ============================================
// FILTERING & SEARCH
// ============================================

function handleFilter(e) {
    // Use currentTarget to ensure the button is selected even if inner elements are clicked
    const btn = e.currentTarget || e.target;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    app.currentFilter = btn.dataset.filter;
    app.render();
}

function handleSearch(e) {
    // store live search term and re-render (combines with active filter)
    app.searchTerm = e.target.value.toLowerCase();
    app.render();
}

function getFilteredTasks() {
    let tasks;
    switch (app.currentFilter) {
        case 'active':
            tasks = app.tasks.filter(t => !t.completed);
            break;
        case 'completed':
            tasks = app.tasks.filter(t => t.completed);
            break;
        case 'high':
            tasks = app.tasks.filter(t => t.priority === 'high' && !t.completed);
            break;
        case 'medium':
            tasks = app.tasks.filter(t => t.priority === 'medium' && !t.completed);
            break;
        case 'low':
            tasks = app.tasks.filter(t => t.priority === 'low' && !t.completed);
            break;
        default:
            tasks = app.tasks.slice();
    }

    // Apply live search if present (search title + description)
    if (app.searchTerm && app.searchTerm.trim() !== '') {
        const q = app.searchTerm;
        tasks = tasks.filter(task => {
            const title = (task.title || '').toLowerCase();
            const desc = (task.description || '').toLowerCase();
            return title.includes(q) || desc.includes(q);
        });
    }

    return tasks;
}

// ============================================
// DRAG AND DROP
// ============================================

function handleDragStart(e) {
    const taskCard = e.target.closest('.task-card');
    if (taskCard) {
        app.draggedTaskId = parseInt(taskCard.dataset.taskId);
        taskCard.classList.add('dragging');
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const taskCard = e.target.closest('.task-card');
    if (taskCard && taskCard.dataset.taskId !== app.draggedTaskId) {
        const rect = taskCard.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
            taskCard.style.borderTop = '3px solid var(--primary)';
            taskCard.style.borderBottom = 'none';
        } else {
            taskCard.style.borderTop = 'none';
            taskCard.style.borderBottom = '3px solid var(--primary)';
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const targetCard = e.target.closest('.task-card');
    if (!targetCard || !app.draggedTaskId) return;

    const targetId = parseInt(targetCard.dataset.taskId);
    const draggedIndex = app.tasks.findIndex(t => t.id === app.draggedTaskId);
    const targetIndex = app.tasks.findIndex(t => t.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedTask] = app.tasks.splice(draggedIndex, 1);
        app.tasks.splice(targetIndex, 0, draggedTask);
        app.saveTasks();
    }

    clearDragStyles();
    app.render();
}

function handleDragEnd(e) {
    clearDragStyles();
    app.draggedTaskId = null;
}

function clearDragStyles() {
    document.querySelectorAll('.task-card').forEach(card => {
        card.style.borderTop = 'none';
        card.style.borderBottom = 'none';
    });
}

// ============================================
// MODALS
// ============================================

function openEditModal(taskId) {
    const task = app.tasks.find(t => t.id === taskId);
    if (!task) return;

    app.editingTaskId = taskId;

    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description;
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskDueDate').value = task.dueDate;

    document.getElementById('editModal').classList.remove('hidden');
}

// Show the add task form (only shown when user requests)
function openAddForm() {
    const section = document.querySelector('.add-task-section');
    if (!section) return;
    section.classList.remove('hidden');
    // reveal filters and stats when tasks exist
    const stats = document.querySelector('.stats-section');
    const filters = document.querySelector('.filter-section');
    if (stats) stats.classList.remove('hidden');
    if (filters) filters.classList.remove('hidden');
    // focus the title input
    setTimeout(() => document.getElementById('taskTitle')?.focus(), 200);
}

function closeAddForm() {
    const section = document.querySelector('.add-task-section');
    if (!section) return;
    section.classList.add('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    app.editingTaskId = null;
}

function openConfirmModal(taskId) {
    const task = app.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('confirmTitle').textContent = 'Delete Task?';
    document.getElementById('confirmMessage').textContent = 
        `Are you sure you want to delete "${task.title}"? This cannot be undone.`;

    const deleteBtn = document.getElementById('confirmDelete');
    deleteBtn.onclick = () => {
        deleteTask(taskId);
        closeConfirmModal();
    };

    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}

// ============================================
// THEME MANAGEMENT
// ============================================

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    app.saveTheme(isDark);
    showToast('success', 'Theme Changed', isDark ? 'Dark mode enabled' : 'Light mode enabled');
}

function enableDarkMode() {
    document.body.classList.add('dark-mode');
}

app.enableDarkMode = enableDarkMode;
app.toggleTheme = toggleTheme;

// ============================================
// NOTIFICATIONS (TOAST)
// ============================================

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    switch (type) {
        case 'success':
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            break;
        case 'error':
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
            break;
        case 'warning':
            iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.04h16.94a2 2 0 0 0 1.71-3.04L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            break;
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function handleKeyboardShortcuts(e) {
    // D - Toggle dark mode
    if (e.key === 'd' || e.key === 'D') {
        if (e.target === document.body) {
            toggleTheme();
        }
    }

    // M - Mobile FAB (scroll to form)
    if (e.key === 'm' || e.key === 'M') {
        if (e.target === document.body) {
            scrollToForm();
        }
    }

    // Escape - Close modals
    if (e.key === 'Escape') {
        closeEditModal();
        closeConfirmModal();
    }
}

function scrollToForm() {
    const form = document.querySelector('.add-task-card');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('taskTitle').focus();
}

// ============================================
// RENDERING
// ============================================

function render() {
    updateStatistics();
    const filtered = getFilteredTasks();
    renderTasks(filtered);
    // Show stats and filters only when there are tasks
    const stats = document.querySelector('.stats-section');
    const filters = document.querySelector('.filter-section');
    if (app.tasks.length > 0) {
        stats && stats.classList.remove('hidden');
        filters && filters.classList.remove('hidden');
    } else {
        stats && stats.classList.add('hidden');
        filters && filters.classList.add('hidden');
    }
    updateFilterCounts();
}

app.render = render;

function updateStatistics() {
    const total = app.tasks.length;
    const completed = app.tasks.filter(t => t.completed).length;
    const remaining = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('remainingTasks').textContent = remaining;
    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${percentage}%`;
}

function renderTasks(tasks) {
    const tasksList = document.getElementById('tasksList');
    const emptyState = document.getElementById('emptyState');

    tasksList.innerHTML = '';

    if (tasks.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tasks.forEach(task => {
        tasksList.appendChild(createTaskElement(task));
    });
}

// Update numeric counters next to filter buttons
function updateFilterCounts() {
    const counts = {
        all: app.tasks.length,
        completed: app.tasks.filter(t => t.completed).length,
        active: app.tasks.filter(t => !t.completed).length,
        high: app.tasks.filter(t => t.priority === 'high' && !t.completed).length,
        medium: app.tasks.filter(t => t.priority === 'medium' && !t.completed).length,
        low: app.tasks.filter(t => t.priority === 'low' && !t.completed).length,
    };

    document.querySelectorAll('.filter-count').forEach(el => {
        const key = el.dataset.filterCount;
        if (key && counts.hasOwnProperty(key)) el.textContent = counts[key];
    });
}

function createTaskElement(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;
    card.dataset.taskId = task.id;
    card.draggable = true;

    const dueDateDisplay = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        : 'No due date';

    const createdDateDisplay = new Date(task.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    card.innerHTML = `
        <div class="task-header">
            <input 
                type="checkbox" 
                class="task-checkbox"
                ${task.completed ? 'checked' : ''}
                aria-label="Toggle task completion"
            >
            <div class="task-content">
                <h3 class="task-title">${escapeHtml(task.title)}</h3>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    <span class="task-priority ${task.priority}">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="2"></circle>
                        </svg>
                        ${task.priority}
                    </span>
                    <span class="task-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${dueDateDisplay}
                    </span>
                    <span class="task-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Created ${createdDateDisplay}
                    </span>
                </div>
            </div>
        </div>

        <div class="task-footer">
            <div class="task-actions">
                <button 
                    class="task-btn btn-edit" 
                    title="Edit task"
                    aria-label="Edit task"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button 
                    class="task-btn delete btn-delete" 
                    title="Delete task"
                    aria-label="Delete task"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        </div>
    `;

    return card;
}

// ============================================
// UTILITIES
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
