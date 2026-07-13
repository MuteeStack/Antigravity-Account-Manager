/* ════════════════════════════════════════
   ANTIGRAVITY — TASKS  (tasks.js)
════════════════════════════════════════ */

const TASKS_KEY = 'antigravity_tasks_v1';

let tasks = (() => {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
  catch { return []; }
})();

const persistTasks = () => localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
const tuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const escT = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ── DOM refs ── */
const btnAddTask     = document.getElementById('btnAddTask');
const taskAddPanel   = document.getElementById('taskAddPanel');
const taskTitleInput = document.getElementById('taskTitleInput');
const btnTaskSave    = document.getElementById('btnTaskSave');
const btnTaskCancel  = document.getElementById('btnTaskCancel');
const taskList       = document.getElementById('taskList');
const tasksEmpty     = document.getElementById('tasksEmpty');
const taskFilters    = document.getElementById('taskFilters');

let currentFilter = 'all';

/* ── Add panel toggle ── */
btnAddTask.addEventListener('click', () => {
  const open = taskAddPanel.classList.contains('visible');
  if (open) closeTaskPanel();
  else { taskAddPanel.classList.add('visible'); taskTitleInput.focus(); }
});
btnTaskCancel.addEventListener('click', closeTaskPanel);

function closeTaskPanel() {
  taskAddPanel.classList.remove('visible');
  taskTitleInput.value = '';
  setTaskPriority('Medium');
  setTaskDate(null);
}

/* ── Priority dropdown (within task add panel) ── */
let taskPriority = 'Medium';
const taskPriorityTrigger  = document.getElementById('taskPriorityTrigger');
const taskPriorityDropdown = document.getElementById('taskPriorityDropdown');
const taskPriorityLabel    = document.getElementById('taskPriorityLabel');
const taskPriorityDot      = document.getElementById('taskPriorityDot');

registerDropdown(taskPriorityTrigger, taskPriorityDropdown);
taskPriorityDropdown.querySelectorAll('.status-option').forEach(opt => {
  opt.addEventListener('click', e => {
    e.stopPropagation();
    setTaskPriority(opt.dataset.val);
    closeAllDropdowns();
  });
});

function setTaskPriority(val) {
  taskPriority = val;
  taskPriorityLabel.textContent = val;
  taskPriorityDot.className = 'priority-dot ' + ({High:'prio-high', Medium:'prio-med', Low:'prio-low'}[val] || 'prio-low');
  taskPriorityDropdown.querySelectorAll('.status-option').forEach(o => o.classList.toggle('selected', o.dataset.val === val));
}

/* ── Due-date calendar (within task add panel) ── */
let taskDateObj = null, taskCalViewY = 0, taskCalViewM = 0;
const taskDateTrigger = document.getElementById('taskDateTrigger');
const taskCalDropdown = document.getElementById('taskCalDropdown');
const taskDateLabel   = document.getElementById('taskDateLabel');

registerDropdown(taskDateTrigger, taskCalDropdown, () => {
  const ref = taskDateObj || todayObj();
  taskCalViewY = ref.y; taskCalViewM = ref.m;
  renderTaskCal();
});

document.getElementById('taskCalPrev').addEventListener('click', e => { e.stopPropagation(); taskCalViewM--; if (taskCalViewM<0){taskCalViewM=11;taskCalViewY--;} renderTaskCal(); });
document.getElementById('taskCalNext').addEventListener('click', e => { e.stopPropagation(); taskCalViewM++; if (taskCalViewM>11){taskCalViewM=0;taskCalViewY++;} renderTaskCal(); });
document.getElementById('taskCalClear').addEventListener('click', e => { e.stopPropagation(); setTaskDate(null); closeAllDropdowns(); });
document.getElementById('taskCalToday').addEventListener('click', e => { e.stopPropagation(); setTaskDate(todayObj()); closeAllDropdowns(); });

function setTaskDate(obj) {
  taskDateObj = obj;
  if (obj) {
    const disp = formatDateDisplay(obj);
    taskDateLabel.textContent = disp.sub;
    taskDateLabel.classList.remove('fi-placeholder');
  } else {
    taskDateLabel.textContent = 'No due date';
    taskDateLabel.classList.add('fi-placeholder');
  }
}

function renderTaskCal() {
  document.getElementById('taskCalMonthLabel').textContent = `${MONTHS_FULL[taskCalViewM]} ${taskCalViewY}`;
  const grid = document.getElementById('taskCalGrid');
  grid.innerHTML = '';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => { const el=document.createElement('div'); el.className='cal-dow'; el.textContent=d; grid.appendChild(el); });
  const firstDay    = new Date(taskCalViewY,taskCalViewM,1).getDay();
  const daysInMonth = new Date(taskCalViewY,taskCalViewM+1,0).getDate();
  const daysInPrev  = new Date(taskCalViewY,taskCalViewM,0).getDate();
  const today       = todayObj();
  for (let i=firstDay-1;i>=0;i--) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=daysInPrev-i; grid.appendChild(el); }
  for (let d=1;d<=daysInMonth;d++) {
    const el=document.createElement('div'); el.className='cal-day'; el.textContent=d;
    if (d===today.d && taskCalViewM===today.m && taskCalViewY===today.y) el.classList.add('today');
    if (taskDateObj && d===taskDateObj.d && taskCalViewM===taskDateObj.m && taskCalViewY===taskDateObj.y) el.classList.add('selected');
    el.addEventListener('click', ev => { ev.stopPropagation(); setTaskDate({y:taskCalViewY,m:taskCalViewM,d}); closeAllDropdowns(); });
    grid.appendChild(el);
  }
  const rem=(7-(firstDay+daysInMonth)%7)%7;
  for (let d=1;d<=rem;d++) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=d; grid.appendChild(el); }
}

/* ── Save new task ── */
btnTaskSave.addEventListener('click', saveNewTask);
taskTitleInput.addEventListener('keydown', e => { if (e.key==='Enter') saveNewTask(); });

function saveNewTask() {
  const title = taskTitleInput.value.trim();
  if (!title) { toast('Enter a task description.'); taskTitleInput.focus(); return; }
  tasks.push({
    id: tuid(),
    title,
    priority: taskPriority,
    due: taskDateObj ? dateObjToISO(taskDateObj) : '',
    done: false,
    createdAt: Date.now()
  });
  persistTasks();
  renderTasks();
  closeTaskPanel();
  toast('Task added.');
}

/* ── Filters ── */
taskFilters.querySelectorAll('.task-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    taskFilters.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

function getFilteredTasks() {
  if (currentFilter === 'active') return tasks.filter(t => !t.done);
  if (currentFilter === 'done')   return tasks.filter(t => t.done);
  return tasks;
}

/* ── Render ── */
function isOverdue(t) {
  if (!t.due || t.done) return false;
  const due = isoToDateObj(t.due);
  const today = todayObj();
  const dueDate   = new Date(due.y, due.m, due.d);
  const todayDate = new Date(today.y, today.m, today.d);
  return dueDate < todayDate;
}

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

function renderTasks() {
  taskList.innerHTML = '';
  const filtered = getFilteredTasks()
    .slice()
    .sort((a,b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    });

  if (!filtered.length) { tasksEmpty.style.display = 'block'; return; }
  tasksEmpty.style.display = 'none';

  filtered.forEach(t => {
    const card = document.createElement('div');
    card.className = 'task-card' + (t.done ? ' done' : '');

    const dueDisp = t.due ? formatDateDisplay(isoToDateObj(t.due)) : null;
    const overdue = isOverdue(t);

    const prioClass = { High:'priority-high-text', Medium:'priority-med-text', Low:'priority-low-text' }[t.priority] || 'priority-low-text';
    const prioDotClass = { High:'prio-high', Medium:'prio-med', Low:'prio-low' }[t.priority] || 'prio-low';

    card.innerHTML = `
      <div class="task-check ${t.done?'checked':''}" data-id="${t.id}">
        ${t.done ? '<i class="ph ph-check" style="font-weight: bold"></i>' : ''}
      </div>
      <div class="task-body">
        <div class="task-name">${escT(t.title)}</div>
        <div class="task-meta">
          <span class="task-priority-pill">
            <span class="priority-dot ${prioDotClass}"></span>
            <span class="${prioClass}">${t.priority}</span>
          </span>
          ${dueDisp ? `
            <span class="task-due ${overdue ? 'overdue' : ''}">
              <i class="ph ph-calendar-blank"></i> ${dueDisp.sub}${overdue ? ' · Overdue' : ''}
            </span>` : ''}
        </div>
      </div>
      <button class="task-edit" data-id="${t.id}" title="Edit task">
        <i class="ph ph-pencil-simple"></i>
      </button>
      <button class="task-delete" data-id="${t.id}" title="Delete task">
        <i class="ph ph-trash"></i>
      </button>
    `;

    card.querySelector('.task-check').addEventListener('click', () => {
      const task = tasks.find(x => x.id === t.id);
      if (!task) return;
      task.done = !task.done;
      persistTasks();
      renderTasks();
    });

    card.querySelector('.task-edit').addEventListener('click', () => {
      enterTaskEditMode(card, t.id);
    });

    card.querySelector('.task-delete').addEventListener('click', async () => {
      const ok = await showConfirm({
        title: 'Delete task?',
        email: t.title,
        msg: 'This task will be permanently removed.',
        okLabel: 'Delete',
        danger: true
      });
      if (!ok) return;
      tasks = tasks.filter(x => x.id !== t.id);
      persistTasks();
      renderTasks();
      toast('Task deleted.');
    });

    taskList.appendChild(card);
  });
}

/* ── Inline edit mode for tasks ── */
function enterTaskEditMode(card, id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  const body = card.querySelector('.task-body');
  const checkBtn  = card.querySelector('.task-check');
  const editBtn   = card.querySelector('.task-edit');
  const deleteBtn = card.querySelector('.task-delete');

  checkBtn.style.visibility  = 'hidden';
  editBtn.style.display      = 'none';
  deleteBtn.style.display    = 'none';

  body.innerHTML = `
    <input type="text" class="prompt-edit-title" id="te-title-${id}" value="${escT(t.title)}" placeholder="Task description"/>
    <div class="task-edit-meta-row">
      <select class="task-edit-select" id="te-priority-${id}">
        <option value="High" ${t.priority==='High'?'selected':''}>High</option>
        <option value="Medium" ${t.priority==='Medium'?'selected':''}>Medium</option>
        <option value="Low" ${t.priority==='Low'?'selected':''}>Low</option>
      </select>
      <div class="input-date-wrap" style="position:relative;width:180px;">
        <div class="fake-input" id="te-date-trigger-${id}" style="height:38px;">
          <i class="ph ph-calendar-blank"></i>
          <span class="fi-val ${t.due?'':'fi-placeholder'}" id="te-date-label-${id}">${t.due ? formatDateDisplay(isoToDateObj(t.due)).sub : 'No due date'}</span>
        </div>
        <div class="dropdown cal-dropdown" id="te-date-cal-${id}">
          <div class="cal-header">
            <span class="cal-month-label" id="te-cal-month-${id}"></span>
            <div class="cal-nav">
              <button class="cal-nav-btn" id="te-cal-prev-${id}">&#8249;</button>
              <button class="cal-nav-btn" id="te-cal-next-${id}">&#8250;</button>
            </div>
          </div>
          <div class="cal-grid" id="te-cal-grid-${id}"></div>
          <div class="cal-footer">
            <span class="cal-link" id="te-cal-clear-${id}">Clear</span>
            <span class="cal-link" id="te-cal-today-${id}">Today</span>
          </div>
        </div>
      </div>
    </div>
    <div class="prompt-edit-actions">
      <button class="btn-sm btn-sm-ghost" id="te-cancel-${id}">Cancel</button>
      <button class="btn-sm btn-sm-primary" id="te-save-${id}">Save</button>
    </div>
  `;

  const titleEl = document.getElementById(`te-title-${id}`);
  titleEl.focus();
  titleEl.select();

  /* Wire up the custom calendar dropdown for this edit row */
  let editDateObj = t.due ? isoToDateObj(t.due) : null;
  let editCalY, editCalM;
  const dateTriggerEl = document.getElementById(`te-date-trigger-${id}`);
  const dateDropdownEl = document.getElementById(`te-date-cal-${id}`);
  const dateLabelEl = document.getElementById(`te-date-label-${id}`);

  registerDropdown(dateTriggerEl, dateDropdownEl, () => {
    const ref = editDateObj || todayObj();
    editCalY = ref.y; editCalM = ref.m;
    renderEditCal();
  });

  function setEditDate(obj) {
    editDateObj = obj;
    if (obj) {
      dateLabelEl.textContent = formatDateDisplay(obj).sub;
      dateLabelEl.classList.remove('fi-placeholder');
    } else {
      dateLabelEl.textContent = 'No due date';
      dateLabelEl.classList.add('fi-placeholder');
    }
  }

  function renderEditCal() {
    document.getElementById(`te-cal-month-${id}`).textContent = `${MONTHS_FULL[editCalM]} ${editCalY}`;
    const grid = document.getElementById(`te-cal-grid-${id}`);
    grid.innerHTML = '';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => { const el=document.createElement('div'); el.className='cal-dow'; el.textContent=d; grid.appendChild(el); });
    const firstDay    = new Date(editCalY,editCalM,1).getDay();
    const daysInMonth = new Date(editCalY,editCalM+1,0).getDate();
    const daysInPrev  = new Date(editCalY,editCalM,0).getDate();
    const today       = todayObj();
    for (let i=firstDay-1;i>=0;i--) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=daysInPrev-i; grid.appendChild(el); }
    for (let d=1;d<=daysInMonth;d++) {
      const el=document.createElement('div'); el.className='cal-day'; el.textContent=d;
      if (d===today.d && editCalM===today.m && editCalY===today.y) el.classList.add('today');
      if (editDateObj && d===editDateObj.d && editCalM===editDateObj.m && editCalY===editDateObj.y) el.classList.add('selected');
      el.addEventListener('click', ev => { ev.stopPropagation(); setEditDate({y:editCalY,m:editCalM,d}); closeAllDropdowns(); });
      grid.appendChild(el);
    }
    const rem=(7-(firstDay+daysInMonth)%7)%7;
    for (let d=1;d<=rem;d++) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=d; grid.appendChild(el); }
  }

  document.getElementById(`te-cal-prev-${id}`).addEventListener('click', e => { e.stopPropagation(); editCalM--; if (editCalM<0){editCalM=11;editCalY--;} renderEditCal(); });
  document.getElementById(`te-cal-next-${id}`).addEventListener('click', e => { e.stopPropagation(); editCalM++; if (editCalM>11){editCalM=0;editCalY++;} renderEditCal(); });
  document.getElementById(`te-cal-clear-${id}`).addEventListener('click', e => { e.stopPropagation(); setEditDate(null); closeAllDropdowns(); });
  document.getElementById(`te-cal-today-${id}`).addEventListener('click', e => { e.stopPropagation(); setEditDate(todayObj()); closeAllDropdowns(); });

  document.getElementById(`te-save-${id}`).addEventListener('click', () => {
    const newTitle = titleEl.value.trim();
    if (!newTitle) { toast('Task description cannot be empty.'); titleEl.focus(); return; }
    t.title    = newTitle;
    t.priority = document.getElementById(`te-priority-${id}`).value;
    t.due      = editDateObj ? dateObjToISO(editDateObj) : '';
    persistTasks();
    renderTasks();
    toast('Task updated.');
  });

  document.getElementById(`te-cancel-${id}`).addEventListener('click', () => {
    renderTasks();
  });
}

/* ── Init ── */
setTaskPriority('Medium');
setTaskDate(null);
renderTasks();
