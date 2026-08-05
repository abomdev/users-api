const swcOptions = require('./swc-transform');

/**
 * Configuracion de los tests end to end.
 *
 * A diferencia de los unitarios, estos levantan la aplicacion completa y hacen
 * peticiones HTTP reales contra Postgres. Prueban lo que los unitarios no
 * pueden: el ValidationPipe, los guards, el filtro de excepciones, los codigos
 * de estado y la serializacion.
 *
 * Se ejecutan con --runInBand (un archivo por vez): comparten una unica base de
 * datos y correrlos en paralelo haria que se pisen entre si.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['@swc/jest', swcOptions] },

  globalSetup: '<rootDir>/test/global-setup.ts',
  setupFiles: ['<rootDir>/test/load-test-env.ts', '<rootDir>/test/silence-logger.ts'],

  // Levantar Nest y hashear con argon2 de verdad es mas lento que un unitario.
  testTimeout: 30_000,
};
