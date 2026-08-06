import { Module } from '@nestjs/common';
import { ListUsersUseCase } from './application/list-users.use-case';
import { USER_REPOSITORY } from './domain/user.repository.port';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

/**
 * Aca se ata el puerto con su implementacion. Es el unico punto del proyecto
 * donde se nombra a PrismaUserRepository: cambiarlo por otra implementacion es
 * editar esta linea y nada mas.
 */
@Module({
  controllers: [UsersController],
  providers: [
    ListUsersUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
