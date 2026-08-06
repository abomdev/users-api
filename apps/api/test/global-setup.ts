import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

/**
 * Prepara la base de datos de los tests end to end.
 *
 * Corre una sola vez antes de todos los archivos de test:
 *  1. carga .env.test, que apunta a una base distinta de la de desarrollo;
 *  2. aplica las migraciones con `migrate deploy`.
 *
 * Se usa `deploy` y no `dev` a proposito: `dev` puede decidir que el historial
 * cambio y ofrecer recrear la base, que es lo ultimo que se quiere en un
 * proceso automatico. `deploy` solo aplica lo pendiente y falla si algo no
 * cuadra, que es el comportamiento correcto tanto aca como en CI.
 *
 * Si la base no existe, Prisma la crea.
 */
export default function globalSetup(): void {
  loadEnv({ path: '../../.env.test', override: true });

  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}
