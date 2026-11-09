<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import type { CourseView } from '@shared/api.ts';
import { pct } from '@shared/progress.ts';
import SidebarModule from './SidebarModule.vue';
import { formatHours } from '@/lib/format.ts';
import { useCourseStore } from '@/stores/course.ts';

defineProps<{ course: CourseView }>();
const store = useCourseStore();
const list = useTemplateRef<HTMLElement>('list');

const overall = computed(() => pct(store.summary.completed, store.summary.total));

// Ao trocar de aula, rola a lista até ela se estiver fora de vista.
watch(
  () => store.current?.path,
  async () => {
    await nextTick();
    const active = list.value?.querySelector('.lesson.active');
    if (!list.value || !active) return;
    const a = active.getBoundingClientRect();
    const b = list.value.getBoundingClientRect();
    if (a.top < b.top || a.bottom > b.bottom) active.scrollIntoView({ block: 'center' });
  },
  { immediate: true, flush: 'post' },
);
</script>

<template>
  <aside class="sidebar glass" aria-label="Conteúdo do curso">
    <div class="overview">
      <p class="overview-label">Curso</p>
      <h1>{{ course.title }}</h1>
      <div class="overview-row">
        <div class="ring" :style="{ '--p': overall }"><span>{{ overall }}%</span></div>
        <div>
          <p><strong>{{ store.summary.completed }}</strong> de {{ store.summary.total }} aulas concluídas</p>
          <p class="muted">
            {{ formatHours(store.summary.watchedSeconds) }} de {{ formatHours(store.summary.totalSeconds) }} assistidas
          </p>
        </div>
      </div>
    </div>
    <div ref="list" class="module-list">
      <SidebarModule v-for="(m, i) in course.modules" :key="m.id" :module="m" :index="i" :course-id="course.id" />
    </div>
  </aside>
</template>
