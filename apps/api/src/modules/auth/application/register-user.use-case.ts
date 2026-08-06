import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail, User } from '../../users/domain/user.entity';
import { EmailAlreadyRegisteredError } from '../../users/domain/user.errors';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository.port';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher.port';

export interface RegisterUserInput {
  email: string;
  password: string;
}

/**
 * Alta de una cuenta nueva.
 *
 * Implementa las reglas 1, 2, 3 y 5 de spec.md.
 *
 * No importa nada de Nest mas alla de los decoradores de inyeccion, ni conoce
 * HTTP, ni Prisma: recibe datos, aplica reglas y habla con puertos.
 */
@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    // Regla 1: normalizar antes de comparar, o `Ana@Example.com` se colaria
    // como una cuenta distinta de `ana@example.com`.
    const email = normalizeEmail(input.email);

    // Regla 2. Esta comprobacion existe para dar un error claro en el caso
    // normal; la garantia dura la aporta el indice unico, que el repositorio
    // traduce al mismo error si dos altas simultaneas llegan hasta la base.
    const existente = await this.users.findByEmail(email);
    if (existente) {
      throw new EmailAlreadyRegisteredError();
    }

    // Regla 3: a partir de aca la contrasena en claro no vuelve a aparecer.
    const passwordHash = await this.hasher.hash(input.password);

    // Regla 5: `NewUser` no tiene campo `role`, asi que no hay forma de crear
    // un usuario con un rol elegido desde afuera. La base pone USER por
    // defecto y el tipo impide siquiera intentar otra cosa.
    return this.users.create({ email, passwordHash });
  }
}
