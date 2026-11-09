import type { CourseSummary, CourseView, LessonView } from '../shared/api.ts';
import { summarize } from '../shared/progress.ts';
import { getAllProgress, type ProgressRow } from './db.ts';
import { getCourse, getCourses, type Lesson } from './scanner.ts';

// Monta os dados que a interface recebe: aulas do scanner + progresso salvo no banco.
// Os tipos de saída ficam em shared/api.ts, que o front também importa.

export function lessonView(lesson: Lesson, progress: ProgressRow | undefined): LessonView {
  return {
    ...lesson,
    duration: lesson.duration ?? progress?.duration ?? null,
    position: progress?.position ?? 0,
    completed: Boolean(progress?.completed),
    updatedAt: progress?.updated_at ?? null,
  };
}

export function courseView(id: string): CourseView | null {
  const course = getCourse(id);
  if (!course) return null;
  const progress = getAllProgress();
  const modules = course.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => lessonView(l, progress.get(l.path))),
  }));
  const allLessons = modules.flatMap((m) => m.lessons);
  const last = allLessons
    .filter((l) => l.updatedAt !== null)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  return { id: course.id, title: course.title, modules, lastLesson: last?.path ?? null, ...summarize(allLessons) };
}

export function courseSummaries(): CourseSummary[] {
  return getCourses().map((c) => {
    const { modules, ...rest } = courseView(c.id)!;
    return { ...rest, moduleCount: modules.length };
  });
}
