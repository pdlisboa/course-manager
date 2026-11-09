<script setup lang="ts">
/** Barra de progresso; `value` vai de 0 a 100. */
defineProps<{ value: number; label?: string }>();
</script>

<template>
  <div class="bar" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100" :aria-label="label">
    <span :style="{ width: `${value}%` }" />
  </div>
</template>
