<script setup lang="ts">
import { computed } from 'vue';
import type { LessonView } from '@shared/api.ts';
import { lessonFraction } from '@shared/progress.ts';
import AppIcon from './AppIcon.vue';

/** Ícone de estado da aula na lista: tocando, concluída ou anel com a fração assistida. */
const props = defineProps<{ lesson: LessonView; playing: boolean }>();

const percent = computed(() => Math.round(lessonFraction(props.lesson) * 100));
</script>

<template>
  <span v-if="playing && !lesson.completed" class="status playing" title="Assistindo agora"><AppIcon name="play" /></span>
  <span v-else-if="lesson.completed" class="status done" title="Concluída"><AppIcon name="check" /></span>
  <span v-else class="status" :style="{ '--p': percent }" :title="percent ? `${percent}% assistido` : 'Não iniciada'" />
</template>
