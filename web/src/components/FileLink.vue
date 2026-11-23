<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FileItem } from '@shared/api.ts';
import AppIcon from './AppIcon.vue';
import { useViewer } from '@/composables/useViewer.ts';
import { formatSize } from '@/lib/format.ts';
import { downloadUrl, extLabel, fileIcon, isAudio, isPdf } from '@/lib/files.ts';
import { mediaUrl } from '@/lib/links.ts';

/** PDFs abrem no visualizador; áudios tocam aqui mesmo (e podem ser baixados); o resto é baixado. */
const props = defineProps<{ file: FileItem }>();
const viewer = useViewer();

const icon = computed(() => fileIcon(props.file));
const audio = computed(() => isAudio(props.file));
const pdf = computed(() => isPdf(props.file));
const playing = ref(false);
</script>

<template>
  <div v-if="audio" class="file has-player" :class="{ open: playing }">
    <button class="file-main" :aria-expanded="playing" @click="playing = !playing">
      <span class="file-icon" :class="icon.cls"><AppIcon :name="icon.icon" /></span>
      <span class="file-body">
        <span class="file-name" :title="file.name">{{ file.name }}</span>
        <small>{{ extLabel(file) }} · {{ formatSize(file.size) }}</small>
      </span>
      <span class="file-action">
        <AppIcon :name="playing ? 'close' : 'play'" /><span>{{ playing ? 'Fechar' : 'Ouvir' }}</span>
      </span>
    </button>
    <a class="file-icon-btn" :href="downloadUrl(file)" title="Baixar" aria-label="Baixar"><AppIcon name="download" /></a>
    <audio v-if="playing" class="file-player" :src="mediaUrl(file.path)" controls autoplay preload="metadata" />
  </div>
  <component
    :is="pdf ? 'button' : 'a'"
    v-else
    class="file"
    :href="pdf ? undefined : downloadUrl(file)"
    @click="pdf && viewer.open(file)"
  >
    <span class="file-icon" :class="icon.cls"><AppIcon :name="icon.icon" /></span>
    <span class="file-body">
      <span class="file-name" :title="file.name">{{ file.name }}</span>
      <small>{{ extLabel(file) }} · {{ formatSize(file.size) }}</small>
    </span>
    <span class="file-action">
      <AppIcon :name="pdf ? 'eye' : 'download'" /><span>{{ pdf ? 'Abrir' : 'Baixar' }}</span>
    </span>
  </component>
</template>
