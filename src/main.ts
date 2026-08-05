import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta cualquier campo que el DTO no declare. Es lo que implementa
      // "los campos extra se descartan" (seccion 6) y, de paso, la regla 5:
      // un `role: "ADMIN"` en el cuerpo del registro desaparece aca.
      whitelist: true,
      // Convierte el JSON plano en una instancia del DTO y ajusta los tipos
      // primitivos (por ejemplo, "2" del query string a numero).
      transform: true,
    }),
  );

  // Registrado despues del pipe para que tambien capture sus errores de
  // validacion y les de el formato unico de la seccion 6 de la spec.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Permite cerrar conexiones (base de datos, entre otras) cuando el proceso
  // recibe SIGTERM, en lugar de morir de golpe. Importa dentro de Docker.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Record<string, unknown>, true>);
  const port = config.get<number>('PORT');

  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
