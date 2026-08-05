import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from './domain/user.repository.port';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';

/**
 * Aca se ata el puerto con su implementacion. Es el unico punto del proyecto
 * donde se nombra a PrismaUserRepository: cambiarlo por otra implementacion es
 * editar esta linea y nada mas.
 */
@Module({
  providers: [{ provide: USER_REPOSITORY, useClass: PrismaUserRepository }],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
