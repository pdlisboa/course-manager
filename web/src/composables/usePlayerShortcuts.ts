import { type Ref, onBeforeUnmount, onMounted } from 'vue';
import { useViewer } from './useViewer.ts';

interface ShortcutActions {
  next: () => void;
  previous: () => void;
  toggleDone: () => void;
}

/**
 * Atalhos do player: espaço/K pausar · J/L ±10s · N próxima · P anterior · F tela cheia · M concluir.
 * Ficam ativos enquanto o componente que chamou estiver montado. Em aulas sem player (documentos),
 * só N, P e M funcionam.
 */
export function usePlayerShortcuts(media: Ref<HTMLMediaElement | null>, actions: ShortcutActions): void {
  const viewer = useViewer();

  function onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || viewer.isOpen.value) return;
    const target = e.target as Element;
    if (target.closest('input, select, textarea, button')) return;
    // Outro player na página (ex.: áudio de um anexo) cuida das próprias teclas.
    if (target instanceof HTMLMediaElement && target !== media.value) return;
    const key = e.key.toLowerCase();

    if (key === 'n') return actions.next();
    if (key === 'p') return actions.previous();
    if (key === 'm') return actions.toggleDone();

    const el = media.value;
    if (!el) return;
    const onMedia = target === el; // o próprio elemento já trata espaço e setas
    if ((key === ' ' && !onMedia) || key === 'k') {
      e.preventDefault();
      if (el.paused) void el.play();
      else el.pause();
    } else if (key === 'j' || (key === 'arrowleft' && !onMedia)) {
      el.currentTime = Math.max(0, el.currentTime - 10);
    } else if (key === 'l' || (key === 'arrowright' && !onMedia)) {
      el.currentTime = Math.min(el.duration || Infinity, el.currentTime + 10);
    } else if (key === 'f' && el instanceof HTMLVideoElement) {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen();
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown));
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));
}
