// Formatação de tempo, tamanho e erros.

/** Duração no formato de relógio ("4:05", "1:02:03"); vazio se desconhecida. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Duração aproximada ("45s", "12min", "3h05"). */
export function formatHours(seconds: number): string {
  if (seconds > 0 && seconds < 60) return `${Math.round(seconds)}s`;
  const totalMin = Math.round((seconds || 0) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
