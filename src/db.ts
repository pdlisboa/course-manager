import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

// Banco SQLite com duas tabelas:
// - progress: posição/conclusão de cada vídeo (chave = caminho relativo à pasta de cursos)
// - media_meta: cache da duração dos vídeos, para não reler os arquivos a cada inicialização
//
// Importar este arquivo não abre nada: o banco é aberto no primeiro uso (ou com openDb).
// Em testes, openDb(':memory:') dá um banco limpo sem tocar no disco.

export interface ProgressRow {
  path: string;
  position: number;
  duration: number | null;
  completed: number;
  updated_at: number;
}

const SCHEMA = `
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
`;

function prepareStatements(db: DatabaseSync) {
  return {
    selectAllProgress: db.prepare('SELECT * FROM progress'),
    selectProgress: db.prepare('SELECT * FROM progress WHERE path = ?'),
    upsertProgress: db.prepare(`
      INSERT INTO progress (path, position, duration, completed, updated_at)
      VALUES (:path, :position, :duration, :completed, :updated_at)
      ON CONFLICT(path) DO UPDATE SET
        position = excluded.position,
        duration = COALESCE(excluded.duration, progress.duration),
        completed = excluded.completed,
        updated_at = excluded.updated_at
    `),
    selectMeta: db.prepare('SELECT * FROM media_meta WHERE path = ?'),
    upsertMeta: db.prepare(`
      INSERT INTO media_meta (path, size, mtime, duration) VALUES (?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET size = excluded.size, mtime = excluded.mtime, duration = excluded.duration
    `),
  };
}

type Statements = ReturnType<typeof prepareStatements>;

let connection: { db: DatabaseSync; statements: Statements } | null = null;

/** Abre (ou reabre) o banco. Sem argumento, usa DATA_DIR/progress.db. */
export function openDb(file: string = path.join(config.dataDir, 'progress.db')): void {
  closeDb();
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  connection = { db, statements: prepareStatements(db) };
}

export function closeDb(): void {
  connection?.db.close();
  connection = null;
}

function statements(): Statements {
  if (!connection) openDb();
  return connection!.statements;
}

export function getAllProgress(): Map<string, ProgressRow> {
  const rows = statements().selectAllProgress.all() as unknown as ProgressRow[];
  return new Map(rows.map((r) => [r.path, r]));
}

export function getProgress(relPath: string): ProgressRow | undefined {
  return statements().selectProgress.get(relPath) as unknown as ProgressRow | undefined;
}

export function saveProgress(row: Omit<ProgressRow, 'updated_at'>): ProgressRow {
  const full = { ...row, updated_at: Date.now() };
  statements().upsertProgress.run(full);
  return full;
}

/** Duração em cache, válida só se o arquivo não mudou (mesmo tamanho e data). */
export function getCachedDuration(relPath: string, size: number, mtime: number): number | null | undefined {
  const row = statements().selectMeta.get(relPath) as { size: number; mtime: number; duration: number | null } | undefined;
  if (!row || row.size !== size || row.mtime !== mtime) return undefined;
  return row.duration;
}

export function setCachedDuration(relPath: string, size: number, mtime: number, duration: number | null): void {
  statements().upsertMeta.run(relPath, size, mtime, duration);
}
