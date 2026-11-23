import type { FileItem } from '@shared/api.ts';
import { AUDIO_EXTENSIONS } from '@shared/media.ts';
import type { IconName } from '@/components/AppIcon.vue';
import { mediaUrl } from './links.ts';

// Como cada tipo de arquivo aparece na interface (ícone e cor).

const ARCHIVES = new Set(['.zip', '.rar', '.7z', '.tar', '.gz']);

export const isPdf = (file: FileItem): boolean => file.ext === '.pdf';
export const isAudio = (file: FileItem): boolean => AUDIO_EXTENSIONS.has(file.ext);

export function fileIcon(file: FileItem): { icon: IconName; cls: string } {
  if (isPdf(file)) return { icon: 'pdf', cls: 'is-pdf' };
  if (isAudio(file)) return { icon: 'audio', cls: 'is-audio' };
  if (ARCHIVES.has(file.ext)) return { icon: 'zip', cls: 'is-zip' };
  return { icon: 'file', cls: '' };
}

/** "PDF", "MP3"… */
export function extLabel(file: FileItem): string {
  return file.ext.replace('.', '').toUpperCase() || 'ARQUIVO';
}

export function downloadUrl(file: FileItem): string {
  return `${mediaUrl(file.path)}?download`;
}
