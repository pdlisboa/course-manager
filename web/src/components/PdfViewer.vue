<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue';
import { useViewer } from '@/composables/useViewer.ts';
import { mediaUrl } from '@/lib/links.ts';

const viewer = useViewer();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const url = computed(() => (viewer.file.value ? mediaUrl(viewer.file.value.path) : 'about:blank'));

watch(viewer.isOpen, (open) => {
  if (open && !dialog.value?.open) dialog.value?.showModal();
  if (!open && dialog.value?.open) dialog.value.close();
});

// Clique no fundo escurecido (fora da caixa) fecha.
function onClick(e: MouseEvent): void {
  if (e.target === dialog.value) viewer.close();
}
</script>

<template>
  <dialog ref="dialog" class="viewer" @close="viewer.close" @click="onClick">
    <div class="viewer-bar">
      <strong>{{ viewer.file.value?.name }}</strong>
      <div class="viewer-actions">
        <a class="btn" :href="url" target="_blank" rel="noopener">Abrir em nova aba</a>
        <button class="btn" @click="viewer.close">Fechar</button>
      </div>
    </div>
    <iframe :src="url" title="Visualizador de arquivo" />
  </dialog>
</template>
