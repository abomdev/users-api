import Aura from '@primeuix/themes/aura';
import type { PrimeVueConfiguration } from 'primevue/config';

/**
 * Configuracion de PrimeVue, separada de main.ts para que arrancar la app no
 * se lea como una lista de decisiones de estilo mezcladas con el bootstrap.
 *
 * Aura es el preset "sin marca" de PrimeVue 5: a diferencia de Material o
 * Bootstrap, no imita el aspecto de otro sistema de diseño, asi que no hace
 * falta pelear contra el tema para que la app tenga identidad propia.
 */
export const primeVueConfig: PrimeVueConfiguration = {
  theme: {
    preset: Aura,
    options: {
      // Evita que las clases de PrimeVue ganen por especificidad de CSS antes
      // que las nuestras: sin esto, sobreescribir un estilo del tema exige
      // `!important` en vez de una regla normal.
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue',
      },
    },
  },
};
