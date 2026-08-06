import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './shared/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Los archivos de entorno viven en la raiz del monorepo, no dentro de
      // cada aplicacion: docker-compose tambien los necesita para crear la base
      // de datos, y mantener dos copias sincronizadas es una fuente segura de
      // errores. Se prueban las dos rutas para que funcione tanto ejecutando
      // desde apps/api como desde la raiz.
      //
      // Dentro de Docker no existe ninguno de los dos y no pasa nada: la
      // configuracion llega por variables de entorno del contenedor.
      envFilePath: ['../../.env', '.env'],
      // Global: cualquier modulo puede inyectar ConfigService sin reimportarlo.
      isGlobal: true,
      // Se valida una vez al arrancar (ver env.validation.ts).
      validate: validateEnv,
      // Ya validada, la config no cambia: cachearla evita releer process.env.
      cache: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
