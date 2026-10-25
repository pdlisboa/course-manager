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
  collapsed: new Set(), // módulos recolhidos na barra lateral
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

function fileLink(file) {
  const icon = file.ext === '.pdf' ? '📄' : file.ext === '.zip' ? '🗜️' : '📎';
  const meta = `<small>${formatSize(file.size)}</small>`;
  if (file.ext === '.pdf') {
    return `<button class="file" data-pdf="${esc(file.path)}" data-name="${esc(file.name)}">${icon}<span>${esc(file.name)}</span>${meta}</button>`;
  }
  return `<a class="file" href="${mediaUrl(file.path)}?download">${icon}<span>${esc(file.name)}</span>${meta}</a>`;
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

  if (courses.length === 1) {
    location.replace(`#/c/${encodeURIComponent(courses[0].id)}`);
    return;
  }
  if (!courses.length) {
    app.innerHTML = `<div class="empty"><h2>Nenhum curso encontrado</h2>
      <p>Verifique se a pasta de cursos (<code>COURSES_DIR</code>) está montada e tem subpastas com vídeos.</p></div>`;
    return;
  }

  app.innerHTML = `<div class="home">
    <h1>Seus cursos</h1>
    <div class="cards">${courses.map((c) => {
      const p = pct(c.completed, c.total);
      return `<a class="card" href="#/c/${encodeURIComponent(c.id)}">
        <h2>${esc(c.title)}</h2>
        <p class="muted">${c.moduleCount} módulo(s) · ${c.total} aula(s) · ${formatHours(c.totalSeconds)}</p>
        ${progressBar(p, 'Progresso do curso')}
        <p class="stats"><strong>${p}%</strong> <span class="muted">${c.completed}/${c.total} aulas · ${formatHours(c.watchedSeconds)} assistidas</span></p>
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
      <aside class="sidebar" id="sidebar"></aside>
    </div>`;
  }
  if (state.current !== lesson) {
    if (state.current) saveProgress(true);
    state.current = lesson;
    renderPlayer();
  }
  renderSidebar();
  setBreadcrumb([
    ...(course.id === 'curso' ? [] : [{ label: 'Cursos', href: '#/' }]),
    { label: course.title, href: `#/c/${encodeURIComponent(course.id)}` },
    { label: lesson.module.title },
  ]);
}

function lessonHref(lesson) {
  return `#/c/${encodeURIComponent(state.course.id)}/${encodeURIComponent(lesson.path)}`;
}

function statusIcon(lesson) {
  if (lesson.completed) return `<span class="status done" title="Concluída">✓</span>`;
  const f = lessonFraction(lesson);
  return `<span class="status" style="--p:${Math.round(f * 100)}" title="${f ? `${Math.round(f * 100)}% assistido` : 'Não iniciada'}"></span>`;
}

function renderSidebar() {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  const scroll = sidebar.scrollTop;
  const course = state.course;
  const all = summarize(state.lessons);
  const overall = pct(all.completed, all.total);

  sidebar.innerHTML = `
    <div class="overview">
      <h1>${esc(course.title)}</h1>
      <div class="overview-row">
        <div class="ring" style="--p:${overall}"><span>${overall}%</span></div>
        <div>
          <p><strong>${all.completed}</strong> de ${all.total} aulas concluídas</p>
          <p class="muted">${formatHours(all.watchedSeconds)} de ${formatHours(all.totalSeconds)} assistidas</p>
        </div>
      </div>
    </div>
    ${course.modules.map((m) => {
      const s = summarize(m.lessons);
      const open = !state.collapsed.has(m.id);
      return `<details class="module" data-module="${esc(m.id)}" ${open ? 'open' : ''}>
        <summary>
          <span class="module-title">${esc(m.title)}</span>
          <span class="module-meta">${s.completed}/${s.total}</span>
          ${progressBar(pct(s.completed, s.total), `Progresso de ${m.title}`)}
        </summary>
        <ol class="lessons">${m.lessons.map((l) => `
          <li><a href="${lessonHref(l)}" class="lesson ${l === state.current ? 'active' : ''}" ${l === state.current ? 'aria-current="true"' : ''}>
            ${statusIcon(l)}
            <span class="lesson-title">${esc(l.title)}</span>
            <span class="lesson-time">${formatClock(l.duration)}</span>
          </a></li>`).join('')}
        </ol>
        ${m.materials.length ? `<div class="materials"><h3>Materiais do módulo</h3>${m.materials.map(fileLink).join('')}</div>` : ''}
      </details>`;
    }).join('')}`;
  sidebar.scrollTop = scroll;

  sidebar.querySelectorAll('details.module').forEach((d) => {
    d.addEventListener('toggle', () => {
      if (d.open) state.collapsed.delete(d.dataset.module);
      else state.collapsed.add(d.dataset.module);
    });
  });
}

// ---------- Player ----------

const AUTOPLAY_KEY = 'aulas-autoplay';
const SPEED_KEY = 'aulas-speed';
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

function renderPlayer() {
  const lesson = state.current;
  const prev = neighbor(-1);
  const next = neighbor(1);
  const speed = pref(SPEED_KEY, '1');

  $('#player-area').innerHTML = `
    <div class="video-wrap">
      <video id="video" controls preload="metadata" playsinline src="${mediaUrl(lesson.path)}"></video>
    </div>
    <div class="lesson-head">
      <div>
        <p class="eyebrow">${esc(lesson.module.title)} · Aula ${state.lessons.indexOf(lesson) + 1} de ${state.lessons.length}</p>
        <h2>${esc(lesson.title)}</h2>
      </div>
      <button id="toggle-done" class="btn ${lesson.completed ? 'btn-done' : ''}"></button>
    </div>
    <div class="controls">
      <a class="btn ${prev ? '' : 'disabled'}" ${prev ? `href="${lessonHref(prev)}"` : 'aria-disabled="true"'} title="Aula anterior (P)">← Anterior</a>
      <a class="btn btn-primary ${next ? '' : 'disabled'}" ${next ? `href="${lessonHref(next)}"` : 'aria-disabled="true"'} title="Próxima aula (N)">Próxima →</a>
      <label class="control">Velocidade
        <select id="speed">${['0.75', '1', '1.25', '1.5', '1.75', '2'].map((v) => `<option value="${v}" ${v === speed ? 'selected' : ''}>${v}x</option>`).join('')}</select>
      </label>
      <label class="control"><input type="checkbox" id="autoplay" ${pref(AUTOPLAY_KEY, '1') === '1' ? 'checked' : ''}> Avançar automaticamente</label>
    </div>
    ${lesson.attachments.length ? `<div class="attachments"><h3>Arquivos desta aula</h3>${lesson.attachments.map(fileLink).join('')}</div>` : ''}
    <p class="hint muted">Atalhos: espaço/K pausar · J/L ±10s · N próxima · P anterior · F tela cheia · M concluir</p>`;

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
  video.addEventListener('timeupdate', () => {
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

  $('#speed').addEventListener('change', (e) => {
    setPref(SPEED_KEY, e.target.value);
    video.playbackRate = Number(e.target.value);
  });
  $('#autoplay').addEventListener('change', (e) => setPref(AUTOPLAY_KEY, e.target.checked ? '1' : '0'));
  $('#toggle-done').addEventListener('click', toggleDone);
}

function updateDoneButton() {
  const btn = $('#toggle-done');
  if (!btn) return;
  btn.textContent = state.current.completed ? '✓ Concluída' : 'Marcar como concluída';
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
      await renderHome();
    }
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="empty"><h2>Algo deu errado</h2><p>${esc(err.message)}</p><p><a href="#/">Voltar ao início</a></p></div>`;
  }
}

addEventListener('hashchange', route);
route();
