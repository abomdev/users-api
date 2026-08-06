import { createRouter, createWebHistory } from 'vue-router';

/**
 * Rutas de la aplicacion.
 *
 * Las de auth (login, registro) y las protegidas (perfil, panel de
 * administracion) se suman en las fases 15 y 16, junto con el guard que exige
 * sesion y el que exige rol ADMIN -- las reglas de acceso viven en
 * apps/web/spec.md, no aca.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('../WelcomeView.vue'),
    },
    {
      // Ruta temporal de la fase 14, para verificar el refresh automatico
      // antes de que exista el login real. Se borra en la fase 15.
      path: '/smoke-test',
      name: 'refresh-smoke-test',
      component: () => import('../RefreshSmokeTestView.vue'),
    },
  ],
});
