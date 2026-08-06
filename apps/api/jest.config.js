const swcOptions = require('./test/swc-transform');

/**
 * Configuracion de los tests unitarios.
 *
 * Prueban casos de uso contra dobles en memoria de los puertos: no levantan
 * Nest, no tocan la base y no hacen HTTP. Por eso corren en un par de segundos
 * y se pueden ejecutar en cada guardado.
 *
 * Los tests end to end tienen su propia configuracion en test/jest-e2e.config.js.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['@swc/jest', swcOptions] },
  setupFiles: ['<rootDir>/test/silence-logger.ts'],

  // La cobertura se mide sobre las capas que estos tests son responsables de
  // cubrir: dominio y casos de uso, donde viven las reglas de negocio.
  //
  // presentation e infrastructure quedan fuera a proposito. No son codigo sin
  // probar: los verifican los tests e2e, que ejercen controladores, guards,
  // validacion y repositorios reales contra Postgres. Mezclarlo todo en un
  // solo porcentaje daria un numero que no dice nada, porque sumaria lo que
  // estos tests no deben cubrir.
  collectCoverageFrom: [
    'src/modules/**/domain/**/*.ts',
    'src/modules/**/application/**/*.ts',
    'src/shared/domain/**/*.ts',
    '!src/**/__fakes__/**',
    '!src/**/*.port.ts',
  ],
  coverageDirectory: 'coverage',
};
