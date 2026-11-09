import { readonly, ref } from 'vue';

// Contador usado como `key` da página atual em App.vue: incrementar recria a página
// (e ela busca os dados de novo), por exemplo depois de reescanear as pastas.

const key = ref(0);

export function useReload() {
  return {
    key: readonly(key),
    reload: () => {
      key.value++;
    },
  };
}
