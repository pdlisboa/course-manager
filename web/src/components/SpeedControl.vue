<script setup lang="ts">
import { SPEEDS, type Speed } from '@/composables/usePlayerPrefs.ts';

const speed = defineModel<Speed>({ required: true });
</script>

<template>
  <div class="segmented glass" role="group" aria-label="Velocidade">
    <button v-for="value in SPEEDS" :key="value" :aria-pressed="value === speed" @click="speed = value">
      {{ value.replace('.', ',') }}×
    </button>
  </div>
</template>
