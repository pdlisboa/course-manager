// Frontend do app de aulas: JS puro, sem build.
// Rotas (hash): #/  → lista de cursos
//               #/c/<curso>            → curso (abre a última aula assistida)
//               #/c/<curso>/<aula>     → curso com a aula escolhida

const app = document.getElementById('app');
const breadcrumb = document.getElementById('breadcrumb');
const SAVE_INTERVAL_MS = 5000;

const state = {
  course: null,       // curso carregado (resposta de /api/courses/:id)
  lessons: [],        // todas as aulas do curso, em ordem, com { module } anexado
  current: null,      // aula em reprodução
  openModules: new Set(), // módulos expandidos na barra lateral
  lastSavedAt: 0,
  autoplayNext: false,  // ao terminar uma aula, a próxima começa sozinha
};

// ---------- Utilidades ----------

const $ = (sel, root = document) => root.querySelector(sel);

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function mediaUrl(path) {
  return '/media/' + path.split('/').map(encodeURIComponent).join('/');
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function formatHours(seconds) {
  if (seconds > 0 && seconds < 60) return `${Math.round(seconds)}s`;
  const totalMin = Math.round((seconds || 0) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function lessonFraction(lesson) {
  if (lesson.completed) return 1;
  return lesson.duration ? Math.min(lesson.position / lesson.duration, 1) : 0;
}

function summarize(lessons) {
  let totalSeconds = 0;
  let watchedSeconds = 0;
  for (const l of lessons) {
    const d = l.duration ?? 0;
    totalSeconds += d;
    watchedSeconds += l.completed ? d : Math.min(l.position, d);
  }
  return { total: lessons.length, completed: lessons.filter((l) => l.completed).length, totalSeconds, watchedSeconds };
}

function progressBar(value, label = '') {
  return `<div class="bar" role="progressbar" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100" ${label ? `aria-label="${esc(label)}"` : ''}>
    <span style="width:${value}%"></span></div>`;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function setBreadcrumb(items) {
  breadcrumb.innerHTML = items
    .map((item) => (item.href ? `<a href="${item.href}">${esc(item.label)}</a>` : `<span>${esc(item.label)}</span>`))
    .join('<span class="sep">/</span>');
}

// ---------- Tema ----------

const THEME_KEY = 'aulas-theme';
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch {}
$('#theme').addEventListener('click', () => {
  const isDark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
});

$('#rescan').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.classList.add('spin');
  try {
    await api('/api/rescan', { method: 'POST' });
    state.course = null;
    await route();
  } finally {
    btn.disabled = false;
    btn.classList.remove('spin');
  }
});

// ---------- Visualizador de PDF ----------

const viewer = $('#viewer');
function openViewer(file) {
  $('#viewer-title').textContent = file.name;
  $('#viewer-frame').src = mediaUrl(file.path);
  $('#viewer-open').href = mediaUrl(file.path);
  viewer.showModal();
}
viewer.addEventListener('click', (e) => {
  if (e.target === viewer || e.target.closest('[data-close]')) viewer.close();
});
viewer.addEventListener('close', () => { $('#viewer-frame').src = 'about:blank'; });

// Ícones SVG (traço herda a cor do texto).
const ICONS = {
  chevron: '<path d="m9 6 6 6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  zip: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M10 6h1M10 9h1M10 12h1M9.5 15h2v3h-2z"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clip: '<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
};
function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function fileKind(file) {
  if (file.ext === '.pdf') return { icon: 'pdf', cls: 'is-pdf', action: 'Abrir', actionIcon: 'eye' };
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(file.ext)) return { icon: 'zip', cls: 'is-zip', action: 'Baixar', actionIcon: 'download' };
  return { icon: 'file', cls: '', action: 'Baixar', actionIcon: 'download' };
}

function fileLink(file) {
  const kind = fileKind(file);
  const ext = file.ext.replace('.', '').toUpperCase() || 'ARQUIVO';
  const inner = `<span class="file-icon ${kind.cls}">${icon(kind.icon)}</span>
    <span class="file-body"><span class="file-name" title="${esc(file.name)}">${esc(file.name)}</span>
    <small>${ext} · ${formatSize(file.size)}</small></span>
    <span class="file-action">${icon(kind.actionIcon)}<span>${kind.action}</span></span>`;
  if (file.ext === '.pdf') {
    return `<button class="file" data-pdf="${esc(file.path)}" data-name="${esc(file.name)}">${inner}</button>`;
  }
  return `<a class="file" href="${mediaUrl(file.path)}?download">${inner}</a>`;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pdf]');
  if (btn) openViewer({ path: btn.dataset.pdf, name: btn.dataset.name });
});

// ---------- Home: lista de cursos ----------

async function renderHome() {
  setBreadcrumb([]);
  app.innerHTML = `<div class="loading">Carregando…</div>`;
  const courses = await api('/api/courses');

  if (!courses.length) {
    app.innerHTML = `<div class="empty"><h2>Nenhum curso encontrado</h2>
      <p>Verifique se a pasta de cursos (<code>COURSES_DIR</code>) está montada e tem subpastas com vídeos.</p></div>`;
    return;
  }

  app.innerHTML = `<div class="home">
    <h1>Seus cursos</h1>
    <p class="subtitle">${courses.length} curso(s) disponível(is)</p>
    <div class="cards">${courses.map((c) => {
      const p = pct(c.completed, c.total);
      const cta = p === 100 ? 'Rever curso' : c.completed || c.watchedSeconds ? 'Continuar' : 'Começar';
      return `<a class="card glass" href="#/c/${encodeURIComponent(c.id)}">
        <div class="card-top">
          <span class="card-icon">${icon('play')}</span>
          <div>
            <h2>${esc(c.title)}</h2>
            <p class="muted">${c.moduleCount} módulo(s) · ${c.total} aula(s) · ${formatHours(c.totalSeconds)}</p>
          </div>
        </div>
        ${progressBar(p, 'Progresso do curso')}
        <p class="stats"><strong>${p}%</strong> <span class="muted">${c.completed}/${c.total} aulas · ${formatHours(c.watchedSeconds)} assistidas</span></p>
        <span class="card-cta">${cta} ${icon('next')}</span>
      </a>`;
    }).join('')}</div>
  </div>`;
}

// ---------- Página do curso ----------

async function loadCourse(courseId) {
  if (state.course?.id === courseId) return;
  state.course = await api(`/api/courses/${encodeURIComponent(courseId)}`);
  state.lessons = state.course.modules.flatMap((m) => m.lessons.map((l) => Object.assign(l, { module: m })));
  state.current = null;
  state.openModules = new Set();
}

async function renderCourse(courseId, lessonPath) {
  if (state.course?.id !== courseId) app.innerHTML = `<div class="loading">Carregando…</div>`;
  await loadCourse(courseId);
  const course = state.course;

  if (!state.lessons.length) {
    setBreadcrumb([{ label: course.title }]);
    app.innerHTML = `<div class="empty"><h2>${esc(course.title)}</h2><p>Nenhum vídeo encontrado neste curso.</p></div>`;
    return;
  }

  // Sem aula na URL: continua de onde parou, ou a primeira não concluída.
  if (!lessonPath) {
    const target = course.lastLesson ?? (state.lessons.find((l) => !l.completed) ?? state.lessons[0]).path;
    location.replace(`#/c/${encodeURIComponent(courseId)}/${encodeURIComponent(target)}`);
    return;
  }

  const lesson = state.lessons.find((l) => l.path === lessonPath) ?? state.lessons[0];
  if (!$('.course')) {
    app.innerHTML = `<div class="course">
      <section class="player-area" id="player-area"></section>
      <aside class="sidebar glass" id="sidebar" aria-label="Conteúdo do curso"></aside>
    </div>`;
  }
  const changed = state.current !== lesson;
  if (changed) {
    if (state.current) saveProgress(true);
    if (state.current?.module !== lesson.module) state.openModules.add(lesson.module.id);
    state.current = lesson;
    clearAmbient();
    renderPlayer();
  }
  renderSidebar({ reveal: changed });
  setBreadcrumb([
    { label: 'Cursos', href: '#/' },
    { label: course.title, href: `#/c/${encodeURIComponent(course.id)}` },
    { label: lesson.module.title },
  ]);
}

function lessonHref(lesson) {
  return `#/c/${encodeURIComponent(state.course.id)}/${encodeURIComponent(lesson.path)}`;
}

function statusIcon(lesson) {
  if (lesson === state.current && !lesson.completed) return `<span class="status playing" title="Assistindo agora">${icon('play')}</span>`;
  if (lesson.completed) return `<span class="status done" title="Concluída">${icon('check')}</span>`;
  const f = lessonFraction(lesson);
  return `<span class="status" style="--p:${Math.round(f * 100)}" title="${f ? `${Math.round(f * 100)}% assistido` : 'Não iniciada'}"></span>`;
}

function renderSidebar({ reveal = false } = {}) {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  const list = $('#module-list', sidebar);
  const scroll = list ? list.scrollTop : 0;
  const course = state.course;
  const all = summarize(state.lessons);
  const overall = pct(all.completed, all.total);

  sidebar.innerHTML = `
    <div class="overview">
      <p class="overview-label">Curso</p>
      <h1>${esc(course.title)}</h1>
      <div class="overview-row">
        <div class="ring" style="--p:${overall}"><span>${overall}%</span></div>
        <div>
          <p><strong>${all.completed}</strong> de ${all.total} aulas concluídas</p>
          <p class="muted">${formatHours(all.watchedSeconds)} de ${formatHours(all.totalSeconds)} assistidas</p>
        </div>
      </div>
    </div>
    <div class="module-list" id="module-list">
    ${course.modules.map((m, i) => {
      const s = summarize(m.lessons);
      const p = pct(s.completed, s.total);
      const open = state.openModules.has(m.id);
      const isCurrent = state.current?.module === m;
      const done = s.total > 0 && s.completed === s.total;
      const files = m.materials.length + m.lessons.reduce((n, l) => n + l.attachments.length, 0);
      return `<section class="module ${open ? 'open' : ''} ${isCurrent ? 'current' : ''} ${done ? 'complete' : ''}" data-module="${esc(m.id)}">
        <button class="module-head" aria-expanded="${open}">
          <span class="module-index">${done ? icon('check') : String(i + 1).padStart(2, '0')}</span>
          <span class="module-info">
            <span class="module-title">${esc(m.title)}</span>
            <span class="module-meta">${s.completed}/${s.total} aulas · ${formatHours(s.totalSeconds)}${files ? ` · ${icon('clip', 'icon-xs')} ${files}` : ''}</span>
            <span class="module-bar" aria-hidden="true"><span style="width:${p}%"></span></span>
          </span>
          ${icon('chevron', 'chevron')}
        </button>
        <ol class="lessons" ${open ? '' : 'hidden'}>${m.lessons.map((l, j) => `
          <li><a href="${lessonHref(l)}" class="lesson ${l === state.current ? 'active' : ''} ${l.completed ? 'completed' : ''}" ${l === state.current ? 'aria-current="true"' : ''}>
            ${statusIcon(l)}
            <span class="lesson-title"><span class="lesson-num">${j + 1}.</span> ${esc(l.title)}</span>
            ${l.attachments.length ? `<span class="lesson-clip" title="${l.attachments.length} arquivo(s)">${icon('clip', 'icon-xs')}</span>` : ''}
            <span class="lesson-time">${formatClock(l.duration)}</span>
          </a></li>`).join('')}
        </ol>
      </section>`;
    }).join('')}
    </div>`;

  const newList = $('#module-list', sidebar);
  newList.scrollTop = scroll;
  if (reveal) {
    const active = $('.lesson.active', newList);
    if (active) {
      const a = active.getBoundingClientRect();
      const b = newList.getBoundingClientRect();
      if (a.top < b.top || a.bottom > b.bottom) active.scrollIntoView({ block: 'center' });
    }
  }

  newList.querySelectorAll('.module-head').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.module').dataset.module;
      if (state.openModules.has(id)) state.openModules.delete(id);
      else state.openModules.add(id);
      renderSidebar();
    });
  });
}

// ---------- Player ----------

const AUTOPLAY_KEY = 'aulas-autoplay';
const SPEED_KEY = 'aulas-speed';
const SPEEDS = ['0.75', '1', '1.25', '1.5', '1.75', '2'];
function pref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function setPref(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function neighbor(offset) {
  const i = state.lessons.indexOf(state.current);
  return state.lessons[i + offset] ?? null;
}

/** Arquivos abaixo do vídeo: os da aula atual + os materiais do módulo (iguais para todas as aulas do módulo). */
function renderFiles(lesson) {
  const groups = [];
  if (lesson.attachments.length) {
    groups.push(`<div class="files-group"><h3>Desta aula</h3><div class="file-list glass">${lesson.attachments.map(fileLink).join('')}</div></div>`);
  }
  if (lesson.module.materials.length) {
    groups.push(`<div class="files-group"><h3>Materiais do módulo</h3><div class="file-list glass">${lesson.module.materials.map(fileLink).join('')}</div></div>`);
  }
  if (!groups.length) return '';
  const count = lesson.attachments.length + lesson.module.materials.length;
  return `<section class="files-panel" aria-labelledby="files-title">
    <header class="files-head"><h2 id="files-title">Arquivos</h2><span class="muted">${count} ${count === 1 ? 'arquivo' : 'arquivos'}</span></header>
    <div class="files-groups">${groups.join('')}</div>
  </section>`;
}

// ---------- Fundo ambiente ----------
// Um quadro do vídeo, reduzido e desfocado, pinta o fundo: é o que dá cor ao vidro.

const AMBIENT_INTERVAL_MS = 4000;
const ambientCanvas = $('#ambient-canvas');
let ambientAt = 0;

function paintAmbient(video) {
  ambientAt = Date.now();
  if (!ambientCanvas || video.readyState < 2 || !video.videoWidth) return;
  try {
    const ctx = ambientCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, ambientCanvas.width, ambientCanvas.height);
    // Quadro quase todo preto (ex.: início do vídeo) não dá cor nenhuma: mantém o fundo padrão.
    const px = ctx.getImageData(0, 0, ambientCanvas.width, ambientCanvas.height).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
    document.body.classList.toggle('has-ambient', sum / (px.length / 4) > 30);
  } catch {
    document.body.classList.remove('has-ambient');
  }
}

function clearAmbient() {
  document.body.classList.remove('has-ambient');
}

function renderPlayer() {
  const lesson = state.current;
  const prev = neighbor(-1);
  const next = neighbor(1);
  const speedPref = pref(SPEED_KEY, '1');
  const speed = SPEEDS.includes(speedPref) ? speedPref : '1';

  const moduleIndex = state.course.modules.indexOf(lesson.module) + 1;
  const lessonIndex = lesson.module.lessons.indexOf(lesson) + 1;

  $('#player-area').innerHTML = `<div class="player-inner">
    <div class="video-wrap">
      <video id="video" controls preload="metadata" playsinline src="${mediaUrl(lesson.path)}"></video>
    </div>
    <div class="lesson-head">
      <div class="lesson-heading">
        <p class="eyebrow"><span class="pill">Módulo ${moduleIndex}</span> ${esc(lesson.module.title)} <span class="dot">·</span> Aula ${lessonIndex} de ${lesson.module.lessons.length}</p>
        <h2>${esc(lesson.title)}</h2>
      </div>
      <button id="toggle-done" class="btn"></button>
    </div>
    <div class="toolbar">
      <div class="nav-buttons">
        <a class="btn ${prev ? '' : 'disabled'}" ${prev ? `href="${lessonHref(prev)}"` : 'aria-disabled="true"'} title="Aula anterior (P)">${icon('prev')} Anterior</a>
        <a class="btn btn-primary ${next ? '' : 'disabled'}" ${next ? `href="${lessonHref(next)}"` : 'aria-disabled="true"'} title="Próxima aula (N)">Próxima ${icon('next')}</a>
      </div>
      <div class="player-prefs">
        <div class="segmented glass" role="group" aria-label="Velocidade" id="speed">${SPEEDS.map((v) =>
          `<button data-speed="${v}" aria-pressed="${v === speed}">${v.replace('.', ',')}×</button>`).join('')}</div>
        <label class="control switch"><input type="checkbox" id="autoplay" ${pref(AUTOPLAY_KEY, '1') === '1' ? 'checked' : ''}><span class="switch-track"></span> Avançar automaticamente</label>
      </div>
    </div>
    ${renderFiles(lesson)}
    <p class="hint muted">Atalhos: <kbd>espaço</kbd>/<kbd>K</kbd> pausar · <kbd>J</kbd>/<kbd>L</kbd> ±10s · <kbd>N</kbd> próxima · <kbd>P</kbd> anterior · <kbd>F</kbd> tela cheia · <kbd>M</kbd> concluir</p>
  </div>`;

  updateDoneButton();
  const video = $('#video');
  video.playbackRate = Number(speed);
  if (state.autoplayNext) {
    state.autoplayNext = false;
    video.autoplay = true;
  }

  video.addEventListener('loadedmetadata', () => {
    if (!lesson.duration && Number.isFinite(video.duration)) lesson.duration = video.duration;
    // Retoma de onde parou (se não estava no finalzinho).
    if (!lesson.completed && lesson.position > 5 && lesson.position < video.duration - 5) {
      video.currentTime = lesson.position;
    }
    video.playbackRate = Number(pref(SPEED_KEY, '1'));
  });
  video.addEventListener('loadeddata', () => paintAmbient(video));
  video.addEventListener('seeked', () => paintAmbient(video));
  video.addEventListener('timeupdate', () => {
    if (Date.now() - ambientAt > AMBIENT_INTERVAL_MS) paintAmbient(video);
    if (state.current !== lesson || video.seeking) return;
    lesson.position = video.currentTime;
    if (Date.now() - state.lastSavedAt > SAVE_INTERVAL_MS) saveProgress();
  });
  video.addEventListener('pause', () => saveProgress());
  video.addEventListener('ended', async () => {
    lesson.position = video.duration;
    await saveProgress();
    const nextLesson = neighbor(1);
    if (nextLesson && $('#autoplay')?.checked) {
      state.autoplayNext = true;
      location.hash = lessonHref(nextLesson);
    }
  });

  $('#speed').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-speed]');
    if (!btn) return;
    setPref(SPEED_KEY, btn.dataset.speed);
    video.playbackRate = Number(btn.dataset.speed);
    $('#speed').querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
  $('#autoplay').addEventListener('change', (e) => setPref(AUTOPLAY_KEY, e.target.checked ? '1' : '0'));
  $('#toggle-done').addEventListener('click', toggleDone);
}

function updateDoneButton() {
  const btn = $('#toggle-done');
  if (!btn) return;
  btn.innerHTML = state.current.completed ? `${icon('check')} Concluída` : `${icon('check')} Marcar como concluída`;
  btn.classList.toggle('btn-done', state.current.completed);
}

function applyServerLesson(lesson, data) {
  const wasCompleted = lesson.completed;
  lesson.completed = data.completed;
  lesson.duration = data.duration ?? lesson.duration;
  lesson.updatedAt = data.updatedAt;
  state.course.lastLesson = lesson.path;
  if (lesson === state.current) updateDoneButton();
  if (wasCompleted !== lesson.completed) renderSidebar();
}

/** Envia a posição atual. Com `beacon`, usa sendBeacon (funciona ao fechar a aba). */
async function saveProgress(beacon = false) {
  const lesson = state.current;
  if (!lesson) return;
  state.lastSavedAt = Date.now();
  const body = JSON.stringify({ path: lesson.path, position: lesson.position, duration: lesson.duration });
  if (beacon) {
    navigator.sendBeacon('/api/progress', new Blob([body], { type: 'application/json' }));
    return;
  }
  try {
    applyServerLesson(lesson, await api('/api/progress', { method: 'POST', body }));
    renderSidebar();
  } catch (err) {
    console.warn('Falha ao salvar progresso', err);
  }
}

async function toggleDone() {
  const lesson = state.current;
  const data = await api('/api/progress/complete', {
    method: 'POST',
    body: JSON.stringify({ path: lesson.path, completed: !lesson.completed }),
  });
  if (!data.completed) {
    lesson.position = 0;
    const video = $('#video');
    if (video) video.currentTime = 0;
  }
  applyServerLesson(lesson, data);
  renderSidebar();
}

addEventListener('pagehide', () => saveProgress(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveProgress(true);
});

// ---------- Atalhos de teclado ----------

document.addEventListener('keydown', (e) => {
  const video = $('#video');
  if (!video || e.ctrlKey || e.metaKey || e.altKey || viewer.open) return;
  if (e.target.closest('input, select, textarea, button')) return;
  const onVideo = e.target === video; // o próprio <video> já trata espaço e setas
  const key = e.key.toLowerCase();

  if ((key === ' ' && !onVideo) || key === 'k') {
    e.preventDefault();
    video.paused ? video.play() : video.pause();
  } else if (key === 'j' || (key === 'arrowleft' && !onVideo)) {
    video.currentTime = Math.max(0, video.currentTime - 10);
  } else if (key === 'l' || (key === 'arrowright' && !onVideo)) {
    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
  } else if (key === 'n' && neighbor(1)) {
    location.hash = lessonHref(neighbor(1));
  } else if (key === 'p' && neighbor(-1)) {
    location.hash = lessonHref(neighbor(-1));
  } else if (key === 'f') {
    document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen();
  } else if (key === 'm') {
    toggleDone();
  }
});

// ---------- Roteamento ----------

async function route() {
  if (viewer.open) viewer.close();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === 'c' && parts[1]) {
      await renderCourse(parts[1], parts[2]);
    } else {
      if (state.current) saveProgress(true);
      state.course = null;
      state.current = null;
      clearAmbient();
      await renderHome();
    }
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="empty"><h2>Algo deu errado</h2><p>${esc(err.message)}</p><p><a href="#/">Voltar ao início</a></p></div>`;
  }
}

addEventListener('hashchange', route);
route();
