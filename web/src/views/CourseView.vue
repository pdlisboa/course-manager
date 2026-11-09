<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CourseSidebar from '@/components/CourseSidebar.vue';
import EmptyState from '@/components/EmptyState.vue';
import LessonPlayer from '@/components/LessonPlayer.vue';
import { useAmbient } from '@/composables/useAmbient.ts';
import { errorMessage } from '@/lib/format.ts';
import { lessonRoute } from '@/lib/links.ts';
import { useCourseStore } from '@/stores/course.ts';

const props = defineProps<{ courseId: string; lessonPath?: string }>();

const store = useCourseStore();
const router = useRouter();
const ambient = useAmbient();
const error = ref<string | null>(null);

const moduleIndex = computed(() =>
  store.course && store.currentModule ? store.course.modules.indexOf(store.currentModule) + 1 : 0,
);

// Carrega o curso e escolhe a aula a cada mudança de URL.
watch(
  () => [props.courseId, props.lessonPath] as const,
  async ([courseId, lessonPath]) => {
    try {
      error.value = null;
      await store.load(courseId);
      if (!store.lessons.length) return;
      if (!lessonPath) {
        // Sem aula na URL: continua de onde parou, ou a primeira não concluída.
        const target = store.resumePath();
        if (target) await router.replace(lessonRoute(courseId, target));
        return;
      }
      store.startLesson(lessonPath);
    } catch (err) {
      console.error(err);
      error.value = errorMessage(err);
    }
  },
  { immediate: true },
);

// Salva a posição ao sair ou trocar de aba.
const saveNow = () => store.saveProgress({ beacon: true });
const onVisibility = () => document.visibilityState === 'hidden' && saveNow();
onMounted(() => {
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  removeEventListener('pagehide', saveNow);
  document.removeEventListener('visibilitychange', onVisibility);
  saveNow();
  store.reset();
  ambient.clear();
});
</script>

<template>
  <EmptyState v-if="error" title="Algo deu errado">
    <p>{{ error }}</p>
    <p><RouterLink to="/">Voltar ao início</RouterLink></p>
  </EmptyState>
  <div v-else-if="!store.course" class="loading">Carregando…</div>
  <EmptyState v-else-if="!store.lessons.length" :title="store.course.title">
    <p>Nenhum vídeo encontrado neste curso.</p>
  </EmptyState>
  <div v-else class="course">
    <section class="player-area">
      <LessonPlayer
        v-if="store.current && store.currentModule"
        :course-id="store.course.id"
        :lesson="store.current"
        :module="store.currentModule"
        :module-index="moduleIndex"
      />
    </section>
    <CourseSidebar :course="store.course" />
  </div>
</template>
