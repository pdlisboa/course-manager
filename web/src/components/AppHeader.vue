<script setup lang="ts">
import { computed, ref } from 'vue';
import { type RouteLocationRaw, useRoute } from 'vue-router';
import AppIcon from './AppIcon.vue';
import { useReload } from '@/composables/useReload.ts';
import { useTheme } from '@/composables/useTheme.ts';
import { rescan } from '@/lib/api.ts';
import { courseRoute } from '@/lib/links.ts';
import { useCourseStore } from '@/stores/course.ts';

interface Crumb {
  label: string;
  to?: RouteLocationRaw;
}

const route = useRoute();
const store = useCourseStore();
const theme = useTheme();
const { reload } = useReload();

const crumbs = computed<Crumb[]>(() => {
  const course = store.course;
  if (route.name !== 'course' || !course) return [];
  if (!store.currentModule) return [{ label: course.title }];
  return [
    { label: 'Cursos', to: { name: 'home' } },
    { label: course.title, to: courseRoute(course.id) },
    { label: store.currentModule.title },
  ];
});

const scanning = ref(false);
async function onRescan(): Promise<void> {
  scanning.value = true;
  try {
    await rescan();
    reload();
  } finally {
    scanning.value = false;
  }
}
</script>

<template>
  <header class="topbar glass">
    <RouterLink to="/" class="brand">
      <span class="brand-icon" aria-hidden="true"><AppIcon name="play" /></span>
      <span>Aulas</span>
    </RouterLink>
    <nav class="breadcrumb">
      <template v-for="(crumb, i) in crumbs" :key="i">
        <span v-if="i > 0" class="sep">/</span>
        <RouterLink v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</RouterLink>
        <span v-else>{{ crumb.label }}</span>
      </template>
    </nav>
    <div class="topbar-actions">
      <button
        class="icon-btn"
        :class="{ spin: scanning }"
        :disabled="scanning"
        title="Reescanear pastas"
        aria-label="Reescanear pastas"
        @click="onRescan"
      >
        <AppIcon name="refresh" />
      </button>
      <button class="icon-btn" title="Alternar tema" aria-label="Alternar tema" @click="theme.toggle">
        <AppIcon name="theme" />
      </button>
    </div>
  </header>
</template>
