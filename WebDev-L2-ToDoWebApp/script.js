const STORAGE_KEY = 'dayflow-tasks-v1';
const form = document.querySelector('#task-form');
const input = document.querySelector('#task-input');
const pendingList = document.querySelector('#pending-list');
const completedList = document.querySelector('#completed-list');
const pendingCount = document.querySelector('#pending-count');
const completedCount = document.querySelector('#completed-count');
const announcement = document.querySelector('#announcement');

let tasks = loadTasks();

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}
function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}
function announce(message) { announcement.textContent = message; }
function render() {
  const pending = tasks.filter(task => !task.completed);
  const completed = tasks.filter(task => task.completed);
  pendingCount.textContent = `${pending.length} pending`;
  completedCount.textContent = `${completed.length} completed`;
  renderList(pendingList, pending, 'Your schedule is clear. Add something meaningful.');
  renderList(completedList, completed, 'Finished tasks will gather here. Nicely done in advance.');
}
function renderList(list, taskItems, emptyMessage) {
  list.replaceChildren();
  if (!taskItems.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state'; empty.innerHTML = `<span>✦</span>${emptyMessage}`;
    list.append(empty); return;
  }
  taskItems.forEach(task => list.append(createTask(task)));
}
function createTask(task) {
  const item = document.createElement('li'); item.className = `task${task.completed ? ' done' : ''}`; item.dataset.id = task.id;
  const toggle = document.createElement('button'); toggle.className = 'check-button'; toggle.type = 'button'; toggle.setAttribute('aria-label', task.completed ? `Mark ${task.text} incomplete` : `Mark ${task.text} complete`);
  toggle.addEventListener('click', () => toggleTask(task.id));
  const content = document.createElement('div'); content.className = 'task-content';
  const text = document.createElement('div'); text.className = 'task-text'; text.textContent = task.text;
  const time = document.createElement('time'); time.className = 'task-time'; time.dateTime = new Date(task.completed ? task.completedAt : task.createdAt).toISOString(); time.textContent = task.completed ? `Completed ${formatDate(task.completedAt)}` : `Added ${formatDate(task.createdAt)}`;
  content.append(text, time);
  const actions = document.createElement('div'); actions.className = 'task-actions';
  const edit = actionButton('Edit', 'edit-button', () => editTask(task.id, content, actions));
  const remove = actionButton('Delete', 'delete-button', () => deleteTask(task.id));
  actions.append(edit, remove); item.append(toggle, content, actions); return item;
}
function actionButton(label, className, onClick) { const button = document.createElement('button'); button.type = 'button'; button.className = `icon-button ${className}`; button.textContent = label; button.addEventListener('click', onClick); return button; }
function toggleTask(id) { const task = tasks.find(item => item.id === id); if (!task) return; task.completed = !task.completed; task.completedAt = task.completed ? Date.now() : null; saveTasks(); render(); announce(task.completed ? 'Task marked complete.' : 'Task moved back to pending.'); }
function deleteTask(id) { const task = tasks.find(item => item.id === id); tasks = tasks.filter(item => item.id !== id); saveTasks(); render(); announce(`Deleted ${task?.text || 'task'}.`); }
function editTask(id, content, actions) {
  const task = tasks.find(item => item.id === id); if (!task) return;
  const editInput = document.createElement('input'); editInput.className = 'edit-input'; editInput.value = task.text; editInput.maxLength = 160; editInput.setAttribute('aria-label', 'Edit task text');
  const save = actionButton('Save', 'save-button', () => commitEdit()); const cancel = actionButton('Cancel', 'cancel-button', () => render());
  content.replaceChildren(editInput); actions.replaceChildren(save, cancel); editInput.focus(); editInput.select();
  editInput.addEventListener('keydown', event => { if (event.key === 'Enter') commitEdit(); if (event.key === 'Escape') render(); });
  function commitEdit() { const nextText = editInput.value.trim(); if (!nextText) { editInput.focus(); return; } task.text = nextText; saveTasks(); render(); announce('Task updated.'); }
}
form.addEventListener('submit', event => { event.preventDefault(); const text = input.value.trim(); if (!text) return; tasks.unshift({ id: crypto.randomUUID?.() || String(Date.now()), text, completed: false, createdAt: Date.now(), completedAt: null }); saveTasks(); render(); input.value = ''; input.focus(); announce('Task added to pending.'); });
render();
