/// <reference types="vite/client" />

/*
 * Declara la forma de un modulo .vue para herramientas que usan el
 * TypeScript "de fabrica" -- entre ellas ESLint, via projectService.
 *
 * `vue-tsc` (el que corre en `pnpm build` y en `type-check`) entiende los
 * .vue de forma nativa y no necesita este shim. Pero el chequeo de tipos que
 * usa ESLint para lintear los .ts sueltos (main.ts, stores, el cliente de
 * API) es tsc puro, y sin esta declaracion "import App from './App.vue'"
 * resolveria a un tipo de error en lugar de al tipo real del componente.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, any>, Record<string, any>, any>;
  export default component;
}
