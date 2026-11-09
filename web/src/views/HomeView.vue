<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { CourseSummary } from '@shared/api.ts';
import CourseCard from '@/components/CourseCard.vue';
import EmptyState from '@/components/EmptyState.vue';
import { fetchCourses } from '@/lib/api.ts';
import { errorMessage } from '@/lib/format.ts';

const courses = ref<CourseSummary[] | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    courses.value = await fetchCourses();
  } catch (err) {
    console.error(err);
    error.value = errorMessage(err);
  }
});
</script>

<template>
  <EmptyState v-if="error" title="Algo deu errado"><p>{{ error }}</p></EmptyState>
  <div v-else-if="!courses" class="loading">Carregando…</div>
  <EmptyState v-else-if="!courses.length" title="Nenhum curso encontrado">
    <p>Verifique se a pasta de cursos (<code>COURSES_DIR</code>) está montada e tem subpastas com vídeos.</p>
  </EmptyState>
  <div v-else class="home">
    <h1>Seus cursos</h1>
    <p class="subtitle">{{ courses.length }} curso(s) disponível(is)</p>
    <div class="cards">
      <CourseCard v-for="course in courses" :key="course.id" :course="course" />
    </div>
  </div>
</template>
