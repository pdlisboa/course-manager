// Chamadas ao servidor. Os tipos vêm de shared/api.ts, os mesmos que o servidor usa.
import type { CompletionUpdate, CourseSummary, CourseView, LessonView, ProgressUpdate } from '@shared/api.ts';

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method,
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const fetchCourses = () => request<CourseSummary[]>('/api/courses');

export const fetchCourse = (id: string) => request<CourseView>(`/api/courses/${encodeURIComponent(id)}`);

export const postProgress = (update: ProgressUpdate) =>
  request<LessonView>('/api/progress', { method: 'POST', body: update });

/** Envia a posição com sendBeacon: funciona mesmo ao fechar a aba. */
export function beaconProgress(update: ProgressUpdate): void {
  navigator.sendBeacon('/api/progress', new Blob([JSON.stringify(update)], { type: 'application/json' }));
}

export const postCompleted = (update: CompletionUpdate) =>
  request<LessonView>('/api/progress/complete', { method: 'POST', body: update });

export const rescan = () => request<{ ok: boolean }>('/api/rescan', { method: 'POST' });
