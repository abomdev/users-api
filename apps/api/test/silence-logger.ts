import { Logger } from '@nestjs/common';

/**
 * Apaga los logs de Nest durante los tests.
 *
 * Varios casos de prueba ejercen a proposito caminos que registran avisos --el
 * de reuso de refresh token, por ejemplo-- y esa salida ensucia el reporte
 * hasta el punto de tapar los fallos reales.
 *
 * Se apaga la salida, no el comportamiento: el logger sigue siendo llamado, asi
 * que un test podria espiarlo si hiciera falta afirmar que algo se registro.
 */
Logger.overrideLogger(false);
