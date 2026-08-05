import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Permite cerrar conexiones (base de datos, entre otras) cuando el proceso
  // recibe SIGTERM, en lugar de morir de golpe. Importa dentro de Docker.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Record<string, unknown>, true>);
  const port = config.get<number>('PORT');

  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
