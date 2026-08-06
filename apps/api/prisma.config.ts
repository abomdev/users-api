// Prisma 7 saco la URL de conexion del schema y la trajo aca.
//
// Tambien dejo de leer el .env por su cuenta: si no lo cargamos nosotros,
// env('DATABASE_URL') falla aunque el archivo exista.
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// `import 'dotenv/config'` busca `.env` relativo a process.cwd(), y pnpm
// siempre ejecuta los scripts de un paquete con el cwd puesto en ese paquete
// (apps/api). Desde la Fase 11 el .env vive en la raiz del monorepo, no aca,
// asi que ese import silencioso dejaba de encontrar nada.
//
// Resolver desde __dirname en lugar de cwd hace que la ruta no dependa de
// como ni desde donde se invoque el comando.
loadEnv({ path: join(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // Solo la usa la CLI (migrate, studio, db push). La aplicacion se conecta
  // por su cuenta a traves del adapter de pg, no por esta ruta.
  datasource: {
    url: env('DATABASE_URL'),
  },
});
