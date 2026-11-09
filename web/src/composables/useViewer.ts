import { computed, readonly, ref } from 'vue';
import type { FileItem } from '@shared/api.ts';

// Visualizador de PDF: um único <dialog> (PdfViewer.vue) aberto de qualquer lugar.

const file = ref<FileItem | null>(null);
const isOpen = computed(() => file.value !== null);

export function useViewer() {
  return {
    file: readonly(file),
    isOpen,
    open: (item: FileItem) => {
      file.value = item;
    },
    close: () => {
      file.value = null;
    },
  };
}
