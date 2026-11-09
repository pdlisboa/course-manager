<script setup lang="ts">
import { computed } from 'vue';
import type { ModuleView } from '@shared/api.ts';
import { pct, summarize } from '@shared/progress.ts';
import AppIcon from './AppIcon.vue';
import LessonStatus from './LessonStatus.vue';
import { formatClock, formatHours } from '@/lib/format.ts';
import { lessonRoute } from '@/lib/links.ts';
import { useCourseStore } from '@/stores/course.ts';

const props = defineProps<{ module: ModuleView; index: number; courseId: string }>();
const store = useCourseStore();

const summary = computed(() => summarize(props.module.lessons));
const percent = computed(() => pct(summary.value.completed, summary.value.total));
const done = computed(() => summary.value.total > 0 && summary.value.completed === summary.value.total);
const open = computed(() => store.openModules.has(props.module.id));
const isCurrent = computed(() => store.currentModule?.id === props.module.id);
const fileCount = computed(
  () => props.module.materials.length + props.module.lessons.reduce((n, l) => n + l.attachments.length, 0),
);
</script>

<template>
  <section class="module" :class="{ open, current: isCurrent, complete: done }">
    <button class="module-head" :aria-expanded="open" @click="store.toggleModule(module.id)">
      <span class="module-index">
        <AppIcon v-if="done" name="check" />
        <template v-else>{{ String(index + 1).padStart(2, '0') }}</template>
      </span>
      <span class="module-info">
        <span class="module-title">{{ module.title }}</span>
        <span class="module-meta">
          {{ summary.completed }}/{{ summary.total }} aulas · {{ formatHours(summary.totalSeconds) }}
          <template v-if="fileCount"> · <AppIcon name="clip" class="icon-xs" /> {{ fileCount }}</template>
        </span>
        <span class="module-bar" aria-hidden="true"><span :style="{ width: `${percent}%` }" /></span>
      </span>
      <AppIcon name="chevron" class="chevron" />
    </button>
    <ol class="lessons" :hidden="!open">
      <li v-for="(lesson, j) in module.lessons" :key="lesson.path">
        <RouterLink
          :to="lessonRoute(courseId, lesson.path)"
          class="lesson"
          :class="{ active: lesson === store.current, completed: lesson.completed }"
          :aria-current="lesson === store.current ? 'true' : undefined"
        >
          <LessonStatus :lesson="lesson" :playing="lesson === store.current" />
          <span class="lesson-title"><span class="lesson-num">{{ j + 1 }}.</span> {{ lesson.title }}</span>
          <span v-if="lesson.attachments.length" class="lesson-clip" :title="`${lesson.attachments.length} arquivo(s)`">
            <AppIcon name="clip" class="icon-xs" />
          </span>
          <span class="lesson-time">{{ formatClock(lesson.duration) }}</span>
        </RouterLink>
      </li>
    </ol>
  </section>
</template>
