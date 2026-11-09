<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { useAmbient } from '@/composables/useAmbient.ts';

const ambient = useAmbient();
const el = useTemplateRef<HTMLCanvasElement>('canvas');

onMounted(() => (ambient.canvas.value = el.value));
onBeforeUnmount(() => (ambient.canvas.value = null));
</script>

<template>
  <div class="ambient" aria-hidden="true">
    <span class="blob b1" /><span class="blob b2" /><span class="blob b3" />
    <canvas id="ambient-canvas" ref="canvas" width="32" height="18" />
  </div>
</template>
