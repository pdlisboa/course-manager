import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

// Banco SQLite com duas tabelas:
// - progress: posição/conclusão de cada vídeo (chave = caminho relativo à pasta de cursos)
// - media_meta: cache da duração dos vídeos, para não reler os arquivos a cada inicialização

export interface ProgressRow {
  path: string;
  position: number;
  duration: number | null;
  completed: number;
  updated_at: number;
}

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new DatabaseSync(path.join(config.dataDir, 'progress.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS progress (
    path TEXT PRIMARY KEY,
    position REAL NOT NULL DEFAULT 0,
    duration REAL,
    completed INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS media_meta (
    path TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    mtime REAL NOT NULL,
    duration REAL
  );
`);

const selectAllProgress = db.prepare('SELECT * FROM progress');
const selectProgress = db.prepare('SELECT * FROM progress WHERE path = ?');
const upsertProgress = db.prepare(`
  INSERT INTO progress (path, position, duration, completed, updated_at)
  VALUES (:path, :position, :duration, :completed, :updated_at)
  ON CONFLICT(path) DO UPDATE SET
    position = excluded.position,
    duration = COALESCE(excluded.duration, progress.duration),
    completed = excluded.completed,
    updated_at = excluded.updated_at
`);
const selectMeta = db.prepare('SELECT * FROM media_meta WHERE path = ?');
const upsertMeta = db.prepare(`
  INSERT INTO media_meta (path, size, mtime, duration) VALUES (?, ?, ?, ?)
  ON CONFLICT(path) DO UPDATE SET size = excluded.size, mtime = excluded.mtime, duration = excluded.duration
`);

export function getAllProgress(): Map<string, ProgressRow> {
  const rows = selectAllProgress.all() as unknown as ProgressRow[];
  return new Map(rows.map((r) => [r.path, r]));
}

export function getProgress(relPath: string): ProgressRow | undefined {
  return selectProgress.get(relPath) as unknown as ProgressRow | undefined;
}

export function saveProgress(row: Omit<ProgressRow, 'updated_at'>): ProgressRow {
  const full = { ...row, updated_at: Date.now() };
  upsertProgress.run(full);
  return full;
}

/** Duração em cache, válida só se o arquivo não mudou (mesmo tamanho e data). */
export function getCachedDuration(relPath: string, size: number, mtime: number): number | null | undefined {
  const row = selectMeta.get(relPath) as { size: number; mtime: number; duration: number | null } | undefined;
  if (!row || row.size !== size || row.mtime !== mtime) return undefined;
  return row.duration;
}

export function setCachedDuration(relPath: string, size: number, mtime: number, duration: number | null): void {
  upsertMeta.run(relPath, size, mtime, duration);
}
