<script setup lang="ts">
import { computed } from 'vue';
import type { CourseSummary } from '@shared/api.ts';
import { pct } from '@shared/progress.ts';
import AppIcon from './AppIcon.vue';
import ProgressBar from './ProgressBar.vue';
import { formatHours } from '@/lib/format.ts';
import { courseRoute } from '@/lib/links.ts';

const props = defineProps<{ course: CourseSummary }>();

const percent = computed(() => pct(props.course.completed, props.course.total));
const cta = computed(() => {
  if (percent.value === 100) return 'Rever curso';
  return props.course.completed || props.course.watchedSeconds ? 'Continuar' : 'Começar';
});
</script>

<template>
  <RouterLink class="card glass" :to="courseRoute(course.id)">
    <div class="card-top">
      <span class="card-icon"><AppIcon name="play" /></span>
      <div>
        <h2>{{ course.title }}</h2>
        <p class="muted">
          {{ course.moduleCount }} módulo(s) · {{ course.total }} aula(s) · {{ formatHours(course.totalSeconds) }}
        </p>
      </div>
    </div>
    <ProgressBar :value="percent" label="Progresso do curso" />
    <p class="stats">
      <strong>{{ percent }}%</strong>
      <span class="muted">
        {{ course.completed }}/{{ course.total }} aulas · {{ formatHours(course.watchedSeconds) }} assistidas
      </span>
    </p>
    <span class="card-cta">{{ cta }} <AppIcon name="next" /></span>
  </RouterLink>
</template>
