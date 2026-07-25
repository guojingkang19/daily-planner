
const db = new TaskDB();
let detailDate = new Date(), calYear, calMonth, editTaskId = null;
let gestures = null, reminderTaskId = null;
let listMode = ''; // 'future' or 'past'

const fr = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const HOL = {};
[[1,1,'元旦'],[2,14,'情人节'],[3,8,'妇女节'],[5,1,'劳动节'],[6,1,'儿童节'],[7,1,'建党节'],[8,1,'建军节'],[9,10,'教师节'],[10,1,'国庆节'],[12,25,'圣诞节']]
  .forEach(([m,d,n]) => { HOL[(m<10?'0':'')+m+'-'+(d<10?'0':'')+d] = n; });
const getHol = (m,d) => HOL[(m<10?'0':'')+m+'-'+(d<10?'0':'')+d]||null;
const WF = ['日','一','二','三','四','五','六'];

function _uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const el = {};
'homeView,calendarBtn,todayCard,todayStar,todayDate,todaySub,todayCount,todayEn,futureCard,futureDesc,futureEn,pastCard,pastDesc,pastEn,listView,listBack,listTitle,listDateList,listAddBtn,detailView,backBtn,detailDateTitle,detailDateSub,taskList,addInput,addBtn,calTitle,calGrid,calPrev,calNext,calToday,calModal,reminderModal,reminderInput,reminderConfirm,reminderCancel,editModal,editInput,editConfirm,editCancel'
  .split(',').forEach(id => { el[id] = document.getElementById(id.replace(/([A-Z])/g,'-$1').toLowerCase()); });

async function init() {
  await db.init();
  gestures = new Gestures({ onReorder: handleReorder });

  el.calendarBtn.onclick = openCalendar;
  el.todayCard.onclick = () => gotoDate(new Date());
  el.futureCard.onclick = () => showList('future');
  el.pastCard.onclick = () => showList('past');
  el.backBtn.onclick = showHome;
  el.listBack.onclick = showHome;
  el.listAddBtn.onclick = () => { if (listMode) addNewFutureDate(listMode); };

  el.addBtn.onclick = addTask;
  el.addInput.onkeydown = e => { if (e.key==='Enter') addTask(); };
  el.calPrev.onclick = () => { calMonth--; if(calMonth<0){calMonth=11;calYear--} renderCalendar(); };
  el.calNext.onclick = () => { calMonth++; if(calMonth>11){calMonth=0;calYear++} renderCalendar(); };
  el.calToday.onclick = () => { closeCalendar(); gotoDate(new Date()); };
  el.reminderCancel.onclick = () => el.reminderModal.classList.add('hidden');
  el.reminderConfirm.onclick = confirmReminder;
  el.editCancel.onclick = () => el.editModal.classList.add('hidden');
  el.editConfirm.onclick = confirmEdit;
  document.querySelectorAll('.modal-overlay').forEach(o => o.onclick = function(){ this.closest('.modal').classList.add('hidden'); });

  if ('Notification' in window && Notification.permission==='default') Notification.requestPermission();
  setInterval(checkReminders, 30000);
  setInterval(renderHome, 60000);
  checkReminders(); cleanupOldData();
  let t = new Date(); t.setHours(0,0,0,0);
  calYear = t.getFullYear(); calMonth = t.getMonth();
  renderHome();
  
  
  // Register service worker for offline & install
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }history.pushState({page:'home'},'');
  window.addEventListener('popstate', function(e) {
    if (el.detailView.classList.contains('active')) { showHome(); }
    else if (el.listView.classList.contains('active')) { showHome(); }
    else { 
  history.pushState({page:'home'},''); }
  });
}

function renderHome() {
  let t = new Date(); t.setHours(0,0,0,0);
  let hol = getHol(t.getMonth()+1, t.getDate());
  el.todayDate.textContent = (t.getMonth()+1)+'\u6708'+t.getDate()+'\u65e5 \u661f\u671f'+WF[t.getDay()];
  el.todaySub.textContent = t.getFullYear()+'\u5e74'+(hol?' \u00b7 '+hol:'');
  // Count future and past dates with tasks
  db.getAllTasks().then(all => {
    let futureSet = new Set(), pastSet = new Set();
    let todayCount = 0;
    all.forEach(tk => {
      if (tk.completed) return;
      let dt = new Date(tk.date+'T00:00:00'), diff = Math.round((dt-t)/86400000);
      if (diff===0) todayCount++;
      else if (diff>0 && diff<=365) futureSet.add(tk.date);
      else if (diff<0 && diff>=-60) pastSet.add(tk.date);
    });
    el.todayCount.textContent = '\u4eca\u5929 '+todayCount+' \u9879\u8ba1\u5212';
  el.todayEn.textContent = 'today';
    el.futureDesc.textContent = futureSet.size+' \u5929\u6709\u8ba1\u5212';
    el.futureEn.textContent = 'future';
    el.pastDesc.textContent = pastSet.size+' \u5929\u6709\u8ba1\u5212';
    el.pastEn.textContent = 'past';
  });
}

async function showList(mode) {
  listMode = mode;
  el.homeView.classList.remove('active');
  el.detailView.classList.remove('active');
  el.listView.classList.add('active');
  el.listTitle.textContent = mode==='future' ? '\u672a\u6765\u8ba1\u5212' : '\u8fc7\u53bb\u8ba1\u5212';
  el.listAddBtn.onclick = () => addNewFutureDate(mode);

  
  history.pushState({page:'list'},'');

  let t = new Date(); t.setHours(0,0,0,0);
  let all = await db.getAllTasks();
  let dateMap = {};
  all.forEach(tk => { if (!tk.completed) { dateMap[tk.date] = (dateMap[tk.date]||0)+1; } });

  let dates = Object.keys(dateMap).filter(ds => {
    let dt = new Date(ds+'T00:00:00'), diff = Math.round((dt-t)/86400000);
    if (mode==='future') return diff>0 && diff<=365;
    else return diff<0 && diff>=-60;
  }).sort((a,b) => mode==='future' ? new Date(a)-new Date(b) : new Date(b)-new Date(a));

  el.listDateList.innerHTML = '';
  dates.forEach(ds => {
    let dt = new Date(ds+'T00:00:00'), cnt = dateMap[ds];
    let card = document.createElement('div'); card.className = 'date-card';
    let info = document.createElement('div'); info.className = 'date-card-info';
    let ym = dt.getFullYear()===t.getFullYear()?'':dt.getFullYear()+'\u5e74';
    let hol = getHol(dt.getMonth()+1, dt.getDate());
    let dl = document.createElement('div'); dl.className = 'date-card-date';
    dl.textContent = ym+(dt.getMonth()+1)+'\u6708'+dt.getDate()+'\u65e5 \u661f\u671f'+WF[dt.getDay()];
    if (hol) { let h = document.createElement('span'); h.className = 'holiday'; h.textContent = hol; dl.appendChild(h); }
    let sl = document.createElement('div'); sl.className = 'date-card-sub';
    let cs = document.createElement('span'); cs.className = 'task-count'; cs.textContent = cnt+'\u9879\u8ba1\u5212'; sl.appendChild(cs);
    info.append(dl, sl);
    let arrow = document.createElement('div'); arrow.className = 'date-card-arrow'; arrow.textContent = '\u203a';
    card.append(info, arrow);
    card.onclick = () => gotoDate(dt);
    el.listDateList.appendChild(card);
  });
  if (!dates.length) {
    let e = document.createElement('div'); e.style.cssText = 'text-align:center;color:#C7C7CC;font-size:14px;margin-top:40px';
    e.textContent = '\u6682\u65e0\u8ba1\u5212'; el.listDateList.appendChild(e);
  }
}

async function gotoDate(dt) {
  detailDate = new Date(dt); detailDate.setHours(0,0,0,0);
  el.homeView.classList.remove('active'); el.listView.classList.remove('active');
  el.detailView.classList.add('active');
  
  history.pushState({page:'detail'},'');
  renderDetail();
}

function showHome() {
  el.homeView.classList.add('active'); el.listView.classList.remove('active'); el.detailView.classList.remove('active');
  renderHome();
}

async function renderDetail() {
  let dt = detailDate, t = new Date(); t.setHours(0,0,0,0);
  let isT = +dt===+t, hol = getHol(dt.getMonth()+1, dt.getDate());
  el.detailDateTitle.textContent = (dt.getMonth()+1)+'\u6708'+dt.getDate()+'\u65e5 \u661f\u671f'+WF[dt.getDay()]+(isT?' \u00b7 \u4eca\u5929':'');
  el.detailDateSub.textContent = dt.getFullYear()+'\u5e74'+(hol?' \u00b7 '+hol:'');
  let tasks = await db.getTasks(fr(dt));
  el.taskList.innerHTML = '';
  if (!tasks.length) {
    let e = document.createElement('div'); e.style.cssText = 'text-align:center;color:#C7C7CC;font-size:14px;margin-top:40px';
    e.textContent = '\u6682\u65e0\u8ba1\u5212\uff0c\u5728\u4e0b\u65b9\u6dfb\u52a0'; el.taskList.appendChild(e);
    return;
  }
  tasks.forEach(tk => {
    let w = document.createElement('div'); w.className = 'card-wrapper';
    let acts = document.createElement('div'); acts.className = 'card-actions';
    function makeBtn(html, cls) {
      let b = document.createElement('button'); b.innerHTML = html;
      b.className = 'card-action ' + cls; 
      b.dataset.act = cls.replace('act-', '');
      return b;
    }
    let delBtn = makeBtn('\u2716', 'act-del');
    let doneBtn = makeBtn(tk.completed ? '\u21a9\ufe0f' : '\u2714\ufe0f', 'act-done');
    let remBtn = makeBtn('\u23f0', 'act-rem');
    let edtBtn = makeBtn('\u270f\ufe0f', 'act-edt');
    acts.append(delBtn, doneBtn, remBtn, edtBtn);
    let c = document.createElement('div'); c.className = 'task-card' + (tk.completed ? ' completed' : '');
    c.dataset.taskId = tk.id;
    let inn = document.createElement('div'); inn.className = 'card-inner';
    let g = document.createElement('div'); g.className = 'grip'; g.textContent = '\u22ee\u22ee';
    let tx = document.createElement('span'); tx.className = 'task-text'; tx.textContent = tk.text;
    if (tk.completed) tx.style.textDecoration = 'line-through';
    let b = document.createElement('span'); b.className = 'reminder-badge';
    if (tk.reminder) {
      let rd = new Date(tk.reminder), p = n => String(n).padStart(2,'0');
      b.textContent = '🔔 ' + p(rd.getHours()) + ':' + p(rd.getMinutes());
      b.style.display = 'inline-block';
    }
    inn.append(g, tx, b, acts); c.appendChild(inn); w.appendChild(c); el.taskList.appendChild(w);
    gestures.attachCard(c, tk.id);
  
  });
}

  // Action button delegation
  document.getElementById('task-list').addEventListener('click', function(ev) {
    var btn = ev.target.closest('.card-action');
    if (!btn) return;
    var card = btn.closest('.task-card');
    if (!card) return;
    var id = card.dataset.taskId;
    var act = btn.dataset.act;
    if (act === 'del') deleteTask(id);
    else if (act === 'done') { db.getTasks(fr(detailDate)).then(function(ts){ ts.forEach(function(t){ if(t.id===id) toggleComplete(id,!t.completed); }); }); }
    else if (act === 'rem') openReminder(id);
    else if (act === 'edt') { db.getTasks(fr(detailDate)).then(function(ts){ ts.forEach(function(t){ if(t.id===id) openEdit(id,t.text); }); }); }
  });
async function openCalendar() {
  let t = new Date(); calYear = t.getFullYear(); calMonth = t.getMonth();
  await renderCalendar(); el.calModal.classList.remove('hidden');
}
function closeCalendar() { el.calModal.classList.add('hidden'); }

async function renderCalendar() {
  let t = new Date(); t.setHours(0,0,0,0);
  el.calTitle.textContent = calYear+'\u5e74'+(calMonth+1)+'\u6708';
  el.calGrid.innerHTML = '';
  let all = await db.getAllTasks();
  let dw = new Set(); all.forEach(tk => dw.add(fr(new Date(tk.date+'T00:00:00'))));
  let fd = new Date(calYear, calMonth, 1), ld = new Date(calYear, calMonth+1, 0), sp = fd.getDay();
  let pl = new Date(calYear, calMonth, 0);
  for (let i = sp-1; i >= 0; i--) {
    let d = document.createElement('div'); d.className = 'cal-day other-month'; d.textContent = pl.getDate()-i;
    el.calGrid.appendChild(d);
  }
  for (let day = 1; day <= ld.getDate(); day++) {
    let dt = new Date(calYear, calMonth, day), fs = fr(dt);
    let d = document.createElement('div'); d.className = 'cal-day';
    if (+dt===+t) d.classList.add('is-today');
    if (dw.has(fs)) d.classList.add('has-tasks');
    d.textContent = day;
    d.onclick = () => { closeCalendar(); gotoDate(dt); };
    el.calGrid.appendChild(d);
  }
  let tc = sp + ld.getDate(), rm = (7 - tc%7) % 7;
  for (let day = 1; day <= rm; day++) {
    let d = document.createElement('div'); d.className = 'cal-day other-month'; d.textContent = day;
    el.calGrid.appendChild(d);
  }
}

async function addTask() {
  let txt = el.addInput.value.trim(); if (!txt) return;
  let fs = fr(detailDate), tasks = await db.getTasks(fs);
  await db.addTask({ id: _uuid(), text: txt, date: fs, completed: false, reminder: null, order: tasks.length, createdAt: new Date().toISOString() });
  el.addInput.value = ''; renderDetail();
  renderHome();
}
async function deleteTask(id) { await db.deleteTask(id); renderDetail(); renderHome(); }
async function toggleComplete(id, v) { await db.updateTask(id, { completed: v }); if (v && navigator.vibrate) navigator.vibrate(15); renderDetail(); renderHome(); }
async function handleReorder(tid, oids) {
  oids.forEach((id,i) => { if (id!==tid) db.updateTask(id, { order: i }); });
  db.updateTask(tid, { order: oids.indexOf(tid) });
}

function openReminder(id) {
  reminderTaskId = id; let d = new Date(); d.setMinutes(d.getMinutes()+30);
  let p = n => String(n).padStart(2,'0');
  el.reminderInput.value = p(d.getHours())+':'+p(d.getMinutes());
  el.reminderModal.classList.remove('hidden');
}
async function confirmReminder() {
  let v = el.reminderInput.value; if (!v) return;
  let [h,m] = v.split(':').map(Number), d = new Date(detailDate); d.setHours(h,m,0,0);
  await db.updateTask(reminderTaskId, { reminder: d.toISOString() });
  el.reminderModal.classList.add('hidden'); reminderTaskId = null; renderDetail();
}
function openEdit(id, txt) { editTaskId = id; el.editInput.value = txt; el.editModal.classList.remove('hidden'); setTimeout(()=>el.editInput.focus(), 100); }
async function confirmEdit() {
  let txt = el.editInput.value.trim(); if (!txt || !editTaskId) return;
  await db.updateTask(editTaskId, { text: txt }); el.editModal.classList.add('hidden'); editTaskId = null; renderDetail();
}



 async function addNewFutureDate(mode) {
   var all = await db.getAllTasks();
   var now = new Date();
   var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
   // Collect all dates that already have tasks (to skip them)
   var plannedDates = new Set();
   all.forEach(function(tk) {
     if (!tk.completed) plannedDates.add(tk.date);
   });
   if (mode === 'future') {
     var target = new Date(today);
     target.setDate(target.getDate() + 1);
     while (plannedDates.has(fr(target))) {
       target.setDate(target.getDate() + 1);
     }
     gotoDate(target);
   } else {
     var target = new Date(today);
     target.setDate(target.getDate() - 1);
     while (plannedDates.has(fr(target))) {
       target.setDate(target.getDate() - 1);
     }
     gotoDate(target);
   }
 }

async function checkReminders() {
  if (!('Notification' in window) || Notification.permission!=='granted') return;
  let t = new Date(); t.setHours(0,0,0,0); let all = await db.getAllTasks();
  let ad = new Map(); all.forEach(tk => { if (!tk.completed) { let c = ad.get(tk.date)||0; ad.set(tk.date, c+1); } });
  for (let [ds, cnt] of ad) {
    let dt = new Date(ds+'T00:00:00'); if (dt <= t) continue;
    let du = Math.round((dt - t) / 86400000);
    if (du===30 && !localStorage.getItem('r30_'+ds)) { showNotif('日程提醒', dt.getFullYear()+'年'+(dt.getMonth()+1)+'月'+dt.getDate()+'日有'+cnt+'项计划，还有一个月'); if (navigator.vibrate) navigator.vibrate([200,100,200]); localStorage.setItem('r30_'+ds, '1'); }
    if (du===15 && !localStorage.getItem('r15_'+ds)) { showNotif('日程提醒', dt.getFullYear()+'年'+(dt.getMonth()+1)+'月'+dt.getDate()+'日有'+cnt+'项计划，还有半个月'); if (navigator.vibrate) navigator.vibrate([200,100,200]); localStorage.setItem('r15_'+ds, '1'); }
    if (du===7 && !localStorage.getItem('r7_'+ds)) { showNotif('日程提醒', dt.getFullYear()+'年'+(dt.getMonth()+1)+'月'+dt.getDate()+'日的计划已安排至主页'); if (navigator.vibrate) navigator.vibrate([200,100,200]); localStorage.setItem('r7_'+ds, '1'); }
  }
  all.forEach(tk => {
    if (!tk.reminder || tk.completed) return;
    let rt = new Date(tk.reminder);
    if (rt <= new Date() && rt > new Date(Date.now()-31000)) {
      if (navigator.vibrate) navigator.vibrate([200,100,200]);
      showNotif('日程提醒', tk.text);
    }
  });
}
function showNotif(t, b) { try { new Notification(t, { body: b, vibrate: [200,100,200], requireInteraction: true, data: { url: '.' } }); } catch(e) {} }

async function cleanupOldData() {
  let co = new Date(); co.setMonth(co.getMonth()-2);
  let fu = new Date(); fu.setFullYear(fu.getFullYear()+1);
  for (let t of await db.getAllTasks()) {
    let td = new Date(t.date+'T00:00:00');
    if (td<co || td>fu) await db.deleteTask(t.id);
  }
}



document.addEventListener('DOMContentLoaded', init);
