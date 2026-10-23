(() => {
'use strict';
const CFG = window.AM_CONFIG;
const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
const BUCKET = CFG.bucket;

const STATUSES = [
  { id: 'doing', name: 'მზადდება' },
  { id: 'review', name: 'მზადაა' },
  { id: 'done', name: 'დაიდო' }];
const stOf = t => STATUSES.some(x => x.id === t.status) ? t.status : 'doing';
const PRIOS = { high: 'მაღალი', mid: 'საშუალო', low: 'დაბალი' };
const CATS = { auto: 'ავტომობილები', industry: 'ავტოინდუსტრია', road: 'გზები და მოძრაობა', transport: 'ტრანსპორტი', motorsport: 'მოტორსპორტი' };
const GEOS = { ge: 'საქართველო', world: 'მსოფლიო' };
const MAX = CFG.maxFileBytes, MAX_SVG = 2 * 1024 * 1024;

const S = {
  me: null, email: '', isOwner: false, tasks: [], chat: [], news: [], history: [], ideas: [], newsMeta: null, profiles: {}, members: [],
  view: 'board', q: '', open: null, comments: [], designs: [], uploads: [], draftFiles: { task: [], chat: [] },
  quickCol: null, seenChat: 0, seenNews: 0, confirmDel: false, settings: false,
  histOpen: false, ideasOpen: false, nDay: null, nCat: 'all', nSrc: 'all', nGeo: 'all', urlVer: 0
};

const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return e;
};
const icon = p => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '14'); s.setAttribute('height', '14');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = p; return s; };
const I = { img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5L5 20"/>',
  msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', clip: '<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', dl: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', up: '<path d="M12 19V5m0 0-5 5m5-5 5 5"/>', check: '<path d="m5 12 5 5L20 7"/>' };

const ms = t => typeof t === 'number' ? t : (Date.parse(t) || 0);
const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B';
const ext = n => ((n || '').split('.').pop() || '').toUpperCase().slice(0, 5);
const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const MONTHS_FULL = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const fmtDate = d => { const x = new Date(d + 'T00:00'); return isNaN(x) ? '' : x.getDate() + ' ' + MONTHS[x.getMonth()]; };
const tbDate = t => { const v = ms(t); return v ? new Date(v + 4 * 3600e3).toISOString().slice(0, 10) : ''; };
const tbTime = t => { const v = ms(t); return v ? new Date(v + 4 * 3600e3).toISOString().slice(11, 16) : ''; };
const todayTb = () => tbDate(Date.now());
const fmtTime = t => { const d = tbDate(t); if (!d) return ''; const x = new Date(d + 'T00:00');
  return (d === todayTb() ? 'დღეს' : x.getDate() + ' ' + MONTHS[x.getMonth()]) + ' ' + tbTime(t); };
const dayLabel = d => { const t = todayTb(); const y = tbDate(Date.now() - 864e5); if (d === t) return 'დღეს'; if (d === y) return 'გუშინ'; const x = new Date(d + 'T00:00'); return x.getDate() + ' ' + MONTHS[x.getMonth()]; };
let toastT; const toast = m => { document.querySelectorAll('.toast').forEach(e => e.remove()); const t = h('div', { class: 'toast', role: 'status', text: m }); document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3400); };
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const safeName = n => (n || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file';
const errText = e => { const m = (e && (e.message || e.error_description || e.error)) || ''; if (/exceeded the maximum|too large|Payload too large/i.test(m)) return 'ფაილი ძალიან დიდია (50 MB-მდე)';
  if (/row-level security|permission|not allowed|JWT/i.test(m)) return 'ამის უფლება არ გაქვს'; if (/fetch|network/i.test(m)) return 'ინტერნეტთან კავშირი ვერ მოხერხდა'; return m ? 'შეცდომა: ' + m : 'ვერ მოხერხდა, სცადე თავიდან'; };

/* ---------- signed URLs for private files (originals, never transformed) ---------- */
const URLS = {}; const pend = new Set(); let flushT = null;
function surl(path) {
  if (!path) return '';
  const c = URLS[path];
  if (c && c.exp > Date.now()) return c.url;
  pend.add(path); if (!flushT) flushT = setTimeout(flushUrls, 0);
  return c ? c.url : '';
}
async function flushUrls() {
  flushT = null; const paths = [...pend]; pend.clear(); if (!paths.length) return;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const now = Date.now();
  paths.forEach(p => { URLS[p] = { url: '', exp: now + 60e3 }; });
  (data || []).forEach(d => { if (d.signedUrl && d.path) URLS[d.path] = { url: d.signedUrl, exp: now + 3300e3 }; });
  S.urlVer++; render();
}

/* ---------- people ---------- */
const profSig = () => Object.values(S.profiles).map(p => p.id + ':' + p.name).join('|');
const nameOf = id => { const p = S.profiles[id]; return p ? (p.name || (p.email || '').split('@')[0] || 'მომხმარებელი') : (id ? 'მომხმარებელი' : 'გუნდი'); };
const COLORS = ['#e0263a', '#2563c9', '#a8641c', '#1e8a55', '#7b4fd6', '#0e7490', '#be185d'];
const colorOf = id => { let n = 0; for (const c of (id || '')) n = (n * 31 + c.charCodeAt(0)) >>> 0; return COLORS[n % COLORS.length]; };
function avatar(id) { const a = h('div', { class: 'av' }); a.textContent = (nameOf(id).trim().charAt(0) || '?').toUpperCase(); a.style.background = colorOf(id); return a; }

/* ---------- data ---------- */
const DB = {
  async tasks() { const { data, error } = await sb.from('tasks').select('*').order('updated_at', { ascending: false }); if (!error) S.tasks = data; },
  async chat() { const { data, error } = await sb.from('chat').select('*').order('created_at', { ascending: false }).limit(500); if (!error) S.chat = data.reverse(); },
  async news() { const since = new Date(Date.now() - 30 * 864e5).toISOString(); const { data, error } = await sb.from('news').select('*').gte('published_at', since).order('published_at', { ascending: false }).limit(1000); if (!error) S.news = data; },
  async ideas() { const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10); const { data, error } = await sb.from('ideas').select('*').gte('day', since).order('day', { ascending: false }).order('slot'); if (!error) S.ideas = data; },
  async history() { const { data, error } = await sb.from('history').select('*'); if (!error) S.history = data; },
  async meta() { const { data } = await sb.from('meta').select('*').eq('key', 'news').maybeSingle(); S.newsMeta = data ? data.value : null; },
  async profiles() { const { data, error } = await sb.from('profiles').select('id,name,email'); if (!error) { S.profiles = {}; data.forEach(p => S.profiles[p.id] = p); } },
  async members() { const { data, error } = await sb.from('members').select('*').order('added_at'); if (!error) S.members = data; },
  async comments() { if (!S.open) return; const id = S.open; const { data, error } = await sb.from('comments').select('*').eq('task_id', id).order('created_at'); if (!error && S.open === id) S.comments = data; },
  async designs() { if (!S.open) return; const id = S.open; const { data, error } = await sb.from('designs').select('*').eq('task_id', id).order('version', { ascending: false }); if (!error && S.open === id) S.designs = data; }
};
const reloadT = {};
function reload(name) { clearTimeout(reloadT[name]); reloadT[name] = setTimeout(async () => { await DB[name](); render(); }, 150); }

/* ---------- render ---------- */
function render() {
  if ($('#app').hidden) return;
  $('#tab-board').setAttribute('aria-selected', S.view === 'board'); $('#tab-news').setAttribute('aria-selected', S.view === 'news');
  const nNew = S.news.filter(n => ms(n.fetched_at) > S.seenNews).length; const nd = $('#news-dot'); nd.hidden = !nNew || S.view === 'news'; nd.textContent = nNew;
  const me = $('#me-btn'); me.textContent = (nameOf(S.me).charAt(0) || '?').toUpperCase(); me.style.background = colorOf(S.me);
  const main = $('#main');
  if (S.view === 'news') renderNews(main); else renderBoard(main);
  renderDrawer(); renderSettings();
}

function renderBoard(main) {
  const bsig = JSON.stringify([S.tasks, S.q, S.quickCol, S.urlVer, profSig()]);
  if (main.querySelector('.board-wrap,.empty-board h2') && bsig === S._bSig) return; S._bSig = bsig;
  const keepScroll = main.querySelector('.board-wrap')?.scrollLeft || 0;
  const oldQ = main.querySelector('.quick textarea'); const qv = oldQ ? oldQ.value : ''; const qFocused = !oldQ || document.activeElement === oldQ;
  const colScroll = {}; main.querySelectorAll('.cards').forEach(c => colScroll[c.dataset.s] = c.scrollTop);
  const q = S.q.trim().toLowerCase();
  const tasks = S.tasks.filter(t => !q || (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
  if (!S.tasks.length && S.quickCol == null) {
    main.replaceChildren(h('div', { class: 'empty-board' },
      h('h2', { text: 'დაფა ჯერ ცარიელია' }),
      h('p', { text: 'დაამატე პირველი თასქი: მაგალითად „ბანერი ახალი სერვისისთვის“. დიზაინერი თასქში ატვირთავს მზა ფაილებს ორიგინალი ხარისხით, თქვენ კი იქვე დაუწერთ კომენტარს.' }),
      h('button', { class: 'btn primary', onclick: () => { S.quickCol = 'doing'; render(); } }, icon(I.plus), 'პირველი თასქის დამატება')));
    return;
  }
  const wrap = h('div', { class: 'board-wrap' }); const board = h('div', { class: 'board' }); wrap.append(board);
  for (const st of STATUSES) {
    const list = tasks.filter(t => stOf(t) === st.id).sort((a, b) => ms(b.updated_at) - ms(a.updated_at));
    const cards = h('div', { class: 'cards', 'data-s': st.id });
    list.forEach(t => cards.append(card(t)));
    const col = h('section', { class: 'col', 'aria-label': st.name },
      h('div', { class: 'col-head' }, h('span', { class: 'pill st-' + st.id }, h('i'), st.name), h('span', { class: 'count mono', text: list.length }), h('div', { class: 'grow' }),
        h('button', { class: 'icon-btn', title: 'თასქის დამატება', onclick: () => { S.quickCol = st.id; render(); } }, icon(I.plus))), cards);
    if (S.quickCol === st.id) col.append(quickForm(st.id));
    else col.append(h('button', { class: 'add-row', onclick: () => { S.quickCol = st.id; render(); } }, icon(I.plus), 'ახალი თასქი'));
    col.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/task')) { e.preventDefault(); col.classList.add('drop'); } });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('drop'); const id = e.dataTransfer.getData('text/task'); if (id) setStatus(id, st.id); });
    board.append(col);
  }
  main.replaceChildren(wrap); wrap.scrollLeft = keepScroll;
  main.querySelectorAll('.cards').forEach(c => { if (colScroll[c.dataset.s]) c.scrollTop = colScroll[c.dataset.s]; });
  const qa = main.querySelector('.quick textarea'); if (qa) { qa.value = qv; if (qFocused && !S.open && !S.settings) qa.focus(); }
}

function card(t) {
  const c = h('button', { class: 'card', draggable: 'true', onclick: () => openTask(t.id) });
  if (t.cover_path) { const u = surl(t.cover_path); c.append(h('div', { class: 'cover', style: u ? `background-image:url("${u}")` : null })); }
  const meta = h('div', { class: 'meta' });
  if (t.prio) meta.append(h('span', { class: 'prio prio-' + t.prio, text: PRIOS[t.prio] }));
  if (t.due) meta.append(h('span', { class: t.due < todayTb() && stOf(t) !== 'done' ? 'overdue' : '' }, icon(I.cal), fmtDate(t.due)));
  if (t.design_count) meta.append(h('span', { title: 'დიზაინები' }, icon(I.img), h('span', { class: 'mono', text: t.design_count })));
  if (t.comment_count) meta.append(h('span', { title: 'კომენტარები' }, icon(I.msg), h('span', { class: 'mono', text: t.comment_count })));
  c.append(h('div', { class: 'card-body' }, h('div', { class: 'card-title', text: t.title || 'უსათაურო' }), meta.childNodes.length ? meta : null));
  c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/task', t.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  c.addEventListener('dragend', () => c.classList.remove('dragging'));
  return c;
}
function quickForm(st) {
  const ta = h('textarea', { id: 'quick-' + st, placeholder: 'თასქის სახელი…', rows: 2 });
  const submit = async () => { const v = ta.value.trim(); if (!v) { S.quickCol = null; render(); return; } ta.value = ''; await createTask({ title: v, status: st }); ta.focus(); };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === 'Escape') { S.quickCol = null; render(); } });
  return h('div', { class: 'quick' }, ta, h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: submit }, 'დამატება'), h('button', { class: 'btn ghost', onclick: () => { S.quickCol = null; render(); } }, 'გაუქმება')));
}

/* ---------- task drawer ---------- */
function renderDrawer() {
  const layer = $('#layer'); const t = S.open && S.tasks.find(x => x.id === S.open);
  if (!t) { S._dSig = null; layer.querySelectorAll('.drawer').forEach(e => e.remove()); if (!S.settings) layer.querySelectorAll('.scrim').forEach(e => e.remove()); return; }
  const sig = JSON.stringify([t, S.comments, S.designs, S.uploads, S.draftFiles.task, S.confirmDel, S.urlVer, profSig()]);
  if (layer.querySelector('.drawer') && sig === S._dSig) return; S._dSig = sig;
  const dr = layer.querySelector('.drawer'); const prevScroll = dr?.querySelector('.d-scroll')?.scrollTop || 0;
  const active = document.activeElement; const activeId = active && dr && dr.contains(active) ? active.id : null; const selStart = activeId && active.selectionStart;
  const keep = {}; if (dr) dr.querySelectorAll('textarea,input').forEach(e => { if (e.id) keep[e.id] = e.value; });

  const title = h('textarea', { class: 'd-title', id: 'd-title', rows: 1, 'aria-label': 'თასქის სახელი' }); title.value = keep['d-title'] ?? t.title ?? '';
  const fit = () => { title.style.height = 'auto'; title.style.height = title.scrollHeight + 'px'; };
  title.addEventListener('input', fit); title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('blur', () => { const v = title.value.trim(); if (v && v !== t.title) patch(t.id, { title: v }); });
  const sSel = h('select', { id: 'd-status' }, STATUSES.map(s => h('option', { value: s.id, selected: stOf(t) === s.id }, s.name))); sSel.addEventListener('change', () => setStatus(t.id, sSel.value));
  const pSel = h('select', { id: 'd-prio' }, h('option', { value: '' }, '—'), Object.entries(PRIOS).map(([k, v]) => h('option', { value: k, selected: t.prio === k }, v))); pSel.addEventListener('change', () => patch(t.id, { prio: pSel.value }));
  const due = h('input', { type: 'date', id: 'd-due', value: t.due || '' }); due.addEventListener('change', () => patch(t.id, { due: due.value || null }));
  const desc = h('textarea', { class: 'desc', id: 'd-desc', placeholder: 'აღწერა: ზომები, ტექსტი, ფერები, რეფერენსები…' }); desc.value = keep['d-desc'] ?? t.description ?? '';
  desc.addEventListener('blur', () => { if (desc.value !== (t.description || '')) patch(t.id, { description: desc.value }); });

  const zone = h('div', { class: 'drop-zone' },
    h('div', {}, h('strong', { text: 'ჩააგდე ფაილი აქ' }), ' ან ', h('button', { class: 'btn', style: 'height:28px;margin-inline:4px', onclick: () => pick('design') }, icon(I.up), 'აირჩიე')),
    h('div', { style: 'font-size:12px', text: 'PNG · JPG · WEBP · SVG · PDF · ვიდეო — თითო ფაილი 50 MB-მდე. ასევე Ctrl+V ჩასმა.' }));
  wireDrop(zone, files => uploadDesigns(files));
  const ups = h('div', { class: 'uploading' }, S.uploads.filter(u => u.task === t.id).map(u => h('div', { class: 'up' }, h('div', { class: 'spin' }), h('span', { text: u.name }), h('b', { class: 'mono', text: fmtSize(u.size) }))));
  const grid = h('div', { class: 'designs' }, S.designs.map(designTile));
  const thread = h('div', { class: 'thread' }, S.comments.length ? S.comments.map(message) : h('div', { class: 'dz-sub', text: 'კომენტარები ჯერ არ არის. დაწერე, რა უნდა შეიცვალოს ან რა მოგეწონა.' }));
  const comp = composer('task', keep['c-task']);
  const delBtn = S.confirmDel ? h('span', { class: 'confirm' }, 'წავშალო თასქი?', h('button', { class: 'btn danger', onclick: () => deleteTask(t.id) }, 'წაშლა'), h('button', { class: 'btn ghost', onclick: () => { S.confirmDel = false; render(); } }, 'არა'))
    : h('button', { class: 'icon-btn', title: 'თასქის წაშლა', onclick: () => { S.confirmDel = true; render(); } }, icon(I.trash));
  const stName = STATUSES.find(s => s.id === stOf(t)).name;
  const newDr = h('aside', { class: dr ? 'drawer' : 'drawer enter', role: 'dialog', 'aria-label': t.title || 'თასქი' },
    h('div', { class: 'd-bar' }, h('span', { class: 'pill st-' + stOf(t) }, h('i'), stName), h('div', { class: 'grow' }), delBtn, h('button', { class: 'icon-btn', title: 'დახურვა (Esc)', onclick: closeTask }, icon(I.x))),
    h('div', { class: 'd-scroll' }, title,
      h('div', { class: 'props' },
        h('label', { for: 'd-status' }, 'სტატუსი'), sSel,
        h('label', { for: 'd-prio' }, 'პრიორიტეტი'), pSel,
        h('label', { for: 'd-due' }, 'ვადა'), due,
        h('span', { class: 'dz-sub' }, 'შექმნა'), h('span', { class: 'dz-sub' }, `${nameOf(t.created_by)} · ${fmtTime(t.created_at)}`)),
      desc,
      h('section', { class: 'sec' },
        h('div', { class: 'sec-head' }, h('h3', { text: 'დიზაინები' }), h('span', { class: 'count mono', text: S.designs.length }),
          h('span', { class: 'lossless', title: 'ფაილი ინახება ბაიტ-ბაიტ, შეკუმშვის გარეშე' }, icon(I.check), 'ორიგინალი ხარისხი, შეკუმშვის გარეშე')),
        zone, ups, grid),
      h('section', { class: 'sec' }, h('div', { class: 'sec-head' }, h('h3', { text: 'კომენტარები' }), h('span', { class: 'count mono', text: S.comments.length })), thread, comp)));
  if (!layer.querySelector('.scrim')) layer.append(h('div', { class: 'scrim', onclick: () => { if (S.settings) closeSettings(); else closeTask(); } }));
  if (dr) dr.replaceWith(newDr); else layer.append(newDr);
  fit(); newDr.querySelector('.d-scroll').scrollTop = prevScroll;
  if (activeId) { const e = document.getElementById(activeId); if (e) { e.focus(); try { e.setSelectionRange(selStart, selStart); } catch (_) { } } }
}

function designTile(d) {
  const isImg = (d.type || '').startsWith('image/'); const isVid = (d.type || '').startsWith('video/'); const u = isImg ? surl(d.path) : '';
  const th = h('button', { class: 'dz-thumb', title: 'გახსნა სრულ ზომაზე', onclick: () => openLightbox(d) },
    isImg ? (u ? h('img', { src: u, alt: d.name, loading: 'lazy' }) : h('div', { class: 'spin' })) : h('span', { class: 'ftype', text: isVid ? 'VIDEO' : ext(d.name) }),
    h('span', { class: 'ver', text: 'v' + (d.version || 1) }));
  const dims = d.w ? `${d.w}×${d.h} · ` : '';
  return h('div', { class: 'dz' }, th,
    h('div', { class: 'dz-info' }, h('div', { class: 'dz-name', title: d.name, text: d.name }),
      h('div', { class: 'dz-sub mono', text: `${dims}${ext(d.name)} · ${fmtSize(d.size || 0)}` }),
      h('div', { class: 'dz-sub', text: `${nameOf(d.author)} · ${fmtTime(d.created_at)}` })),
    h('div', { class: 'dz-act' }, h('button', { onclick: () => download(d) }, 'ჩამოტვირთვა'), d.author === S.me || S.isOwner ? h('button', { onclick: e => removeDesign(d, e.currentTarget) }, 'წაშლა') : null));
}

function message(m) {
  const files = (m.files || []).map(f => h('button', { title: f.name, onclick: () => openLightbox(f) },
    (f.type || '').startsWith('image/') ? (surl(f.path) ? h('img', { src: surl(f.path), alt: f.name, loading: 'lazy' }) : null) : null, h('span', { text: f.name })));
  return h('div', { class: 'msg' }, avatar(m.author), h('div', { class: 'msg-body' },
    h('div', { class: 'msg-head' }, h('b', { text: nameOf(m.author) }), h('time', { text: fmtTime(m.created_at) })),
    m.text ? h('div', { class: 'msg-text', text: m.text }) : null, files.length ? h('div', { class: 'msg-files' }, files) : null));
}

function composer(kind, kept) {
  const id = 'c-' + kind; const dk = 'draft-' + kind + (kind === 'task' ? S.open : '');
  const ta = h('textarea', { id, rows: 2, placeholder: kind === 'task' ? 'დაწერე კომენტარი… (Ctrl+Enter გაგზავნა)' : 'დაწერე შეტყობინება… (Ctrl+Enter გაგზავნა)' });
  if (kept != null) ta.value = kept; else { const d = store(dk); if (d) ta.value = d; }
  ta.addEventListener('input', () => { store(dk, ta.value); ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; });
  const send = async btn => {
    const files = S.draftFiles[kind]; if (files.some(f => f.uploading)) return toast('დაელოდე ფაილის ატვირთვას');
    const text = ta.value.trim(); if (!text && !files.length) return; btn.disabled = true;
    try {
      const payload = { text, files: files.map(f => ({ path: f.path, name: f.name, type: f.type, size: f.size, w: f.w || null, h: f.h || null })), author: S.me };
      const { error } = kind === 'task' ? await sb.from('comments').insert({ ...payload, task_id: S.open }) : await sb.from('chat').insert(payload);
      if (error) throw error;
      ta.value = ''; store(dk, ''); S.draftFiles[kind] = []; S._dSig = S._cSig = null;
      kind === 'task' ? reload('comments') : reload('chat');
    } catch (e) { toast(errText(e)); } finally { btn.disabled = false; }
  };
  const sendBtn = h('button', { class: 'btn primary', onclick: e => send(e.currentTarget) }, icon(I.send), 'გაგზავნა');
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(sendBtn); } });
  const chips = h('div', { class: 'chips' }, S.draftFiles[kind].map((f, i) => h('span', { class: 'chip' }, f.uploading ? h('div', { class: 'spin' }) : null, h('span', { text: f.name }),
    h('button', { title: 'მოშორება', onclick: () => { S.draftFiles[kind].splice(i, 1); render(); } }, '×'))));
  const box = h('div', { class: 'composer' }, ta, chips, h('div', { class: 'bar' }, h('button', { class: 'icon-btn', title: 'ფაილის მიმაგრება', onclick: () => pick(kind) }, icon(I.clip)), h('div', { class: 'grow' }), sendBtn));
  wireDrop(box, files => attach(kind, files));
  return box;
}

/* ---------- chat ---------- */
function renderChat(main) {
  const csig = JSON.stringify([S.chat, S.draftFiles.chat, S.urlVer, profSig()]);
  if (main.querySelector('.chat-view') && csig === S._cSig) return; S._cSig = csig;
  const old = main.querySelector('.chat-scroll'); const atBottom = !old || old.scrollHeight - old.scrollTop - old.clientHeight < 60;
  const keep = main.querySelector('#c-chat')?.value; const focused = document.activeElement?.id === 'c-chat';
  const sc = h('div', { class: 'chat-scroll' }, h('div', { class: 'thread' }, S.chat.length ? S.chat.map(message) : h('div', { class: 'chat-empty', text: 'აქ ზოგადი საუბარია დიზაინერთან. კონკრეტულ დიზაინზე კომენტარი დაწერე თასქის შიგნით.' })));
  main.replaceChildren(h('div', { class: 'chat-view' }, sc, composer('chat', keep)));
  sc.scrollTop = atBottom ? sc.scrollHeight : old.scrollTop;
  if (focused) main.querySelector('#c-chat').focus();
  if (S.chat.length) { S.seenChat = Math.max(S.seenChat, ms(S.chat[S.chat.length - 1].created_at)); store('seenChat', S.seenChat); }
}

/* ---------- news + on this day ---------- */
function renderNews(main) {
  const nsig = JSON.stringify([S.ideas, S.news, S.history, S.newsMeta, S.nDay, S.nCat, S.nSrc, S.nGeo, S.tasks.map(t => t.id)]);
  if (main.querySelector('.news-view') && nsig === S._nSig) return; S._nSig = nsig;
  const prevScroll = main.querySelector('.news-view')?.scrollTop || 0;
  const items = S.news.map(n => ({ ...n, day: tbDate(n.published_at) })).filter(n => n.day);
  const days = [...new Set(items.map(n => n.day))].sort().reverse();
  const t0 = todayTb(), y0 = tbDate(Date.now() - 864e5);
  const day = S.nDay || (days.includes(t0) ? t0 : (days[0] || t0));
  const ofDay = items.filter(n => n.day === day && (S.nGeo === 'all' || (n.geo || 'world') === S.nGeo));
  const sources = [...new Set(items.map(n => n.source))].sort();
  const list = ofDay.filter(n => (S.nCat === 'all' || n.category === S.nCat) && (S.nSrc === 'all' || n.source === S.nSrc)).sort((a, b) => ms(b.published_at) - ms(a.published_at));
  const geoBtn = (id, label) => h('button', { 'aria-pressed': S.nGeo === id, onclick: () => { S.nGeo = id; render(); } }, label);
  const segBtn = (id, label, cnt) => h('button', { 'aria-pressed': S.nCat === id, onclick: () => { S.nCat = id; render(); } }, label, h('span', { class: 'n', text: cnt }));
  const dayBtn = d => h('button', { 'aria-pressed': day === d, onclick: () => { S.nDay = d; render(); } }, dayLabel(d), h('span', { class: 'n', text: items.filter(n => n.day === d).length }));
  const dateIn = h('input', { type: 'date', id: 'n-date', value: day, max: t0, 'aria-label': 'თარიღი' }); dateIn.onchange = () => { S.nDay = dateIn.value || null; render(); };
  const srcSel = h('select', { id: 'n-src', 'aria-label': 'წყარო' }, h('option', { value: 'all' }, 'ყველა წყარო'), sources.map(x => h('option', { value: x, selected: S.nSrc === x }, x))); srcSel.onchange = () => { S.nSrc = srcSel.value; render(); };
  const lr = S.newsMeta && S.newsMeta.lastRun;
  const upd = lr ? `განახლდა ${dayLabel(tbDate(lr))} ${tbTime(lr)}-ზე · ავტომატურად დღეში 3-ჯერ` : 'ავტომატურად ახლდება დღეში 3-ჯერ';
  const rows = list.map(n => {
    const task = n.used_task_id && S.tasks.find(t => t.id === n.used_task_id);
    return h('article', { class: 'nitem' }, h('time', { text: tbTime(n.published_at) }),
      h('div', { style: 'min-width:0' }, h('a', { class: 'ntitle', href: n.url, target: '_blank', rel: 'noopener', text: n.title }),
        h('div', { class: 'nmeta' }, h('span', { class: 'src', text: n.source }), h('span', { text: GEOS[n.geo || 'world'] }), n.category ? h('span', { class: 'cat cat-' + n.category, text: CATS[n.category] || n.category }) : null,
          n.note ? h('span', { text: n.note }) : null, task ? h('span', { class: 'used' }, icon(I.check), 'თასქად დამატებულია') : null)),
      h('div', { class: 'nact' }, task ? h('button', { class: 'btn', onclick: () => openTask(task.id) }, 'თასქის ნახვა') : h('button', { class: 'btn', onclick: e => fromNews(n, e.currentTarget) }, icon(I.plus), 'თასქად')));
  });
  const view = h('div', { class: 'news-view' }, h('div', { class: 'news-inner' },
    h('div', { class: 'news-head' }, h('h2', { text: 'ავტო ნიუსები' }), h('span', { class: 'upd', text: upd })),
    ideasBlock(S.nDay || t0),
    historyBlock(S.nDay || t0),
    h('div', { class: 'filters' }, h('div', { class: 'seg' }, dayBtn(t0), dayBtn(y0)), dateIn, h('div', { class: 'seg' }, geoBtn('all', 'ყველგან'), geoBtn('ge', 'საქართველო'), geoBtn('world', 'მსოფლიო')), srcSel),
    h('div', { class: 'filters' }, h('div', { class: 'seg' }, segBtn('all', 'ყველა', ofDay.length), Object.entries(CATS).map(([k, v]) => segBtn(k, v, ofDay.filter(n => n.category === k).length)))),
    rows.length ? h('div', { class: 'nlist' }, rows) : h('div', { class: 'nlist' }, h('div', { class: 'nempty' },
      h('div', { text: day === t0 ? 'დღეს ჯერ ახალი ნიუსი არ გამოქვეყნებულა ამ ფილტრით.' : 'ამ დღეს ამ ფილტრით ნიუსი არ არის.' }),
      day === t0 && days.find(d => d !== t0) ? h('button', { class: 'btn', onclick: () => { S.nDay = days.find(d => d !== t0); render(); } }, 'ბოლო ნიუსების ნახვა') : null)),
    h('div', { class: 'src-note', text: 'ტექსტი და ფოტოები ეკუთვნის წყაროს. გამოიყენე როგორც თემა: დაწერე საკუთარი ტექსტით და ვიზუალით, წყაროს მითითებით.' })));
  main.replaceChildren(view); view.scrollTop = prevScroll;
  const mx = Math.max(0, ...S.news.map(n => ms(n.fetched_at))); if (mx > S.seenNews) { S.seenNews = mx; store('seenNews', mx); }
}
function ideasBlock(day) {
  const list = S.ideas.filter(i => i.day === day).sort((a, b) => a.slot - b.slot);
  const open = !!S.ideasOpen;
  const head = h('button', { class: 'hist-head', type: 'button', 'aria-expanded': open, onclick: () => { S.ideasOpen = !S.ideasOpen; S._nSig = null; render(); } },
    h('h3', { text: 'დღის 3 პოსტის იდეა' }), h('span', { class: 'hist-date', text: dayLabel(day) }), h('span', { class: 'grow' }),
    h('span', { class: 'hist-toggle', text: open ? 'დამალვა' : (list.length ? `ნახე იდეები (${list.length})` : 'ნახე იდეები') }));
  if (!open) return h('section', { class: 'hist ideas-box closed' }, head);
  return h('section', { class: 'hist ideas-box' }, head,
    list.length ? h('div', { class: 'ideas-list' }, list.map(i => {
      const task = i.used_task_id && S.tasks.find(t => t.id === i.used_task_id);
      return h('article', { class: 'idea' },
        h('div', { class: 'idea-top' }, h('span', { class: 'idea-n mono', text: i.slot }), i.format ? h('span', { class: 'idea-fmt', text: i.format }) : null),
        h('div', { class: 'idea-title', text: i.title }),
        i.caption ? h('p', { class: 'idea-cap', text: i.caption }) : null,
        i.visual ? h('p', { class: 'idea-meta' }, h('b', { text: 'ვიზუალი: ' }), i.visual) : null,
        i.why ? h('p', { class: 'idea-meta' }, h('b', { text: 'რატომ: ' }), i.why) : null,
        h('div', { class: 'idea-act' },
          i.source_url ? h('a', { href: i.source_url, target: '_blank', rel: 'noopener', class: 'src', text: 'წყარო' }) : h('span'),
          task ? h('button', { class: 'btn', onclick: () => openTask(task.id) }, 'თასქის ნახვა') : h('button', { class: 'btn primary', onclick: e => fromIdea(i, e.currentTarget) }, icon(I.plus), 'თასქად')));
    })) : h('div', { class: 'hist-empty', text: day === todayTb() ? 'დღის იდეები ჯერ არ მომზადებულა. ისინი ყოველ დილას ავტომატურად ემატება.' : 'ამ დღისთვის იდეები არ არის.' }));
}
async function fromIdea(i, btn) {
  btn.disabled = true;
  const desc = [i.caption && `ტექსტის იდეა:\n${i.caption}`, i.visual && `ვიზუალი: ${i.visual}`, i.why && `რატომ: ${i.why}`, i.source_url && `წყარო: ${i.source_url}`].filter(Boolean).join('\n\n');
  const t = await createTask({ title: i.title, status: 'doing', description: desc });
  if (!t) { btn.disabled = false; return; }
  await sb.from('ideas').update({ used_task_id: t.id }).eq('id', i.id); reload('ideas'); toast('თასქი დაემატა „მზადდება“-ში');
}
function historyBlock(day) {
  const md = day.slice(5); const x = new Date(day + 'T00:00'); const label = x.getDate() + ' ' + MONTHS_FULL[x.getMonth()]; const yr = +day.slice(0, 4);
  const ev = S.history.filter(e => e.md === md).sort((a, b) => a.year - b.year);
  const open = !!S.histOpen;
  const head = h('button', { class: 'hist-head', type: 'button', 'aria-expanded': open, onclick: () => { S.histOpen = !S.histOpen; S._nSig = null; render(); } },
    h('h3', { text: 'წლების წინ ამ დღეს' }), h('span', { class: 'hist-date', text: label }), h('span', { class: 'grow' }),
    h('span', { class: 'hist-toggle', text: open ? 'დამალვა' : (ev.length ? `ნახე, რა მოხდა (${ev.length})` : 'ნახე, რა მოხდა') }));
  if (!open) return h('section', { class: 'hist closed' }, head);
  return h('section', { class: 'hist' }, head,
    ev.length ? h('div', { class: 'hist-list' }, ev.map(e => {
      const task = e.used_task_id && S.tasks.find(t => t.id === e.used_task_id);
      return h('article', { class: 'hcard' },
        h('div', { class: 'hyear' }, h('b', { class: 'mono', text: e.year }), h('span', { text: (yr - e.year) + ' წლის წინ' })),
        h('div', { class: 'hbody' }, h('div', { class: 'htitle', text: e.title }), e.text ? h('p', { text: e.text }) : null,
          h('div', { class: 'nmeta' }, e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener', class: 'src', text: 'წყარო' }) : null,
            task ? h('button', { class: 'btn', onclick: () => openTask(task.id) }, 'თასქის ნახვა') : h('button', { class: 'btn', onclick: ev2 => fromHistory(e, yr, ev2.currentTarget) }, icon(I.plus), 'თასქად'))));
    })) : h('div', { class: 'hist-empty', text: 'ამ დღისთვის ისტორიული ფაქტები ჯერ არ მომზადებულა. ისინი ავტომატურად ემატება რამდენიმე დღით ადრე.' }));
}
async function fromNews(n, btn) {
  btn.disabled = true;
  const t = await createTask({ title: n.title, status: 'doing', news_id: n.id, description: `თემა ნიუსიდან (${n.source}):\n${n.url}\n\nდაწერე საკუთარი ტექსტით და გააკეთე ჩვენი ვიზუალი.` });
  if (!t) { btn.disabled = false; return; }
  await sb.from('news').update({ used_task_id: t.id }).eq('id', n.id); reload('news'); toast('თასქი დაემატა „მზადდება“-ში');
}
async function fromHistory(e, yr, btn) {
  btn.disabled = true;
  const t = await createTask({ title: `${yr - e.year} წლის წინ ამ დღეს: ${e.title}`, status: 'doing', history_id: e.id, description: `რუბრიკა „წლების წინ ამ დღეს“ (${e.year}).\n${e.text || ''}\n\nწყარო: ${e.url || ''}` });
  if (!t) { btn.disabled = false; return; }
  await sb.from('history').update({ used_task_id: t.id }).eq('id', e.id); reload('history'); toast('თასქი დაემატა „მზადდება“-ში');
}

/* ---------- settings: profile + team ---------- */
function renderSettings() {
  const layer = $('#layer');
  if (!S.settings) { layer.querySelectorAll('.settings').forEach(e => e.remove()); if (!S.open) layer.querySelectorAll('.scrim').forEach(e => e.remove()); return; }
  const sig = JSON.stringify([S.members, profSig(), S.isOwner]); if (layer.querySelector('.settings') && sig === S._sSig) return; S._sSig = sig;
  const nameIn = h('input', { id: 's-name', value: (S.profiles[S.me] || {}).name || '', placeholder: 'შენი სახელი', autocomplete: 'name' });
  const saveName = h('button', { class: 'btn primary', onclick: async () => { const v = nameIn.value.trim(); if (!v) return; const { error } = await sb.from('profiles').update({ name: v }).eq('id', S.me); if (error) return toast(errText(error)); toast('სახელი შეინახა'); reload('profiles'); } }, 'შენახვა');
  const team = h('section', {}, h('h3', { text: 'გუნდი' }),
    h('div', { class: 'mlist' }, S.members.map(m => h('div', { class: 'mrow' }, h('span', { text: m.email }), h('small', { text: m.role === 'owner' ? 'ადმინი' : 'წევრი' }),
      S.isOwner && m.role !== 'owner' ? h('button', { class: 'icon-btn', title: 'გუნდიდან ამოშლა', onclick: async () => { const { error } = await sb.from('members').delete().eq('email', m.email); if (error) return toast(errText(error)); reload('members'); } }, icon(I.x)) : null))));
  if (S.isOwner) {
    const em = h('input', { id: 's-email', type: 'email', placeholder: 'designer@gmail.com', autocomplete: 'off' });
    const add = async () => { const v = em.value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(v)) return toast('ჩაწერე სწორი ელფოსტა'); const { error } = await sb.from('members').insert({ email: v }); if (error) return toast(errText(error)); em.value = ''; toast('დაემატა: ' + v); reload('members'); };
    em.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    team.append(h('div', { class: 'field', style: 'margin-top:10px' }, em, h('button', { class: 'btn primary', onclick: add }, icon(I.plus), 'დამატება')),
      h('p', { class: 'hint2', text: 'დაამატე დიზაინერის ელფოსტა, შემდეგ გაუგზავნე საიტის ბმული. ის იმავე ელფოსტით დარეგისტრირდება და დაფას დაინახავს.' }));
  }
  const panel = h('aside', { class: 'settings', role: 'dialog', 'aria-label': 'პროფილი და გუნდი' },
    h('div', { class: 'd-bar' }, h('b', { text: 'პროფილი და გუნდი' }), h('div', { class: 'grow' }), h('button', { class: 'icon-btn', title: 'დახურვა', onclick: closeSettings }, icon(I.x))),
    h('div', { class: 'd-scroll' },
      h('section', {}, h('h3', { text: 'შენი სახელი' }), h('div', { class: 'field' }, nameIn, saveName), h('p', { class: 'hint2', text: S.email })),
      team,
      h('section', {}, h('button', { class: 'btn', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'გასვლა'))));
  const old = layer.querySelector('.settings'); if (!layer.querySelector('.scrim')) layer.append(h('div', { class: 'scrim', onclick: closeSettings }));
  if (old) old.replaceWith(panel); else layer.append(panel);
}
function closeSettings() { S.settings = false; S._sSig = null; render(); }

/* ---------- lightbox ---------- */
function openLightbox(d) {
  closeLightbox();
  const type = d.type || ''; const url = surl(d.path);
  const stage = h('div', { class: 'lb-stage fit' }); let toggle = null;
  if (type.startsWith('image/')) {
    const img = h('img', { src: url, alt: d.name }); stage.append(img);
    toggle = h('button', { class: 'btn', title: 'ფაქტობრივი ზომა / ეკრანზე მორგება' }, '100%');
    const flip = () => { const fit = stage.classList.toggle('fit'); stage.classList.toggle('actual', !fit); toggle.textContent = fit ? '100%' : 'მორგება'; };
    toggle.onclick = flip; img.onclick = flip;
  } else if (type.startsWith('video/')) stage.append(h('video', { src: url, controls: true, playsinline: true }));
  else stage.append(h('div', { style: 'text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center;padding:24px' },
    h('div', { class: 'ftype mono', style: 'font-size:40px', text: ext(d.name) }), h('a', { href: url, target: '_blank', rel: 'noopener', class: 'btn', text: 'გახსნა ახალ ჩანართში' })));
  document.body.append(h('div', { class: 'lb', role: 'dialog', 'aria-label': d.name },
    h('div', { class: 'lb-bar' }, h('div', { class: 't' }, h('b', { text: d.name }), h('small', { class: 'mono', text: `${d.w ? d.w + '×' + d.h + ' px · ' : ''}${fmtSize(d.size || 0)} · ორიგინალი` })),
      toggle, h('button', { class: 'btn primary', onclick: () => download(d) }, icon(I.dl), 'ორიგინალის ჩამოტვირთვა'),
      h('button', { class: 'btn', onclick: closeLightbox, title: 'დახურვა (Esc)' }, icon(I.x))), stage));
}
function closeLightbox() { document.querySelectorAll('.lb').forEach(e => e.remove()); }

/* ---------- actions ---------- */
async function createTask(fields) {
  const { data, error } = await sb.from('tasks').insert({ status: 'doing', ...fields, created_by: S.me }).select().single();
  if (error) { toast(errText(error)); return null; }
  S.tasks = [data, ...S.tasks]; render(); return data;
}
async function patch(id, data) {
  const t = S.tasks.find(x => x.id === id); if (t) Object.assign(t, data, { updated_at: new Date().toISOString() });
  render();
  const { error } = await sb.from('tasks').update(data).eq('id', id); if (error) { toast(errText(error)); reload('tasks'); }
}
function setStatus(id, st) { const t = S.tasks.find(x => x.id === id); if (!t || stOf(t) === st) return; patch(id, { status: st }); toast('გადავიდა: ' + STATUSES.find(s => s.id === st).name); }
async function deleteTask(id) {
  const paths = S.designs.map(d => d.path).concat(...S.comments.map(c => (c.files || []).map(f => f.path)));
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) return toast(errText(error));
  if (paths.length) sb.storage.from(BUCKET).remove(paths).catch(() => { });
  S.tasks = S.tasks.filter(t => t.id !== id); closeTask(); toast('თასქი წაიშალა');
}
function openTask(id) {
  closeTask(true); S.open = id; S.confirmDel = false; S.quickCol = null; S.comments = []; S.designs = []; S.view = 'board';
  try { history.replaceState(null, '', '#' + id); } catch (_) { }
  render(); reload('comments'); reload('designs');
}
function closeTask(silent) { S.open = null; S.draftFiles.task = []; try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { } if (silent !== true) render(); }

function validate(f) {
  const ok = /^(image\/|video\/)/.test(f.type) || f.type === 'application/pdf';
  if (!ok) { toast(`„${f.name}“ — ეს ფორმატი არ მიიღება. ატვირთე PNG, JPG, WEBP, SVG, PDF ან ვიდეო.`); return false; }
  const lim = f.type === 'image/svg+xml' ? MAX_SVG : MAX;
  if (f.size > lim) { toast(`„${f.name}“ ${fmtSize(f.size)}-ია, ლიმიტი ${fmtSize(lim)}. შეკუმშვა არ ვქენით, რომ ხარისხი არ დაზიანდეს.`); return false; }
  return true;
}
function dims(f) {
  return new Promise(res => {
    const u = URL.createObjectURL(f); const done = r => { URL.revokeObjectURL(u); res(r); };
    if (f.type.startsWith('image/')) { const im = new Image(); im.onload = () => done({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => done({}); im.src = u; }
    else if (f.type.startsWith('video/')) { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => done({ w: v.videoWidth, h: v.videoHeight }); v.onerror = () => done({}); v.src = u; }
    else done({});
  });
}
async function uploadRaw(f, folder) {
  const d = await dims(f); const path = `${folder}/${uid()}-${safeName(f.name)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return { path, name: f.name, type: f.type, size: f.size, ...d };
}
async function uploadDesigns(files) {
  const taskId = S.open; const list = [...files].filter(validate); if (!list.length) return;
  for (const f of list) {
    const u = { task: taskId, name: f.name, size: f.size }; S.uploads.push(u); render();
    try {
      const r = await uploadRaw(f, taskId);
      const { data, error } = await sb.from('designs').insert({ task_id: taskId, path: r.path, name: r.name, type: r.type, size: r.size, w: r.w || null, h: r.h || null, author: S.me }).select().single();
      if (error) { sb.storage.from(BUCKET).remove([r.path]); throw error; }
      toast(`ატვირთულია: ${r.name} (v${data.version})`);
    } catch (e) { toast(errText(e)); }
    finally { S.uploads.splice(S.uploads.indexOf(u), 1); reload('designs'); reload('tasks'); }
  }
}
async function attach(kind, files) {
  for (const f of [...files].filter(validate)) {
    const item = { name: f.name, uploading: true }; S.draftFiles[kind].push(item); render();
    try { Object.assign(item, await uploadRaw(f, kind === 'task' ? `${S.open}/comments` : 'chat')); item.uploading = false; }
    catch (e) { S.draftFiles[kind].splice(S.draftFiles[kind].indexOf(item), 1); toast(errText(e)); }
    S._dSig = S._cSig = null; render();
  }
}
async function removeDesign(d, btn) {
  if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'დარწმუნებული ხარ?'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'წაშლა'; } }, 3500); return; }
  const { error } = await sb.from('designs').delete().eq('id', d.id); if (error) return toast(errText(error));
  sb.storage.from(BUCKET).remove([d.path]).catch(() => { });
  toast('დიზაინი წაიშალა'); reload('designs'); reload('tasks');
}
async function download(d) {
  toast('ჩამოტვირთვა…');
  const { data, error } = await sb.storage.from(BUCKET).download(d.path);
  if (error || !data) return toast(errText(error));
  const u = URL.createObjectURL(data); const a = h('a', { href: u, download: d.name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 30e3); toast('ჩამოიტვირთა ორიგინალი ხარისხით');
}

let pickKind = 'design';
function pick(kind) { pickKind = kind; $('#file-pick').value = ''; $('#file-pick').click(); }
$('#file-pick').addEventListener('change', e => { const f = e.target.files; if (!f || !f.length) return; pickKind === 'design' ? uploadDesigns(f) : attach(pickKind, f); });
function wireDrop(el, fn) {
  el.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.stopPropagation(); el.classList.add('over'); } });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); fn(e.dataTransfer.files); });
}
document.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])]; if (!files.length || !S.me) return;
  e.preventDefault(); if (S.view === 'chat') attach('chat', files); else if (S.open) { document.activeElement?.id === 'c-task' ? attach('task', files) : uploadDesigns(files); }
});
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (document.querySelector('.lb')) closeLightbox(); else if (S.settings) closeSettings(); else if (S.open) closeTask(); });

$('#tab-board').onclick = () => { S.view = 'board'; render(); };
$('#tab-news').onclick = () => { closeTask(true); S.view = 'news'; render(); };
$('#q').addEventListener('input', e => { S.q = e.target.value; render(); });
$('#new-task').onclick = () => { closeTask(true); S.view = 'board'; S.quickCol = 'doing'; render(); };
$('#theme-btn').onclick = () => { const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', n); store('am-theme', n); };
$('#me-btn').onclick = () => { S.settings = true; reload('members'); render(); };

/* ---------- auth + boot ---------- */
let mode = 'in';
function showAuth(msg, ok) {
  $('#app').hidden = true; $('#auth').hidden = false;
  const err = $('#auth-err'); err.hidden = !msg; err.textContent = msg || ''; err.className = ok ? 'auth-ok' : 'auth-err';
}
function setMode(m) {
  mode = m; $('#auth-title').textContent = m === 'in' ? 'შესვლა' : 'რეგისტრაცია';
  $('#auth-submit').textContent = m === 'in' ? 'შესვლა' : 'ანგარიშის შექმნა';
  $('#auth-switch').textContent = m === 'in' ? 'ანგარიში არ გაქვს? რეგისტრაცია' : 'უკვე გაქვს ანგარიში? შესვლა';
  $('#auth-pass').setAttribute('autocomplete', m === 'in' ? 'current-password' : 'new-password');
}
$('#auth-switch').onclick = () => setMode(mode === 'in' ? 'up' : 'in');
$('#auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#auth-email').value.trim().toLowerCase(); const password = $('#auth-pass').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return showAuth('ჩაწერე სწორი ელფოსტა');
  if (password.length < 6) return showAuth('პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს');
  const btn = $('#auth-submit'); btn.disabled = true;
  try {
    if (mode === 'in') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return showAuth(/confirm/i.test(error.message) ? 'ჯერ დაადასტურე ელფოსტა: შეამოწმე მეილი (Spam-იც).' : 'ელფოსტა ან პაროლი არასწორია');
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) return showAuth(/registered/i.test(error.message) ? 'ეს ელფოსტა უკვე რეგისტრირებულია, შედი.' : errText(error));
      if (!data.session) { setMode('in'); return showAuth('ანგარიში შეიქმნა. დაადასტურე ელფოსტა მეილზე მოსული ბმულით და შემდეგ შედი.', true); }
    }
  } finally { btn.disabled = false; }
});

let booted = false;
async function boot(session) {
  if (!session) { booted = false; return showAuth(); }
  if (booted) return; booted = true;
  S.me = session.user.id; S.email = session.user.email || '';
  const [{ data: member }, { data: owner }] = await Promise.all([sb.rpc('is_member'), sb.rpc('is_owner')]);
  if (!member) {
    booted = false;
    $('#auth').hidden = false; $('#app').hidden = true;
    $('#auth-form').replaceChildren(h('h1', { text: 'წვდომა ჯერ არ გაქვს' }),
      h('p', { class: 'auth-sub', text: `${S.email} ჯერ არ არის დამატებული გუნდში. სთხოვე ადმინს, რომ „გუნდი“ განყოფილებაში შენი ელფოსტა დაამატოს, შემდეგ განაახლე გვერდი.` }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'განახლება'),
      h('button', { class: 'linkish', type: 'button', onclick: async () => { await sb.auth.signOut(); location.reload(); } }, 'სხვა ანგარიშით შესვლა'));
    return;
  }
  S.isOwner = !!owner;
  S.seenChat = +store('seenChat') || 0; S.seenNews = +store('seenNews') || 0;
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#main').replaceChildren(h('div', { class: 'empty-board' }, h('div', { class: 'spin' }), h('p', { text: 'დაფა იტვირთება…' })));
  await Promise.all([DB.tasks(), DB.news(), DB.ideas(), DB.history(), DB.meta(), DB.profiles()]);
  const hid = location.hash.slice(1); if (hid && S.tasks.find(t => t.id === hid)) openTask(hid); else render();
  if (!(S.profiles[S.me] || {}).name || S.profiles[S.me].name === S.email.split('@')[0]) toast('დააჭირე მარჯვენა ზედა წრეს და ჩაწერე შენი სახელი');
  const ch = sb.channel('board');
  const on = (table, fn) => ch.on('postgres_changes', { event: '*', schema: 'public', table }, fn);
  on('tasks', () => reload('tasks'));
  on('news', () => reload('news'));
  on('history', () => reload('history'));
  on('ideas', () => reload('ideas'));
  on('meta', () => reload('meta'));
  on('profiles', () => reload('profiles'));
  on('comments', p => { const t = (p.new && p.new.task_id) || (p.old && p.old.task_id); if (!t || t === S.open) reload('comments'); });
  on('designs', p => { const t = (p.new && p.new.task_id) || (p.old && p.old.task_id); if (!t || t === S.open) reload('designs'); });
  ch.subscribe();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ['tasks', 'news', 'comments', 'designs'].forEach(reload); });
}
sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_OUT') location.reload(); else if (session) boot(session); });
sb.auth.getSession().then(({ data }) => boot(data.session));
})();
