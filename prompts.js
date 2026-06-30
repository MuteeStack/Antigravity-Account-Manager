/* ════════════════════════════════════════
   ANTIGRAVITY — PROMPTS  (prompts.js)
════════════════════════════════════════ */

const PROMPTS_KEY = 'antigravity_prompts_v1';

let prompts = (() => {
  try { return JSON.parse(localStorage.getItem(PROMPTS_KEY)) || []; }
  catch { return []; }
})();

const persistPrompts = () => localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
const puid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const escP = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ── Robust copy-to-clipboard with fallback ── */
function copyText(text) {
  return new Promise((resolve, reject) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(resolve).catch(() => fallbackCopy(text, resolve, reject));
    } else {
      fallbackCopy(text, resolve, reject);
    }
  });
}

function fallbackCopy(text, resolve, reject) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    ok ? resolve() : reject(new Error('execCommand failed'));
  } catch (err) {
    reject(err);
  }
}
const promptList      = document.getElementById('promptList');
const promptsEmpty    = document.getElementById('promptsEmpty');
const btnAddPrompt    = document.getElementById('btnAddPrompt');
const promptAddPanel  = document.getElementById('promptAddPanel');
const promptTitleInput= document.getElementById('promptTitleInput');
const promptTextInput = document.getElementById('promptTextInput');
const btnPromptSave   = document.getElementById('btnPromptSave');
const btnPromptCancel = document.getElementById('btnPromptCancel');

/* ── Add panel toggle ── */
btnAddPrompt.addEventListener('click', () => {
  const open = promptAddPanel.classList.contains('visible');
  if (open) { closeAddPromptPanel(); }
  else      { promptAddPanel.classList.add('visible'); promptTitleInput.focus(); }
});

btnPromptCancel.addEventListener('click', closeAddPromptPanel);

/* Auto-grow textarea to fit content */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
promptTextInput.addEventListener('input', () => autoGrow(promptTextInput));

function closeAddPromptPanel() {
  promptAddPanel.classList.remove('visible');
  promptTitleInput.value = '';
  promptTextInput.value  = '';
  promptTextInput.style.height = '';
}

/* ── Save new prompt ── */
btnPromptSave.addEventListener('click', saveNewPrompt);
promptTextInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveNewPrompt();
});

function saveNewPrompt() {
  const text  = promptTextInput.value.trim();
  const title = promptTitleInput.value.trim();
  if (!text) { toast('Enter a prompt first.'); promptTextInput.focus(); return; }
  prompts.push({ id: puid(), title, text });
  persistPrompts();
  renderPrompts();
  closeAddPromptPanel();
  toast('Prompt saved.');
}

/* ── Render ── */
function renderPrompts() {
  promptList.innerHTML = '';
  if (!prompts.length) { promptsEmpty.style.display = 'block'; return; }
  promptsEmpty.style.display = 'none';

  prompts.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.dataset.id = p.id;
    card.draggable = true;

    card.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">
        <span></span><span></span><span></span>
      </div>
      <div class="prompt-body" id="pb-${p.id}">
        ${p.title ? `<div class="prompt-name">${escP(p.title)}</div>` : ''}
        <div class="prompt-text">${escP(p.text)}</div>
      </div>
      <div class="prompt-actions">
        <button class="pact-btn copy-btn" title="Copy prompt" data-id="${p.id}">
          <i class="ph ph-copy"></i>
        </button>
        <button class="pact-btn edit-btn" title="Edit prompt" data-id="${p.id}">
          <i class="ph ph-pencil-simple"></i>
        </button>
        <button class="pact-btn del-btn"  title="Delete prompt" data-id="${p.id}">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    `;

    /* Copy */
    card.querySelector('.copy-btn').addEventListener('click', e => {
      e.stopPropagation();
      const pr = prompts.find(x => x.id === p.id);
      if (!pr) return;
      copyText(pr.text).then(() => {
        const btn = e.currentTarget;
        btn.classList.add('copied');
        btn.innerHTML = '<i class="ph ph-check"></i>';
        toast('Copied!');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<i class="ph ph-copy"></i>';
        }, 1800);
      }).catch(() => toast('Copy failed — select and copy manually.'));
    });

    /* Edit */
    card.querySelector('.edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      enterEditMode(card, p.id);
    });

    /* Delete */
    card.querySelector('.del-btn').addEventListener('click', async e => {
      e.stopPropagation();
      const ok = await showConfirm({
        title: 'Delete prompt?',
        email: prompts.find(x => x.id === p.id)?.title || '',
        msg:   'This prompt will be permanently removed.',
        okLabel: 'Delete',
        danger: true
      });
      if (!ok) return;
      prompts = prompts.filter(x => x.id !== p.id);
      persistPrompts();
      renderPrompts();
      toast('Deleted.');
    });

    /* Drag events */
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover',  onDragOver);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop',      onDrop);
    card.addEventListener('dragend',   onDragEnd);

    promptList.appendChild(card);
  });
}

/* ── Inline edit mode ── */
function enterEditMode(card, id) {
  const pr = prompts.find(p => p.id === id);
  if (!pr) return;

  const body = card.querySelector('.prompt-body');
  const actions = card.querySelector('.prompt-actions');

  /* Hide action buttons while editing */
  actions.style.display = 'none';

  body.innerHTML = `
    <input  class="prompt-edit-title" type="text"  value="${escP(pr.title)}" placeholder="Title (optional)"/>
    <textarea class="prompt-edit-text" rows="4">${escP(pr.text)}</textarea>
    <div class="prompt-edit-actions">
      <button class="btn-sm btn-sm-ghost"   id="eCancel-${id}">Cancel</button>
      <button class="btn-sm btn-sm-primary" id="eSave-${id}">Save</button>
    </div>
  `;

  const titleEl = body.querySelector('.prompt-edit-title');
  const textEl  = body.querySelector('.prompt-edit-text');
  titleEl.focus();
  autoGrow(textEl);
  textEl.addEventListener('input', () => autoGrow(textEl));

  body.querySelector(`#eSave-${id}`).addEventListener('click', () => {
    const newText  = textEl.value.trim();
    const newTitle = titleEl.value.trim();
    if (!newText) { toast('Prompt text cannot be empty.'); textEl.focus(); return; }
    pr.title = newTitle;
    pr.text  = newText;
    persistPrompts();
    renderPrompts();
    toast('Prompt updated.');
  });

  body.querySelector(`#eCancel-${id}`).addEventListener('click', () => {
    renderPrompts();
  });
}

/* ── Drag & Drop ── */
let dragSrcId = null;

function onDragStart(e) {
  dragSrcId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (this.dataset.id !== dragSrcId) this.classList.add('drag-over');
}

function onDragLeave() {
  this.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const targetId = this.dataset.id;
  if (!dragSrcId || dragSrcId === targetId) return;

  const srcIdx = prompts.findIndex(p => p.id === dragSrcId);
  const tgtIdx = prompts.findIndex(p => p.id === targetId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const [moved] = prompts.splice(srcIdx, 1);
  prompts.splice(tgtIdx, 0, moved);
  persistPrompts();
  renderPrompts();
}

function onDragEnd() {
  document.querySelectorAll('.prompt-card').forEach(c => {
    c.classList.remove('dragging', 'drag-over');
  });
  dragSrcId = null;
}

/* ── Init ── */
renderPrompts();
