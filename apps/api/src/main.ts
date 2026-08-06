import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  ACCESS_TOKEN_SCHEME,
  REFRESH_COOKIE_SCHEME,
} from './modules/auth/presentation/auth.controller';
import { REFRESH_COOKIE } from './modules/auth/presentation/refresh-cookie';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configuracion = app.get(ConfigService<Record<string, unknown>, true>);

  // Sin esto `request.cookies` no existe y el refresh token no se puede leer.
  app.use(cookieParser());

  // El cliente web habla con la API por un proxy del mismo origen, asi que en
  // el camino normal CORS ni siquiera interviene. Se habilita para que la API
  // siga siendo usable desde otro origen, y `credentials` es imprescindible:
  // sin el, el navegador no envia ni acepta la cookie del refresh token.
  app.enableCors({
    origin: configuracion.get<string>('WEB_ORIGIN'),
    credentials: true,
  });

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

  const port = configuracion.get<number>('PORT');

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
    // Declara la cookie del refresh token para que aparezca documentada. No
    // hace falta cargarla a mano en la interfaz: como /docs se sirve desde el
    // mismo origen que la API, el navegador la envia solo, y por eso se puede
    // probar el refresh desde ahi.
    .addCookieAuth(REFRESH_COOKIE, { type: 'apiKey', in: 'cookie' }, REFRESH_COOKIE_SCHEME)
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
