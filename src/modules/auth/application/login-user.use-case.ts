import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeEmail } from '../../users/domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository.port';
import { InvalidCredentialsError } from '../domain/auth.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher.port';
import { IssueTokenPair, TokenPair } from './issue-token-pair.service';

export interface LoginUserInput {
  email: string;
  password: string;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Autenticacion con email y contrasena.
 *
 * Implementa las reglas 7, 8, 9, 11 y 12 de spec.md.
 */
@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly issueTokenPair: IssueTokenPair,
    private readonly config: ConfigService<Record<string, unknown>, true>,
  ) {}

  async execute(input: LoginUserInput): Promise<TokenPair> {
    const email = normalizeEmail(input.email);
    const user = await this.users.findByEmail(email);

    if (!user) {
      // Regla 8. Devolver el error aca sin mas seria mucho mas rapido que el
      // camino con usuario existente, y esa diferencia de tiempo alcanza para
      // deducir que emails estan registrados. Se gasta el mismo trabajo.
      await this.hasher.fakeVerify();
      throw new InvalidCredentialsError();
    }

    const coincide = await this.hasher.verify(user.passwordHash, input.password);
    if (!coincide) {
      // Mismo error y mismo mensaje que el caso anterior, a proposito.
      throw new InvalidCredentialsError();
    }

    const dias = this.config.get<number>('REFRESH_TTL_DAYS');

    // Regla 7: cada login abre una familia nueva. Asi las sesiones son
    // independientes -- revocar la del telefono no cierra la de la notebook.
    return this.issueTokenPair.execute(user, {
      familyId: randomUUID(),
      refreshExpiresAt: new Date(Date.now() + dias * MS_POR_DIA),
    });
  }
}
