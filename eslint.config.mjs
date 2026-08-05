// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/generated/**'],
  },
  eslint.configs.recommended,

  // recommendedTypeChecked usa el compilador para razonar sobre tipos reales,
  // asi detecta cosas que el analisis sintactico no ve (promesas sin await,
  // comparaciones imposibles, accesos a valores any).
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Va ultimo a proposito: apaga las reglas de estilo que chocarian con
  // Prettier, para que no discutan entre si.
  prettierConfig,
);
