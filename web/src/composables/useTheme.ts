import { watchEffect } from 'vue';
import { usePref } from './usePref.ts';

type Theme = 'light' | 'dark';

/** Tema claro/escuro. Sem escolha salva, segue o sistema. */
export function useTheme() {
  const theme = usePref('aulas-theme', '');

  watchEffect(() => {
    if (theme.value) document.documentElement.dataset.theme = theme.value;
    else delete document.documentElement.dataset.theme;
  });

  function toggle(): void {
    const isDark = theme.value ? theme.value === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next: Theme = isDark ? 'light' : 'dark';
    theme.value = next;
  }

  return { toggle };
}
