import { ref, shallowRef, watch } from 'vue';

// Fundo ambiente: um quadro do vídeo, reduzido e desfocado, pinta o fundo. É o que dá cor ao vidro.
// O <canvas> fica em AmbientBackground.vue; o player chama paint() de tempos em tempos.

const INTERVAL_MS = 4000;
const canvas = shallowRef<HTMLCanvasElement | null>(null);
const active = ref(false);
let paintedAt = 0;

// O CSS (body.has-ambient) troca as bolhas padrão pelo quadro do vídeo.
watch(active, (on) => document.body.classList.toggle('has-ambient', on));

function paint(video: HTMLVideoElement): void {
  paintedAt = Date.now();
  if (!canvas.value || video.readyState < 2 || !video.videoWidth) return;
  try {
    const ctx = canvas.value.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const { width, height } = canvas.value;
    ctx.drawImage(video, 0, 0, width, height);
    // Quadro quase todo preto (ex.: início do vídeo) não dá cor nenhuma: mantém o fundo padrão.
    const px = ctx.getImageData(0, 0, width, height).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i]! + px[i + 1]! + px[i + 2]!;
    active.value = sum / (px.length / 4) > 30;
  } catch {
    active.value = false;
  }
}

export function useAmbient() {
  return {
    canvas,
    paint,
    /** Pinta só se já passou tempo suficiente desde o último quadro. */
    paintIfDue: (video: HTMLVideoElement) => {
      if (Date.now() - paintedAt > INTERVAL_MS) paint(video);
    },
    clear: () => {
      active.value = false;
    },
  };
}
