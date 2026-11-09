import { createRouter, createWebHashHistory } from 'vue-router';
import { useViewer } from './composables/useViewer.ts';
import CourseView from './views/CourseView.vue';
import HomeView from './views/HomeView.vue';

// Rotas com hash, iguais às da versão anterior (links salvos continuam valendo):
//   #/                    → lista de cursos
//   #/c/<curso>           → curso (abre a última aula assistida)
//   #/c/<curso>/<aula>    → curso com a aula escolhida (o caminho da aula vai codificado, com %2F)
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/c/:courseId/:lessonPath(.*)?',
      name: 'course',
      component: CourseView,
      props: (route) => ({
        courseId: String(route.params.courseId),
        lessonPath: route.params.lessonPath ? String(route.params.lessonPath) : undefined,
      }),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.afterEach(() => useViewer().close());
