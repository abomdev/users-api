// @ts-check
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  eslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Reglas type-checked (las mismas que usa apps/api), acotadas a los .ts
  // sueltos: stores, composables, el cliente de API, los tests. `extends`
  // dentro de un objeto de config, a diferencia de spreadearlo suelto, queda
  // limitado a los `files` de ese mismo objeto -- por eso .vue no lo hereda.
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Los .vue se lintean con el parser de TypeScript pero SIN informacion de
  // tipos. El chequeo de tipos completo dentro de un <script setup> de un SFC
  // es mas fragil y mas lento que en un .ts plano, y para plantillas y
  // componentes el valor marginal es bajo frente al costo. `vue-tsc`, en el
  // script `type-check`, ya cubre los tipos de los componentes con precision.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  prettierConfig,
);
