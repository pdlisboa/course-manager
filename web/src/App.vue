<script setup lang="ts">
import AmbientBackground from './components/AmbientBackground.vue';
import AppHeader from './components/AppHeader.vue';
import PdfViewer from './components/PdfViewer.vue';
import { useReload } from './composables/useReload.ts';

const { key } = useReload();
</script>

<template>
  <AmbientBackground />
  <AppHeader />
  <main id="app">
    <RouterView v-slot="{ Component }">
      <component :is="Component" :key="key" />
    </RouterView>
  </main>
  <PdfViewer />
</template>
