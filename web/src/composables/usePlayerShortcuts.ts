import { type Ref, onBeforeUnmount, onMounted } from 'vue';
import { useViewer } from './useViewer.ts';

interface ShortcutActions {
  next: () => void;
  previous: () => void;
  toggleDone: () => void;
}

/**
 * Atalhos do player: espaço/K pausar · J/L ±10s · N próxima · P anterior · F tela cheia · M concluir.
 * Ficam ativos enquanto o componente que chamou estiver montado.
 */
export function usePlayerShortcuts(video: Ref<HTMLVideoElement | null>, actions: ShortcutActions): void {
  const viewer = useViewer();

  function onKeyDown(e: KeyboardEvent): void {
    const el = video.value;
    if (!el || e.ctrlKey || e.metaKey || e.altKey || viewer.isOpen.value) return;
    const target = e.target as Element;
    if (target.closest('input, select, textarea, button')) return;
    const onVideo = target === el; // o próprio <video> já trata espaço e setas
    const key = e.key.toLowerCase();

    if ((key === ' ' && !onVideo) || key === 'k') {
      e.preventDefault();
      if (el.paused) void el.play();
      else el.pause();
    } else if (key === 'j' || (key === 'arrowleft' && !onVideo)) {
      el.currentTime = Math.max(0, el.currentTime - 10);
    } else if (key === 'l' || (key === 'arrowright' && !onVideo)) {
      el.currentTime = Math.min(el.duration || Infinity, el.currentTime + 10);
    } else if (key === 'n') {
      actions.next();
    } else if (key === 'p') {
      actions.previous();
    } else if (key === 'f') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen();
    } else if (key === 'm') {
      actions.toggleDone();
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown));
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));
}
