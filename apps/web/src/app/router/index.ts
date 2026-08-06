import { createRouter, createWebHistory } from 'vue-router';

/**
 * Rutas de la aplicacion.
 *
 * Por ahora solo existe la bienvenida. Las de auth (login, registro) y las
 * protegidas (perfil, panel de administracion) se suman en las fases 15 y 16,
 * junto con el guard que exige sesion y el que exige rol ADMIN -- las reglas
 * de acceso viven en apps/web/spec.md, no aca.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('../WelcomeView.vue'),
    },
  ],
});
