import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  return { app, prisma: app.get(PrismaService) };
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
