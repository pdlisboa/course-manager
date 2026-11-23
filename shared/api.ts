// Formato dos dados trocados entre servidor e navegador.
// O servidor (src/progress.ts, src/server.ts) produz estes tipos e o front (web/src/lib/api.ts) consome.
import type { ProgressSummary } from './progress.ts';

export interface FileItem {
  name: string;
  /** Caminho relativo a COURSES_DIR, sempre com "/". */
  path: string;
  ext: string;
  size: number;
}

/** video/audio tocam no player; file é um documento (PDF, ZIP…) que só se abre ou baixa. */
export type LessonKind = 'video' | 'audio' | 'file';

export interface LessonView {
  path: string;
  title: string;
  kind: LessonKind;
  /** O arquivo principal da aula (o próprio vídeo, áudio ou documento). */
  file: FileItem;
  duration: number | null;
  attachments: FileItem[];
  position: number;
  completed: boolean;
  updatedAt: number | null;
}

export interface ModuleView {
  id: string;
  title: string;
  lessons: LessonView[];
  materials: FileItem[];
}

/** GET /api/courses/:id */
export interface CourseView extends ProgressSummary {
  id: string;
  title: string;
  modules: ModuleView[];
  /** Última aula assistida, para continuar de onde parou. */
  lastLesson: string | null;
}

/** GET /api/courses (um item por curso) */
export interface CourseSummary extends Omit<CourseView, 'modules'> {
  moduleCount: number;
}

/** POST /api/progress */
export interface ProgressUpdate {
  path: string;
  position: number;
  duration: number | null;
}

/** POST /api/progress/complete */
export interface CompletionUpdate {
  path: string;
  completed: boolean;
}
