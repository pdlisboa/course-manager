import { type Ref, ref, watch } from 'vue';

// Preferências salvas no navegador (tema, velocidade, avanço automático).
// localStorage pode falhar (aba anônima, bloqueio), então tudo tem fallback.
// Cada chave vira um único ref compartilhado: quem muda num lugar, muda em todos.

const prefs = new Map<string, Ref<string>>();

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function usePref(key: string, fallback: string): Ref<string> {
  let pref = prefs.get(key);
  if (!pref) {
    pref = ref(read(key, fallback));
    watch(pref, (value) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    });
    prefs.set(key, pref);
  }
  return pref;
}
