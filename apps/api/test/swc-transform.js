/**
 * Opciones de SWC para transformar TypeScript en los tests.
 *
 * Son equivalentes a las que usa `nest build`: si divergieran, un test podria
 * pasar sobre un codigo distinto del que se despliega.
 *
 * Vive en su propio archivo porque lo comparten las dos configuraciones de
 * Jest, y porque exportarlo desde una de ellas haria que Jest se queje de una
 * opcion desconocida.
 */
module.exports = {
  // Imprescindible: sin esto, @swc/jest lee el .swcrc de la raiz, cuyo
  // `exclude` filtra los archivos .spec.ts para que no terminen en dist. El
  // resultado seria que Jest no puede transformar sus propios tests
  // ("cannot process file because it's ignored by .swcrc").
  //
  // El .swcrc manda en el build; estas opciones mandan en los tests.
  swcrc: false,

  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    // Sin decoratorMetadata, la inyeccion de dependencias de Nest no funciona
    // dentro de los tests.
    transform: { legacyDecorator: true, decoratorMetadata: true },
    target: 'es2023',
  },
  module: { type: 'commonjs' },
};
