import { defineStore } from 'pinia';
import { computed, reactive, ref, shallowRef } from 'vue';
import type { CourseView, LessonView, ModuleView } from '@shared/api.ts';
import { summarize } from '@shared/progress.ts';
import * as api from '@/lib/api.ts';

const SAVE_INTERVAL_MS = 5000;

/** Curso aberto, aula em reprodução e envio do progresso ao servidor. */
export const useCourseStore = defineStore('course', () => {
  const course = ref<CourseView | null>(null);
  const currentPath = ref<string | null>(null);
  /** Módulos expandidos na barra lateral. */
  const openModules = reactive(new Set<string>());
  /** Quando uma aula termina e o avanço automático está ligado, a próxima começa tocando. */
  const autoplayNext = shallowRef(false);
  let lastSavedAt = 0;

  const lessons = computed<LessonView[]>(() => course.value?.modules.flatMap((m) => m.lessons) ?? []);
  const moduleOf = computed(() => {
    const map = new Map<string, ModuleView>();
    for (const m of course.value?.modules ?? []) for (const l of m.lessons) map.set(l.path, m);
    return map;
  });
  const current = computed(() => lessons.value.find((l) => l.path === currentPath.value) ?? null);
  const currentModule = computed(() => (current.value ? (moduleOf.value.get(current.value.path) ?? null) : null));
  const summary = computed(() => summarize(lessons.value));

  function neighbor(offset: number): LessonView | null {
    if (!current.value) return null;
    return lessons.value[lessons.value.indexOf(current.value) + offset] ?? null;
  }
  const previous = computed(() => neighbor(-1));
  const next = computed(() => neighbor(1));

  /** Carrega o curso (se ainda não for o aberto). */
  async function load(courseId: string): Promise<void> {
    if (course.value?.id === courseId) return;
    const data = await api.fetchCourse(courseId);
    course.value = data;
    currentPath.value = null;
    openModules.clear();
  }

  /** Esquece o curso aberto (ao sair da página do curso). */
  function reset(): void {
    course.value = null;
    currentPath.value = null;
  }

  /** Aula para abrir quando a URL não diz qual: a última assistida ou a primeira não concluída. */
  function resumePath(): string | null {
    const list = lessons.value;
    return course.value?.lastLesson ?? (list.find((l) => !l.completed) ?? list[0])?.path ?? null;
  }

  /** Troca a aula atual; caminho desconhecido abre a primeira. */
  function startLesson(path: string): void {
    const lesson = lessons.value.find((l) => l.path === path) ?? lessons.value[0];
    if (!lesson || lesson === current.value) return;
    const previousModule = currentModule.value;
    if (current.value) saveProgress({ beacon: true });
    currentPath.value = lesson.path;
    if (currentModule.value && currentModule.value !== previousModule) openModules.add(currentModule.value.id);
  }

  function toggleModule(id: string): void {
    if (openModules.has(id)) openModules.delete(id);
    else openModules.add(id);
  }

  function consumeAutoplay(): boolean {
    const value = autoplayNext.value;
    autoplayNext.value = false;
    return value;
  }

  /** Atualiza a posição local; manda ao servidor no máximo a cada SAVE_INTERVAL_MS. */
  function trackPosition(position: number): void {
    if (!current.value) return;
    current.value.position = position;
    if (Date.now() - lastSavedAt > SAVE_INTERVAL_MS) void saveProgress();
  }

  /** Duração lida pelo navegador, quando o servidor não conseguiu ler. */
  function setDuration(duration: number): void {
    if (current.value && !current.value.duration) current.value.duration = duration;
  }

  function applyServerLesson(lesson: LessonView, data: LessonView): void {
    lesson.completed = data.completed;
    lesson.duration = data.duration ?? lesson.duration;
    lesson.updatedAt = data.updatedAt;
    if (course.value) course.value.lastLesson = lesson.path;
  }

  /** Envia a posição atual. Com `beacon`, usa sendBeacon (funciona ao fechar a aba). */
  async function saveProgress({ beacon = false } = {}): Promise<void> {
    const lesson = current.value;
    if (!lesson) return;
    lastSavedAt = Date.now();
    const update = { path: lesson.path, position: lesson.position, duration: lesson.duration };
    if (beacon) return api.beaconProgress(update);
    try {
      applyServerLesson(lesson, await api.postProgress(update));
    } catch (err) {
      console.warn('Falha ao salvar progresso', err);
    }
  }

  /** Marca/desmarca a aula atual. Ao desmarcar, o servidor volta a posição ao início. */
  async function toggleDone(): Promise<LessonView | null> {
    const lesson = current.value;
    if (!lesson) return null;
    const data = await api.postCompleted({ path: lesson.path, completed: !lesson.completed });
    if (!data.completed) lesson.position = 0;
    applyServerLesson(lesson, data);
    return lesson;
  }

  return {
    course,
    lessons,
    current,
    currentModule,
    summary,
    previous,
    next,
    openModules,
    moduleOf,
    autoplayNext,
    load,
    reset,
    resumePath,
    startLesson,
    toggleModule,
    consumeAutoplay,
    trackPosition,
    setDuration,
    saveProgress,
    toggleDone,
  };
});
