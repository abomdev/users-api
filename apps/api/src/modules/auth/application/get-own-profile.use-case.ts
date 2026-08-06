import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../users/domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository.port';
import { InvalidCredentialsError } from '../domain/auth.errors';

/**
 * Perfil del usuario autenticado.
 *
 * Va a la base en lugar de devolver lo que trae el token. El JWT lleva `email`
 * y `role`, pero son una foto del momento en que se emitio: si el rol cambio
 * hace cinco minutos, el token todavia dice lo viejo. Ademas la spec pide
 * `createdAt`, que no viaja en el payload.
 */
@Injectable()
export class GetOwnProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);

    if (!user) {
      // Token con firma valida pero cuenta ya inexistente: no autoriza nada.
      throw new InvalidCredentialsError();
    }

    return user;
  }
}
