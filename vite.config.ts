import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const dir = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Front em web/, compilado para dist/ (que o Express serve em produção).
// Em desenvolvimento, o Vite roda na 5173 e repassa /api e /media para o Express.
const apiTarget = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  root: dir('./web'),
  plugins: [vue()],
  resolve: {
    alias: {
      '@': dir('./web/src'),
      '@shared': dir('./shared'),
    },
  },
  server: {
    proxy: {
      '/api': apiTarget,
      '/media': apiTarget,
    },
  },
  build: {
    outDir: dir('./dist'),
    emptyOutDir: true,
  },
});
