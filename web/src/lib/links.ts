import type { RouteLocationRaw } from 'vue-router';

/** URL de um arquivo dentro da pasta de cursos (vídeo, PDF, ZIP…). */
export function mediaUrl(path: string): string {
  return '/media/' + path.split('/').map(encodeURIComponent).join('/');
}

export function courseRoute(courseId: string): RouteLocationRaw {
  return { name: 'course', params: { courseId } };
}

export function lessonRoute(courseId: string, lessonPath: string): RouteLocationRaw {
  return { name: 'course', params: { courseId, lessonPath } };
}
