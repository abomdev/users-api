import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../shared/prisma/prisma.service';

/**
 * Prueba de humo de la capa de datos.
 *
 * No reemplaza a los tests: existe para verificar de una sola pasada que la
 * cadena completa funciona -- config validada, inyeccion de dependencias,
 * driver adapter de pg, cliente generado por Prisma y esquema migrado -- y que
 * el codigo generado en TypeScript convive con la compilacion CommonJS de Nest.
 *
 * Se ejecuta desde `dist`, o sea por el mismo pipeline que usa la aplicacion.
 */
async function main(): Promise<void> {
  const log = new Logger('SmokeDB');
  // 'log' tiene que estar en la lista: los niveles que no se declaran aca se
  // descartan, incluidos los de este mismo script.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const email = `smoke-${Date.now()}@example.com`;

  try {
    const creado = await prisma.user.create({
      data: { email, passwordHash: 'no-es-un-hash-real-solo-para-la-prueba' },
    });
    log.log(`INSERT  ok  id=${creado.id}  role=${creado.role}`);

    const leido = await prisma.user.findUnique({ where: { email } });
    log.log(`SELECT  ok  email=${leido?.email}  createdAt=${leido?.createdAt.toISOString()}`);

    const token = await prisma.refreshToken.create({
      data: {
        userId: creado.id,
        tokenHash: `hash-de-prueba-${randomUUID()}`,
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    log.log(`INSERT  ok  refreshToken id=${token.id}`);

    // Regla 21: al borrar el usuario, sus refresh tokens caen con el.
    await prisma.user.delete({ where: { id: creado.id } });
    const huerfanos = await prisma.refreshToken.count({ where: { id: token.id } });

    if (huerfanos !== 0) {
      throw new Error(`El borrado en cascada fallo: quedaron ${huerfanos} tokens huerfanos`);
    }
    log.log('DELETE  ok  cascada verificada, 0 tokens huerfanos (regla 21)');
    log.log('Prueba de humo superada.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  new Logger('SmokeDB').error(error);
  process.exitCode = 1;
});
