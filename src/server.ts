import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.ts';
import { getProgress, openDb, saveProgress } from './db.ts';
import { courseSummaries, courseView, lessonView } from './progress.ts';
import { getLesson, scan } from './scanner.ts';

const app = express();
app.use(express.json());

// Usado pelo HEALTHCHECK do Docker; fica antes da senha de propósito.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ---------- Senha opcional (HTTP Basic: qualquer usuário, senha = APP_PASSWORD) ----------
if (config.password) {
  const expected = Buffer.from(config.password);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString();
      const given = Buffer.from(decoded.slice(decoded.indexOf(':') + 1));
      if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Aulas", charset="UTF-8"').status(401).send('Senha necessária');
  });
}

// Interface já compilada (npm run build → dist/). Em desenvolvimento, o Vite serve o front na porta 5173.
app.use(express.static(path.join(import.meta.dirname, '..', 'dist')));

// Abre o banco já na inicialização, para um erro de permissão em DATA_DIR aparecer logo.
openDb();

// A primeira varredura roda em segundo plano; a API espera ela terminar.
const initialScan = scan();
app.use('/api', async (_req, _res, next) => {
  await initialScan;
  next();
});

// ---------- API ----------

app.get('/api/courses', (_req, res) => {
  res.json(courseSummaries());
});

app.get('/api/courses/:id', (req, res) => {
  const view = courseView(req.params.id);
  if (!view) return void res.status(404).json({ error: 'Curso não encontrado' });
  res.json(view);
});

// Salva a posição atual do vídeo. Aceita POST para funcionar com navigator.sendBeacon.
app.post('/api/progress', (req, res) => {
  const { path: relPath, position, duration } = req.body ?? {};
  const lesson = typeof relPath === 'string' ? getLesson(relPath) : undefined;
  if (!lesson) return void res.status(404).json({ error: 'Aula não encontrada' });
  if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) {
    return void res.status(400).json({ error: 'Posição inválida' });
  }

  const knownDuration = lesson.duration ?? (typeof duration === 'number' && duration > 0 ? duration : null);
  const previous = getProgress(lesson.path);
  const reachedEnd = knownDuration !== null && position / knownDuration >= config.completeThreshold;
  const row = saveProgress({
    path: lesson.path,
    position,
    duration: knownDuration,
    completed: previous?.completed || reachedEnd ? 1 : 0,
  });
  res.json(lessonView(lesson, row));
});

// Marca/desmarca uma aula como concluída manualmente.
app.post('/api/progress/complete', (req, res) => {
  const { path: relPath, completed } = req.body ?? {};
  const lesson = typeof relPath === 'string' ? getLesson(relPath) : undefined;
  if (!lesson) return void res.status(404).json({ error: 'Aula não encontrada' });

  const previous = getProgress(lesson.path);
  const row = saveProgress({
    path: lesson.path,
    // Ao desmarcar, volta ao início para não ser marcada de novo automaticamente.
    position: completed ? (previous?.position ?? 0) : 0,
    duration: previous?.duration ?? lesson.duration,
    completed: completed ? 1 : 0,
  });
  res.json(lessonView(lesson, row));
});

app.post('/api/rescan', async (_req, res) => {
  await scan();
  res.json({ ok: true });
});

// ---------- Arquivos (vídeos, PDFs, ZIPs) ----------
// sendFile já trata o cabeçalho Range, então dá pra avançar/voltar no vídeo.
app.get('/media/*file', async (req, res) => {
  const segments = (req.params as { file: string[] }).file;
  const abs = path.resolve(config.coursesDir, ...segments);
  if (!abs.startsWith(config.coursesDir + path.sep)) return void res.status(403).end();

  const stat = await fs.stat(abs).catch(() => null);
  if (!stat?.isFile()) return void res.status(404).end();

  if (req.query.download !== undefined) res.download(abs);
  else res.sendFile(abs);
});

app.listen(config.port, () => {
  console.log(`Aulas rodando em http://localhost:${config.port}`);
  console.log(`Cursos: ${config.coursesDir}${config.courseName ? ` (curso único: ${config.courseName})` : ''}`);
});
