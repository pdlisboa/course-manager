// Tipos de arquivo reconhecidos pelo servidor (src/scanner.ts) e pelo navegador (web/).

export const VIDEO_EXTENSIONS: ReadonlySet<string> = new Set(['.mp4', '.webm', '.m4v', '.mov', '.ogv']);
export const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wav', '.flac']);
