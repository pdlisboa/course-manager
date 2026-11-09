<script setup lang="ts">
import { computed } from 'vue';
import type { FileItem, LessonView, ModuleView } from '@shared/api.ts';
import FileLink from './FileLink.vue';

/** Arquivos abaixo do vídeo: os da aula atual + os materiais do módulo (iguais para todas as aulas do módulo). */
const props = defineProps<{ lesson: LessonView; module: ModuleView }>();

const groups = computed(() => {
  const list: { title: string; files: FileItem[] }[] = [];
  if (props.lesson.attachments.length) list.push({ title: 'Desta aula', files: props.lesson.attachments });
  if (props.module.materials.length) list.push({ title: 'Materiais do módulo', files: props.module.materials });
  return list;
});
const count = computed(() => groups.value.reduce((n, g) => n + g.files.length, 0));
</script>

<template>
  <section v-if="count" class="files-panel" aria-labelledby="files-title">
    <header class="files-head">
      <h2 id="files-title">Arquivos</h2>
      <span class="muted">{{ count }} {{ count === 1 ? 'arquivo' : 'arquivos' }}</span>
    </header>
    <div class="files-groups">
      <div v-for="group in groups" :key="group.title" class="files-group">
        <h3>{{ group.title }}</h3>
        <div class="file-list glass">
          <FileLink v-for="file in group.files" :key="file.path" :file="file" />
        </div>
      </div>
    </div>
  </section>
</template>
