import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ACCESS_TOKEN_SCHEME } from './modules/auth/presentation/auth.controller';
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

  setupSwagger(app);

  // Permite cerrar conexiones (base de datos, entre otras) cuando el proceso
  // recibe SIGTERM, en lugar de morir de golpe. Importa dentro de Docker.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Record<string, unknown>, true>);
  const port = config.get<number>('PORT');

  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Documentacion en http://localhost:${port}/docs`, 'Bootstrap');
}

/**
 * Documentacion OpenAPI en /docs.
 *
 * Se genera a partir de los decoradores del codigo, no de un archivo aparte:
 * asi no puede quedar desactualizada respecto de lo que la API realmente hace.
 *
 * Nota: aca queda expuesta siempre. En una API con usuarios reales conviene
 * publicarla solo fuera de produccion, o detras de autenticacion.
 */
function setupSwagger(app: Parameters<typeof SwaggerModule.createDocument>[0]): void {
  const config = new DocumentBuilder()
    .setTitle('API de usuarios')
    .setDescription(
      'Autenticacion con JWT: registro, login, refresh con rotacion, logout, perfil propio ' +
        'y listado paginado para administradores. Las reglas citadas (regla N) son las de spec.md.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      // El nombre tiene que coincidir con el de @ApiBearerAuth() en los
      // controladores, o el boton Authorize no se aplica a esas rutas.
      ACCESS_TOKEN_SCHEME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      // Conserva el token al recargar la pagina, para no tener que pegarlo
      // otra vez en cada prueba.
      persistAuthorization: true,
    },
  });
}

void bootstrap();
