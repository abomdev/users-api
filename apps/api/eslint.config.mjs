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

  {
    // Solo para los tests end to end.
    //
    // El cuerpo de una respuesta HTTP es `any` por naturaleza: supertest no
    // puede saber que devuelve el servidor, y comprobar precisamente eso es el
    // objetivo del test. Las reglas no-unsafe-* existen para que un `any` no se
    // filtre en silencio dentro del codigo de produccion; aca el valor viene
    // del limite de la aplicacion y se afirma sobre el de inmediato, asi que un
    // tipo equivocado se manifiesta como un test en rojo.
    //
    // Los tests unitarios NO estan incluidos: ahi todo esta tipado y las reglas
    // siguen activas.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Va ultimo a proposito: apaga las reglas de estilo que chocarian con
  // Prettier, para que no discutan entre si.
  prettierConfig,
);
