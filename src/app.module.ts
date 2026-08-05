import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Global: cualquier modulo puede inyectar ConfigService sin reimportarlo.
      isGlobal: true,
      // Se valida una vez al arrancar (ver env.validation.ts).
      validate: validateEnv,
      // Ya validada, la config no cambia: cachearla evita releer process.env.
      cache: true,
    }),
  ],
})
export class AppModule {}
