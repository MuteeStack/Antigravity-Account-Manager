/* ════════════════════════════════════════
   ANTIGRAVITY ACCOUNT MANAGER — app.js
════════════════════════════════════════ */

/* ── Storage & Helpers ── */
const KEY = 'antigravity_v2';
let accounts = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } })();
const persist = () => localStorage.setItem(KEY, JSON.stringify(accounts));
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const esc  = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function weekAhead()  { const d = new Date(); d.setDate(d.getDate()+7); return { y:d.getFullYear(), m:d.getMonth(), d:d.getDate() }; }
function todayObj()   { const d = new Date(); return { y:d.getFullYear(), m:d.getMonth(), d:d.getDate() }; }
function nowHM()      { const d = new Date(); return { h:d.getHours(), min:d.getMinutes() }; }
function dateObjToISO(o) { return `${o.y}-${String(o.m+1).padStart(2,'0')}-${String(o.d).padStart(2,'0')}`; }
function isoToDateObj(s) {
  if (!s) return null;
  const [y,mo,d] = s.split('-').map(Number);
  return { y, m:mo-1, d };
}

const DAY_NAMES        = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES_SHORT= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL      = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDateDisplay(o) {
  if (!o) return null;
  const dayName = DAY_NAMES[new Date(o.y,o.m,o.d).getDay()];
  return { dayName, sub:`${MONTH_NAMES_SHORT[o.m]} ${o.d}, ${o.y}` };
}
function timeObjToStore(h12, min, period) {
  let h = parseInt(h12);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
function storeToTimeObj(s) {
  if (!s) return null;
  const [h,m] = s.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return { h12:String(h12).padStart(2,'0'), min:String(m).padStart(2,'0'), period };
}

/* ── Toast ── */
const toastEl = document.getElementById('toastEl');
let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

/* ── Confirm Dialog ── */
let confirmResolve = null;
const overlay        = document.getElementById('confirmOverlay');
const confirmOkBtn   = document.getElementById('confirmOk');
const confirmCancelBtn = document.getElementById('confirmCancel');

function showConfirm({ title='', email='', msg='', okLabel='OK', danger=false }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmEmail').textContent = email;
  document.getElementById('confirmMsg').textContent   = msg;
  confirmOkBtn.textContent = okLabel;
  confirmOkBtn.style.background = danger ? '#ff4d4d' : '#FF8C00';
  confirmOkBtn.style.color = '#fff';
  overlay.classList.add('visible');
  return new Promise(res => { confirmResolve = res; });
}
confirmOkBtn.addEventListener('click',    () => { overlay.classList.remove('visible'); confirmResolve && confirmResolve(true); });
confirmCancelBtn.addEventListener('click',() => { overlay.classList.remove('visible'); confirmResolve && confirmResolve(false); });
overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.classList.remove('visible'); confirmResolve && confirmResolve(false); } });

/* ── Dropdown Manager ── */
const allDropdowns = [];
function registerDropdown(trigger, dropdown, onOpen) {
  allDropdowns.push({ trigger, dropdown });
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) { dropdown.classList.add('open'); trigger.classList.add('active'); if (onOpen) onOpen(); }
  });
}
function closeAllDropdowns() {
  allDropdowns.forEach(({ trigger, dropdown }) => {
    dropdown.classList.remove('open');
    trigger.classList.remove('active');
  });
}
document.addEventListener('click',   () => closeAllDropdowns());
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllDropdowns(); });

/* ── Form Status Dropdown ── */
let formStatus   = 'Open';
const statusTrigger  = document.getElementById('statusTrigger');
const statusDropdown = document.getElementById('statusDropdown');
const statusLabel    = document.getElementById('statusLabel');
const statusDot      = document.getElementById('statusDot');
const dateTimeGroup  = document.getElementById('dateTimeGroup');

registerDropdown(statusTrigger, statusDropdown);
statusDropdown.querySelectorAll('.status-option').forEach(opt => {
  opt.addEventListener('click', e => {
    e.stopPropagation();
    setFormStatus(opt.dataset.val);
    closeAllDropdowns();
  });
});

function setFormStatus(val) {
  formStatus = val;
  statusLabel.textContent = val;
  statusDot.className = 'status-dot ' + (val === 'Open' ? 'dot-open' : 'dot-closed');
  statusDropdown.querySelectorAll('.status-option').forEach(o => o.classList.toggle('selected', o.dataset.val === val));
  if (val === 'Closed') {
    dateTimeGroup.classList.remove('hidden');
    if (!formDateObj) setFormDate(weekAhead());
    if (!formTimeH)   { const n = nowHM(); setFormTime(String(n.h%12||12).padStart(2,'0'), String(n.min).padStart(2,'0'), n.h>=12?'PM':'AM'); }
  } else {
    dateTimeGroup.classList.add('hidden');
  }
}

/* ── Form Calendar ── */
let formDateObj = null, calViewY = 0, calViewM = 0;
const dateTrigger = document.getElementById('dateTrigger');
const calDropdown = document.getElementById('calDropdown');
const dateLabel   = document.getElementById('dateLabel');

registerDropdown(dateTrigger, calDropdown, () => {
  if (!formDateObj) { const wa = weekAhead(); calViewY = wa.y; calViewM = wa.m; }
  else { calViewY = formDateObj.y; calViewM = formDateObj.m; }
  renderCal();
});

document.getElementById('calPrev').addEventListener('click',  e => { e.stopPropagation(); calViewM--; if (calViewM<0){calViewM=11;calViewY--;} renderCal(); });
document.getElementById('calNext').addEventListener('click',  e => { e.stopPropagation(); calViewM++; if (calViewM>11){calViewM=0;calViewY++;} renderCal(); });
document.getElementById('calClear').addEventListener('click', e => { e.stopPropagation(); setFormDate(null); closeAllDropdowns(); });
document.getElementById('calToday').addEventListener('click', e => { e.stopPropagation(); setFormDate(todayObj()); closeAllDropdowns(); });

function setFormDate(obj) {
  formDateObj = obj;
  if (obj) {
    const disp = formatDateDisplay(obj);
    dateLabel.innerHTML = `<span class="fi-date-display"><span class="fi-day-name">${disp.dayName}</span><span class="fi-date-sub">${disp.sub}</span></span>`;
    dateLabel.classList.remove('fi-placeholder');
  } else {
    dateLabel.textContent = 'Pick a date';
    dateLabel.classList.add('fi-placeholder');
  }
}

function renderCal() {
  document.getElementById('calMonthLabel').textContent = `${MONTHS_FULL[calViewM]} ${calViewY}`;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    const el = document.createElement('div'); el.className='cal-dow'; el.textContent=d; grid.appendChild(el);
  });
  const firstDay    = new Date(calViewY,calViewM,1).getDay();
  const daysInMonth = new Date(calViewY,calViewM+1,0).getDate();
  const daysInPrev  = new Date(calViewY,calViewM,0).getDate();
  const today       = todayObj();
  for (let i=firstDay-1;i>=0;i--) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=daysInPrev-i; grid.appendChild(el); }
  for (let d=1;d<=daysInMonth;d++) {
    const el = document.createElement('div'); el.className='cal-day'; el.textContent=d;
    if (d===today.d && calViewM===today.m && calViewY===today.y) el.classList.add('today');
    if (formDateObj && d===formDateObj.d && calViewM===formDateObj.m && calViewY===formDateObj.y) el.classList.add('selected');
    el.addEventListener('click', ev => { ev.stopPropagation(); setFormDate({y:calViewY,m:calViewM,d}); closeAllDropdowns(); });
    grid.appendChild(el);
  }
  const rem = (7-(firstDay+daysInMonth)%7)%7;
  for (let d=1;d<=rem;d++) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=d; grid.appendChild(el); }
}

/* ── Form Time Picker ── */
let formTimeH=null, formTimeMin=null, formTimePeriod=null;
const timeTrigger = document.getElementById('timeTrigger');
const timeDropdown= document.getElementById('timeDropdown');
const timeLabel   = document.getElementById('timeLabel');

registerDropdown(timeTrigger, timeDropdown, () =>
  renderTimePicker('hourCol','minCol','periodCol', formTimeH, formTimeMin, formTimePeriod, (h,min,p) => setFormTime(h,min,p))
);

function setFormTime(h,min,period) {
  formTimeH=h; formTimeMin=min; formTimePeriod=period;
  if (h) {
    timeLabel.innerHTML = `<span class="fi-time-display">${parseInt(h)}:${min} ${period}</span>`;
    timeLabel.classList.remove('fi-placeholder');
  } else {
    timeLabel.textContent='Pick a time';
    timeLabel.classList.add('fi-placeholder');
  }
}

/* ── Time Picker Renderer ── */
function renderTimePicker(hourColId, minColId, periodColId, selH, selMin, selPeriod, onChange) {
  const hourCol   = document.getElementById(hourColId);
  const minCol    = document.getElementById(minColId);
  const periodCol = document.getElementById(periodColId);
  hourCol.innerHTML=''; minCol.innerHTML=''; periodCol.innerHTML='';

  const hours   = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const mins    = Array.from({length:60},(_,i)=>String(i).padStart(2,'0'));
  const periods = ['AM','PM'];

  let curH  = selH      || '12';
  let curMin = selMin   || '00';
  let curP  = selPeriod || 'AM';

  const pick = () => onChange(curH, curMin, curP);

  function buildCol(col, items, selected, onPick) {
    items.forEach(v => {
      const el = document.createElement('div');
      el.className = 'time-item' + (v===selected?' selected':'');
      el.textContent = v;
      el.dataset.value = v;
      el.addEventListener('click', ev => { ev.stopPropagation(); onPick(v); });
      col.appendChild(el);
    });
  }

  function scrollToSelected(col) {
    const sel = col.querySelector('.selected');
    if (sel) setTimeout(() => sel.scrollIntoView({block:'center',behavior:'smooth'}), 40);
  }

  function rebuild() {
    hourCol.innerHTML=''; minCol.innerHTML=''; periodCol.innerHTML='';
    buildCol(hourCol,   hours,   curH,   v => { curH=v;   rebuild(); pick(); });
    buildCol(minCol,    mins,    curMin, v => { curMin=v;  rebuild(); pick(); });
    buildCol(periodCol, periods, curP,   v => { curP=v;   rebuild(); pick(); });
    scrollToSelected(hourCol);
    scrollToSelected(minCol);
    scrollToSelected(periodCol);
  }
  rebuild();
}

/* ── Toggle Add Panel ── */
const addPanel = document.getElementById('addPanel');
document.getElementById('btnAddAccount').addEventListener('click', () => {
  const open = addPanel.classList.contains('visible');
  if (open) { addPanel.classList.remove('visible'); resetForm(); }
  else      { resetForm(); addPanel.classList.add('visible'); inputEmail.focus(); }
});

/* ── Clear All ── */
document.getElementById('btnClearAll').addEventListener('click', async () => {
  if (!accounts.length) { toast('Nothing to clear.'); return; }
  const ok = await showConfirm({ title:'Clear all accounts?', email:'', msg:'All entries will be permanently removed.', okLabel:'Clear All', danger:true });
  if (!ok) return;
  accounts=[]; persist(); renderTable();
  addPanel.classList.remove('visible'); resetForm();
  toast('Cleared.');
});

/* ── Render Table ── */
const accountsBody  = document.getElementById('accountsBody');
const emptyState    = document.getElementById('emptyState');
const noResultsState= document.getElementById('noResultsState');
const accountSearch = document.getElementById('accountSearch');

let searchQuery = '';
accountSearch.addEventListener('input', () => {
  searchQuery = accountSearch.value.trim().toLowerCase();
  renderTable();
});

function getFilteredAccounts() {
  if (!searchQuery) return accounts;
  return accounts.filter(a =>
    a.email.toLowerCase().includes(searchQuery) ||
    a.status.toLowerCase().includes(searchQuery)
  );
}

function renderTable() {
  accountsBody.innerHTML='';
  const filtered = getFilteredAccounts();

  if (!accounts.length) {
    emptyState.style.display = 'block';
    noResultsState.style.display = 'none';
    return;
  }
  emptyState.style.display = 'none';

  if (!filtered.length) {
    noResultsState.style.display = 'block';
    return;
  }
  noResultsState.style.display = 'none';

  filtered.forEach(acc => {
    const tr = document.createElement('tr');
    const isOpen = acc.status === 'Open';
    const dateDisp = acc.date ? formatDateDisplay(isoToDateObj(acc.date)) : null;
    const timeDisp = acc.time ? (() => { const t=storeToTimeObj(acc.time); return t?`${parseInt(t.h12)}:${t.min} ${t.period}`:null; })() : null;

    tr.setAttribute('data-id', acc.id);
    tr.innerHTML = `
      <td class="email-cell">${esc(acc.email)}</td>
      <td>
        <div class="tbl-status-wrap" id="sw-${acc.id}" style="position:relative;">
          <div class="tbl-status-btn ${isOpen?'open-pill':'closed-pill'}" id="sb-${acc.id}">
            <span style="width:6px;height:6px;border-radius:50%;background:${isOpen?'#4CAF50':'#FF8C00'};display:inline-block;flex-shrink:0;"></span>
            ${esc(acc.status)}
          </div>
          <div class="dropdown tbl-status-dropdown" id="sd-${acc.id}">
            <div class="status-option ${isOpen?'selected':''}" data-id="${acc.id}" data-val="Open">
              <span class="status-dot dot-open"></span>
              <span class="status-open-text">Open</span>
            </div>
            <div class="status-option ${!isOpen?'selected':''}" data-id="${acc.id}" data-val="Closed">
              <span class="status-dot dot-closed"></span>
              <span class="status-closed-text">Closed</span>
            </div>
          </div>
        </div>
      </td>
      <td>
        ${isOpen ? '<span class="dash">—</span>' : `
          <div class="tbl-status-wrap" style="position:relative;">
            <div class="inline-dt" id="dd-${acc.id}">
              <span class="idt-icon"><i class="ph ph-calendar-blank"></i></span>
              <span>${dateDisp ? dateDisp.sub : 'Pick date'}</span>
            </div>
            <div class="dropdown cal-dropdown tbl-dt-dropdown" id="dc-${acc.id}">
              <div class="cal-header">
                <span class="cal-month-label" id="dcm-${acc.id}"></span>
                <div class="cal-nav">
                  <button class="cal-nav-btn" id="dcp-${acc.id}">&#8249;</button>
                  <button class="cal-nav-btn" id="dcn-${acc.id}">&#8250;</button>
                </div>
              </div>
              <div class="cal-grid" id="dcg-${acc.id}"></div>
              <div class="cal-footer">
                <span class="cal-link" id="dcc-${acc.id}">Clear</span>
                <span class="cal-link" id="dct-${acc.id}">Today</span>
              </div>
            </div>
          </div>
        `}
      </td>
      <td>
        ${isOpen ? '<span class="dash">—</span>' : `
          <div class="tbl-status-wrap" style="position:relative;">
            <div class="inline-dt" id="td-${acc.id}">
              <span class="idt-icon"><i class="ph ph-clock"></i></span>
              <span>${timeDisp || 'Pick time'}</span>
            </div>
            <div class="dropdown time-dropdown tbl-time-dropdown" id="tm-${acc.id}">
              <div class="time-picker-inner">
                <div class="time-cols">
                  <div class="center-bar"></div>
                  <div class="time-col" id="th-${acc.id}"></div>
                  <div class="time-divider"></div>
                  <div class="time-col" id="tm2-${acc.id}"></div>
                  <div class="time-divider"></div>
                  <div class="time-col" id="tp-${acc.id}"></div>
                </div>
              </div>
            </div>
          </div>
        `}
      </td>
      <td><button class="btn-delete" data-id="${acc.id}"><i class="ph ph-trash"></i> Delete</button></td>
    `;
    accountsBody.appendChild(tr);

    /* Status dropdown */
    const sb = document.getElementById('sb-'+acc.id);
    const sd = document.getElementById('sd-'+acc.id);
    if (sb && sd) {
      registerDropdown(sb, sd);
      sd.querySelectorAll('.status-option').forEach(opt => {
        opt.addEventListener('click', async ev => {
          ev.stopPropagation();
          await handleTblStatusChange(acc.id, opt.dataset.val);
          closeAllDropdowns();
        });
      });
    }

    if (!isOpen) {
      /* Table date dropdown */
      const dd = document.getElementById('dd-'+acc.id);
      const dc = document.getElementById('dc-'+acc.id);
      if (dd && dc) {
        let tblCalY, tblCalM;
        const curDateObj = isoToDateObj(acc.date);
        registerDropdown(dd, dc, () => {
          const ref = curDateObj || weekAhead();
          tblCalY=ref.y; tblCalM=ref.m;
          renderTblCal(acc.id, tblCalY, tblCalM, curDateObj);
        });
        document.getElementById('dcp-'+acc.id).addEventListener('click', ev => { ev.stopPropagation(); tblCalM--; if(tblCalM<0){tblCalM=11;tblCalY--;} renderTblCal(acc.id,tblCalY,tblCalM,isoToDateObj(acc.date)); });
        document.getElementById('dcn-'+acc.id).addEventListener('click', ev => { ev.stopPropagation(); tblCalM++; if(tblCalM>11){tblCalM=0;tblCalY++;} renderTblCal(acc.id,tblCalY,tblCalM,isoToDateObj(acc.date)); });
        document.getElementById('dcc-'+acc.id).addEventListener('click', ev => { ev.stopPropagation(); saveTblDate(acc.id,null); closeAllDropdowns(); });
        document.getElementById('dct-'+acc.id).addEventListener('click', ev => { ev.stopPropagation(); saveTblDate(acc.id,todayObj()); closeAllDropdowns(); });
      }

      /* Table time dropdown */
      const tdBtn = document.getElementById('td-'+acc.id);
      const tmDD  = document.getElementById('tm-'+acc.id);
      if (tdBtn && tmDD) {
        const curTO = storeToTimeObj(acc.time);
        registerDropdown(tdBtn, tmDD, () => {
          const h  = curTO ? curTO.h12  : '12';
          const mn = curTO ? curTO.min   : '00';
          const p  = curTO ? curTO.period: 'AM';
          renderTimePicker('th-'+acc.id, 'tm2-'+acc.id, 'tp-'+acc.id, h, mn, p, (nh,nm,np) => {
            const stored = timeObjToStore(nh,nm,np);
            const a = accounts.find(x=>x.id===acc.id);
            if (a) { a.time=stored; persist(); }
            const lbl = document.querySelector(`#td-${acc.id} span:last-child`);
            if (lbl) lbl.textContent=`${parseInt(nh)}:${nm} ${np}`;
            toast('Saved.');
          });
        });
      }
    }
  });

  accountsBody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

function renderTblCal(accId, y, m, selObj) {
  const lbl  = document.getElementById('dcm-'+accId);
  const grid = document.getElementById('dcg-'+accId);
  if (!lbl || !grid) return;
  lbl.textContent = `${MONTHS_FULL[m]} ${y}`;
  grid.innerHTML='';
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => { const el=document.createElement('div'); el.className='cal-dow'; el.textContent=d; grid.appendChild(el); });
  const firstDay    = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrev  = new Date(y,m,0).getDate();
  const today       = todayObj();
  for (let i=firstDay-1;i>=0;i--) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=daysInPrev-i; grid.appendChild(el); }
  for (let d=1;d<=daysInMonth;d++) {
    const el=document.createElement('div'); el.className='cal-day'; el.textContent=d;
    if (d===today.d&&m===today.m&&y===today.y) el.classList.add('today');
    if (selObj&&d===selObj.d&&m===selObj.m&&y===selObj.y) el.classList.add('selected');
    el.addEventListener('click', ev => { ev.stopPropagation(); saveTblDate(accId,{y,m,d}); closeAllDropdowns(); });
    grid.appendChild(el);
  }
  const rem=(7-(firstDay+daysInMonth)%7)%7;
  for (let d=1;d<=rem;d++) { const el=document.createElement('div'); el.className='cal-day other-month'; el.textContent=d; grid.appendChild(el); }
}

function saveTblDate(accId, dateObj) {
  const acc = accounts.find(a=>a.id===accId);
  if (!acc) return;
  acc.date = dateObj ? dateObjToISO(dateObj) : '';
  persist(); renderTable(); toast('Date saved.');
}

async function handleTblStatusChange(id, newStatus) {
  const acc = accounts.find(a=>a.id===id);
  if (!acc) return;
  acc.status = newStatus;
  if (newStatus==='Open') { acc.date=''; acc.time=''; }
  else { acc.date=dateObjToISO(weekAhead()); const n=nowHM(); acc.time=`${String(n.h).padStart(2,'0')}:${String(n.min).padStart(2,'0')}`; }
  persist(); renderTable();
  toast(newStatus==='Closed' ? 'Marked as Closed.' : 'Marked as Open.');
}

async function handleDelete(id) {
  const acc = accounts.find(a=>a.id===id);
  if (!acc) return;
  const ok = await showConfirm({ title:'Delete account?', email:acc.email, msg:'This will be removed permanently.', okLabel:'Delete', danger:true });
  if (!ok) return;
  accounts=accounts.filter(a=>a.id!==id); persist(); renderTable(); toast('Deleted.');
}

/* ── Form Save ── */
const inputEmail = document.getElementById('inputEmail');
const btnSave    = document.getElementById('btnSave');

btnSave.addEventListener('click', handleSave);
inputEmail.addEventListener('keydown', e => { if (e.key==='Enter') handleSave(); });

function handleSave() {
  const email = inputEmail.value.trim();
  if (!email)          { toast('Enter an email address.');        inputEmail.focus(); return; }
  if (!isEmail(email)) { toast('Enter a valid email address.');   inputEmail.focus(); return; }
  if (formStatus==='Closed' && !formDateObj)              { toast('Pick an open date.'); return; }
  if (formStatus==='Closed' && (!formTimeH||!formTimeMin)){ toast('Pick an open time.'); return; }
  if (accounts.find(a=>a.email.toLowerCase()===email.toLowerCase())) { toast('Email already exists.'); return; }

  const dateISO  = formStatus==='Closed' ? dateObjToISO(formDateObj) : '';
  const timeStore= formStatus==='Closed' ? timeObjToStore(formTimeH,formTimeMin,formTimePeriod) : '';
  accounts.push({ id:uid(), email, status:formStatus, date:dateISO, time:timeStore });
  persist(); renderTable();
  addPanel.classList.remove('visible');
  resetForm();
  toast('Account saved.');
}

function resetForm() {
  inputEmail.value='';
  setFormStatus('Open');
  formDateObj=null; formTimeH=null; formTimeMin=null; formTimePeriod=null;
  setFormDate(null);
  setFormTime(null,null,null);
  dateTimeGroup.classList.add('hidden');
}

/* ── Init ── */
renderTable();

/* ── Tab switching ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    closeAllDropdowns();
  });
});
