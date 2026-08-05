import { Inject, Injectable } from '@nestjs/common';
import { normalizeEmail } from '../../users/domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository.port';
import { ACCESS_TOKEN_ISSUER, AccessTokenIssuer } from '../domain/access-token.port';
import { InvalidCredentialsError } from '../domain/auth.errors';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher.port';

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface LoginUserOutput {
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * Autenticacion con email y contrasena.
 *
 * Implementa las reglas 7 (parcial), 8 y 9 de spec.md.
 *
 * Nota de alcance: la regla 7 pide devolver tambien un refresh token. Esta
 * fase entrega solo el access token; la otra mitad se completa en la fase de
 * refresh con rotacion, junto con la familia de tokens que abre el login.
 */
@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly tokens: AccessTokenIssuer,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
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

    // Regla 9: el payload lleva sub, email y role.
    const { token, expiresInSeconds } = await this.tokens.issue({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken: token, expiresInSeconds };
  }
}
