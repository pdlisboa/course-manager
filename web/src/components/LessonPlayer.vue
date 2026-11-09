<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { LessonView, ModuleView } from '@shared/api.ts';
import AppIcon from './AppIcon.vue';
import FilesPanel from './FilesPanel.vue';
import SpeedControl from './SpeedControl.vue';
import { useAmbient } from '@/composables/useAmbient.ts';
import { usePlayerPrefs } from '@/composables/usePlayerPrefs.ts';
import { usePlayerShortcuts } from '@/composables/usePlayerShortcuts.ts';
import { lessonRoute, mediaUrl } from '@/lib/links.ts';
import { useCourseStore } from '@/stores/course.ts';

const props = defineProps<{ courseId: string; lesson: LessonView; module: ModuleView; moduleIndex: number }>();

const store = useCourseStore();
const router = useRouter();
const ambient = useAmbient();
const { speed, autoAdvance } = usePlayerPrefs();
const video = useTemplateRef<HTMLVideoElement>('video');

const lessonIndex = computed(() => props.module.lessons.indexOf(props.lesson) + 1);

// Cada aula ganha um <video> novo (key = caminho). Se a anterior terminou com o
// avanço automático ligado, esta já começa tocando.
const autoplay = ref(false);
watch(
  () => props.lesson.path,
  () => {
    autoplay.value = store.consumeAutoplay();
    ambient.clear();
  },
  { immediate: true },
);

watch(speed, (value) => {
  if (video.value) video.value.playbackRate = Number(value);
});

function onLoadedMetadata(): void {
  const el = video.value;
  if (!el) return;
  if (Number.isFinite(el.duration)) store.setDuration(el.duration);
  // Retoma de onde parou (se não estava no finalzinho).
  const { position, completed } = props.lesson;
  if (!completed && position > 5 && position < el.duration - 5) el.currentTime = position;
  el.playbackRate = Number(speed.value);
}

function onTimeUpdate(): void {
  const el = video.value;
  if (!el) return;
  ambient.paintIfDue(el);
  if (!el.seeking) store.trackPosition(el.currentTime);
}

async function onEnded(): Promise<void> {
  const el = video.value;
  if (el) store.trackPosition(el.duration);
  await store.saveProgress();
  if (store.next && autoAdvance.value) {
    store.autoplayNext = true;
    void router.push(lessonRoute(props.courseId, store.next.path));
  }
}

function go(target: LessonView | null): void {
  if (target) void router.push(lessonRoute(props.courseId, target.path));
}

async function toggleDone(): Promise<void> {
  const lesson = await store.toggleDone();
  if (lesson && !lesson.completed && video.value) video.value.currentTime = 0;
}

usePlayerShortcuts(video, {
  next: () => go(store.next),
  previous: () => go(store.previous),
  toggleDone,
});
</script>

<template>
  <div class="player-inner">
    <div class="video-wrap">
      <video
        id="video"
        ref="video"
        :key="lesson.path"
        :src="mediaUrl(lesson.path)"
        :autoplay="autoplay"
        controls
        preload="metadata"
        playsinline
        @loadedmetadata="onLoadedMetadata"
        @loadeddata="video && ambient.paint(video)"
        @seeked="video && ambient.paint(video)"
        @timeupdate="onTimeUpdate"
        @pause="store.saveProgress()"
        @ended="onEnded"
      />
    </div>

    <div class="lesson-head">
      <div class="lesson-heading">
        <p class="eyebrow">
          <span class="pill">Módulo {{ moduleIndex }}</span> {{ module.title }} <span class="dot">·</span>
          Aula {{ lessonIndex }} de {{ module.lessons.length }}
        </p>
        <h2>{{ lesson.title }}</h2>
      </div>
      <button class="btn" :class="{ 'btn-done': lesson.completed }" @click="toggleDone">
        <AppIcon name="check" /> {{ lesson.completed ? 'Concluída' : 'Marcar como concluída' }}
      </button>
    </div>

    <div class="toolbar">
      <div class="nav-buttons">
        <RouterLink v-if="store.previous" class="btn" :to="lessonRoute(courseId, store.previous.path)" title="Aula anterior (P)">
          <AppIcon name="prev" /> Anterior
        </RouterLink>
        <a v-else class="btn disabled" aria-disabled="true"><AppIcon name="prev" /> Anterior</a>
        <RouterLink v-if="store.next" class="btn btn-primary" :to="lessonRoute(courseId, store.next.path)" title="Próxima aula (N)">
          Próxima <AppIcon name="next" />
        </RouterLink>
        <a v-else class="btn btn-primary disabled" aria-disabled="true">Próxima <AppIcon name="next" /></a>
      </div>
      <div class="player-prefs">
        <SpeedControl v-model="speed" />
        <label class="control switch">
          <input v-model="autoAdvance" type="checkbox" /><span class="switch-track" /> Avançar automaticamente
        </label>
      </div>
    </div>

    <FilesPanel :lesson="lesson" :module="module" />

    <p class="hint muted">
      Atalhos: <kbd>espaço</kbd>/<kbd>K</kbd> pausar · <kbd>J</kbd>/<kbd>L</kbd> ±10s · <kbd>N</kbd> próxima ·
      <kbd>P</kbd> anterior · <kbd>F</kbd> tela cheia · <kbd>M</kbd> concluir
    </p>
  </div>
</template>
