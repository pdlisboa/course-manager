import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { config } from './config.ts';
import { getCachedDuration, setCachedDuration } from './db.ts';

// Varre a pasta de cursos e monta a árvore curso → módulo → aula.
// Estrutura esperada: <curso>/<módulo>/<arquivos>. Arquivos com o mesmo nome base
// de um vídeo (ex.: "01 - Aula.pdf" ao lado de "01 - Aula.mp4") viram anexos da aula;
// os demais viram materiais do módulo.

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.m4v', '.mov', '.ogv']);
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export interface FileItem {
  name: string;
  /** Caminho relativo a COURSES_DIR, sempre com "/". */
  path: string;
  ext: string;
  size: number;
}

export interface Lesson {
  path: string;
  title: string;
  duration: number | null;
  attachments: FileItem[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  materials: FileItem[];
}

export interface Course {
  id: string;
  title: string;
  modules: Module[];
}

let courses: Course[] = [];
let lessonIndex = new Map<string, Lesson>();
let currentScan: Promise<void> | null = null;

export function getCourses(): Course[] {
  return courses;
}

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

export function getLesson(relPath: string): Lesson | undefined {
  return lessonIndex.get(relPath);
}

/** Remove numeração do início ("01 - Introdução" → "Introdução"). */
export function cleanTitle(name: string): string {
  return name.replace(/^\s*\d+\s*[-._)]+\s*/, '').trim() || name;
}

function toRelative(absPath: string): string {
  return path.relative(config.coursesDir, absPath).split(path.sep).join('/');
}

function sortByName<T>(items: T[], key: (item: T) => string): T[] {
  return items.sort((a, b) => collator.compare(key(a), key(b)));
}

async function listDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return sortByName(
    entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name),
    (n) => n,
  );
}

/** Lista arquivos de uma pasta; com recursive=true inclui subpastas. */
async function listFiles(dir: string, recursive: boolean): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isFile()) files.push(abs);
    else if (entry.isDirectory() && recursive) files.push(...(await listFiles(abs, true)));
  }
  return files;
}

async function buildModule(moduleDir: string, id: string, title: string, recursive: boolean): Promise<Module | null> {
  const files = await listFiles(moduleDir, recursive);
  if (files.length === 0) return null;

  const lessonsByStem = new Map<string, Lesson>();
  const others: FileItem[] = [];

  for (const abs of files) {
    const ext = path.extname(abs).toLowerCase();
    const stem = abs.slice(0, abs.length - ext.length);
    if (VIDEO_EXTENSIONS.has(ext)) {
      // Aulas em subpastas do módulo ganham o nome da subpasta como prefixo.
      const subdir = path.relative(moduleDir, path.dirname(abs));
      const baseTitle = cleanTitle(path.basename(stem));
      lessonsByStem.set(stem, {
        path: toRelative(abs),
        title: subdir ? `${subdir.split(path.sep).map(cleanTitle).join(' / ')} / ${baseTitle}` : baseTitle,
        duration: null,
        attachments: [],
      });
    } else {
      const stat = await fs.stat(abs);
      others.push({ name: path.basename(abs), path: toRelative(abs), ext, size: stat.size });
    }
  }

  const materials: FileItem[] = [];
  for (const file of others) {
    const abs = path.join(config.coursesDir, file.path);
    const stem = abs.slice(0, abs.length - file.ext.length);
    const lesson = lessonsByStem.get(stem);
    if (lesson) lesson.attachments.push(file);
    else materials.push(file);
  }

  return {
    id,
    title,
    lessons: sortByName([...lessonsByStem.values()], (l) => l.path),
    materials: sortByName(materials, (m) => m.path),
  };
}

async function buildCourse(courseDir: string, id: string, title: string): Promise<Course> {
  const modules: Module[] = [];

  // Arquivos soltos na raiz do curso viram um módulo "Geral".
  const rootModule = await buildModule(courseDir, '_root', 'Geral', false);
  if (rootModule) modules.push(rootModule);

  for (const dirName of await listDirs(courseDir)) {
    const module = await buildModule(path.join(courseDir, dirName), dirName, cleanTitle(dirName), true);
    if (module) modules.push(module);
  }
  return { id, title, modules };
}

async function readDuration(lesson: Lesson): Promise<void> {
  const abs = path.join(config.coursesDir, lesson.path);
  try {
    const stat = await fs.stat(abs);
    const cached = getCachedDuration(lesson.path, stat.size, stat.mtimeMs);
    if (cached !== undefined) {
      lesson.duration = cached;
      return;
    }
    const metadata = await parseFile(abs, { duration: true, skipCovers: true });
    lesson.duration = metadata.format.duration ?? null;
    setCachedDuration(lesson.path, stat.size, stat.mtimeMs, lesson.duration);
  } catch (err) {
    console.warn(`Não foi possível ler a duração de ${lesson.path}:`, (err as Error).message);
  }
}

/** Executa as tarefas com no máximo `limit` em paralelo. */
async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  });
  await Promise.all(workers);
}

async function doScan(): Promise<void> {
  const started = Date.now();
  let found: Course[] = [];
  try {
    if (config.courseName) {
      found = [await buildCourse(config.coursesDir, 'curso', config.courseName)];
    } else {
      for (const dirName of await listDirs(config.coursesDir)) {
        found.push(await buildCourse(path.join(config.coursesDir, dirName), dirName, dirName));
      }
    }
  } catch (err) {
    console.error(`Erro ao ler ${config.coursesDir}:`, (err as Error).message);
  }

  const index = new Map<string, Lesson>();
  for (const course of found) {
    for (const module of course.modules) {
      for (const lesson of module.lessons) index.set(lesson.path, lesson);
    }
  }
  await runPool([...index.values()], 4, readDuration);

  courses = found;
  lessonIndex = index;
  console.log(`Varredura concluída: ${found.length} curso(s), ${index.size} vídeo(s) em ${Date.now() - started} ms`);
}

/** Varre as pastas novamente. Chamadas simultâneas compartilham a mesma varredura. */
export function scan(): Promise<void> {
  currentScan ??= doScan().finally(() => {
    currentScan = null;
  });
  return currentScan;
}
