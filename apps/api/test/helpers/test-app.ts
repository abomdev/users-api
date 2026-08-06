import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/shared/http/all-exceptions.filter';
import { PrismaService } from '../../src/shared/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

/**
 * Levanta la aplicacion con la MISMA configuracion global que main.ts.
 *
 * Es la parte delicada de un test end to end: si aca faltara el ValidationPipe
 * o el filtro de excepciones, los tests pasarian probando una aplicacion que no
 * es la que se despliega. Cualquier cambio en el arranque de main.ts tiene que
 * replicarse aca.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  // Sin cookieParser, request.cookies no existe y todo el flujo de refresh
  // fallaria en los tests por un motivo que no tiene nada que ver con la logica.
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/**
 * Extrae el valor de la cookie de refresh de una respuesta, listo para volver a
 * enviarlo en una cabecera `Cookie`.
 *
 * Se manejan las cookies a mano en lugar de usar `request.agent`, que las
 * recuerda solo: los tests de reuso necesitan justamente presentar una cookie
 * vieja despues de que fue rotada, y un agente ya la habria reemplazado.
 */
export function refreshCookieDe(response: { headers: Record<string, unknown> }): string {
  const cabeceras = response.headers['set-cookie'];
  const lista = Array.isArray(cabeceras) ? (cabeceras as string[]) : [];
  const cookie = lista.find((c) => c.startsWith('refresh_token='));

  // Solo el par nombre=valor; los atributos (HttpOnly, Path...) no se reenvian.
  return cookie?.split(';')[0] ?? '';
}

/** La cabecera Set-Cookie completa, para poder afirmar sobre sus atributos. */
export function setCookieCrudo(response: { headers: Record<string, unknown> }): string {
  const cabeceras = response.headers['set-cookie'];
  const lista = Array.isArray(cabeceras) ? (cabeceras as string[]) : [];
  return lista.find((c) => c.startsWith('refresh_token=')) ?? '';
}

/**
 * Deja la base vacia.
 *
 * Los refresh tokens se borrarian solos por la cascada, pero se hace explicito
 * para no depender de ese detalle en la preparacion de los tests.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
