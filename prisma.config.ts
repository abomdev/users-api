// Prisma 7 saco la URL de conexion del schema y la trajo aca.
//
// Tambien dejo de leer el .env por su cuenta: si no lo cargamos nosotros,
// env('DATABASE_URL') falla aunque el archivo exista.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

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
