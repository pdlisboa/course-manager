// Cálculo de progresso usado pelo servidor (src/progress.ts) e pelo navegador (web/).
// Fica num único arquivo para que os dois lados nunca contem de jeitos diferentes.

export interface LessonProgress {
  duration: number | null;
  position: number;
  completed: boolean;
}

export interface ProgressSummary {
  total: number;
  completed: number;
  totalSeconds: number;
  watchedSeconds: number;
}

/** Soma aulas concluídas e segundos assistidos. */
export function summarize(lessons: readonly LessonProgress[]): ProgressSummary {
  let totalSeconds = 0;
  let watchedSeconds = 0;
  let completed = 0;
  for (const l of lessons) {
    const duration = l.duration ?? 0;
    totalSeconds += duration;
    watchedSeconds += l.completed ? duration : Math.min(l.position, duration);
    if (l.completed) completed++;
  }
  return { total: lessons.length, completed, totalSeconds, watchedSeconds };
}

/** Fração assistida de uma aula (0..1). */
export function lessonFraction(lesson: LessonProgress): number {
  if (lesson.completed) return 1;
  return lesson.duration ? Math.min(lesson.position / lesson.duration, 1) : 0;
}

/** Porcentagem inteira (0..100). */
export function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}
