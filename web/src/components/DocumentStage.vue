<script setup lang="ts">
import { computed } from 'vue';
import type { FileItem } from '@shared/api.ts';
import AppIcon from './AppIcon.vue';
import { useViewer } from '@/composables/useViewer.ts';
import { formatSize } from '@/lib/format.ts';
import { downloadUrl, extLabel, fileIcon, isPdf } from '@/lib/files.ts';
import { mediaUrl } from '@/lib/links.ts';

/** Área principal de uma aula sem vídeo/áudio: o PDF aberto na página, ou um cartão para baixar o arquivo. */
const props = defineProps<{ file: FileItem }>();
const viewer = useViewer();

const icon = computed(() => fileIcon(props.file));
const pdf = computed(() => isPdf(props.file));
</script>

<template>
  <div class="doc-stage glass" :class="{ 'is-pdf-stage': pdf }">
    <div class="doc-bar">
      <span class="file-icon" :class="icon.cls"><AppIcon :name="icon.icon" /></span>
      <span class="file-body">
        <span class="file-name" :title="file.name">{{ file.name }}</span>
        <small>{{ extLabel(file) }} · {{ formatSize(file.size) }}</small>
      </span>
      <div class="doc-actions">
        <button v-if="pdf" class="btn" @click="viewer.open(file)"><AppIcon name="eye" /> Tela cheia</button>
        <a class="btn" :class="{ 'btn-primary': !pdf }" :href="downloadUrl(file)"><AppIcon name="download" /> Baixar</a>
      </div>
    </div>
    <iframe v-if="pdf" :src="mediaUrl(file.path)" :title="file.name" />
  </div>
</template>
