<script setup lang="ts">
import { computed } from 'vue';
import type { FileItem } from '@shared/api.ts';
import AppIcon, { type IconName } from './AppIcon.vue';
import { useViewer } from '@/composables/useViewer.ts';
import { formatSize } from '@/lib/format.ts';
import { mediaUrl } from '@/lib/links.ts';

/** PDFs abrem no visualizador; o resto é baixado. */
const props = defineProps<{ file: FileItem }>();
const viewer = useViewer();

const ARCHIVES = ['.zip', '.rar', '.7z', '.tar', '.gz'];

interface Kind {
  icon: IconName;
  cls: string;
  action: string;
  actionIcon: IconName;
}

const isPdf = computed(() => props.file.ext === '.pdf');
const kind = computed<Kind>(() => {
  if (isPdf.value) return { icon: 'pdf', cls: 'is-pdf', action: 'Abrir', actionIcon: 'eye' };
  if (ARCHIVES.includes(props.file.ext)) return { icon: 'zip', cls: 'is-zip', action: 'Baixar', actionIcon: 'download' };
  return { icon: 'file', cls: '', action: 'Baixar', actionIcon: 'download' };
});
const extLabel = computed(() => props.file.ext.replace('.', '').toUpperCase() || 'ARQUIVO');
</script>

<template>
  <component
    :is="isPdf ? 'button' : 'a'"
    class="file"
    :href="isPdf ? undefined : `${mediaUrl(file.path)}?download`"
    @click="isPdf && viewer.open(file)"
  >
    <span class="file-icon" :class="kind.cls"><AppIcon :name="kind.icon" /></span>
    <span class="file-body">
      <span class="file-name" :title="file.name">{{ file.name }}</span>
      <small>{{ extLabel }} · {{ formatSize(file.size) }}</small>
    </span>
    <span class="file-action"><AppIcon :name="kind.actionIcon" /><span>{{ kind.action }}</span></span>
  </component>
</template>
