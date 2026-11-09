<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <div class="empty">
    <h2>{{ title }}</h2>
    <slot />
  </div>
</template>
