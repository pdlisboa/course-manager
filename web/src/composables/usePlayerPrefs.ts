import { computed } from 'vue';
import { usePref } from './usePref.ts';

export const SPEEDS = ['0.75', '1', '1.25', '1.5', '1.75', '2'] as const;
export type Speed = (typeof SPEEDS)[number];

function isSpeed(value: string): value is Speed {
  return (SPEEDS as readonly string[]).includes(value);
}

/** Velocidade do vídeo e avanço automático para a próxima aula. */
export function usePlayerPrefs() {
  const speedPref = usePref('aulas-speed', '1');
  const autoAdvancePref = usePref('aulas-autoplay', '1');

  const speed = computed<Speed>({
    get: () => (isSpeed(speedPref.value) ? speedPref.value : '1'),
    set: (value) => (speedPref.value = value),
  });

  const autoAdvance = computed<boolean>({
    get: () => autoAdvancePref.value === '1',
    set: (value) => (autoAdvancePref.value = value ? '1' : '0'),
  });

  return { speed, autoAdvance };
}
