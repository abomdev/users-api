import { Inject, Injectable } from '@nestjs/common';
import {
  REFRESH_TOKEN_GENERATOR,
  RefreshTokenGenerator,
} from '../domain/refresh-token-generator.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../domain/refresh-token.repository.port';

/**
 * Cierre de sesion.
 *
 * Implementa la regla 16 de spec.md.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly generator: RefreshTokenGenerator,
  ) {}

  async execute(presentedToken: string): Promise<void> {
    const almacenado = await this.refreshTokens.findByHash(
      this.generator.hashOf(presentedToken),
    );

    // Regla 16: idempotente. Un token inexistente o ya revocado no es un error;
    // el resultado deseado -- que esa sesion no sirva -- ya se cumplio.
    //
    // Y aca esta la diferencia deliberada con la regla 14: presentar un token
    // revocado en /auth/refresh revoca la familia, pero en /auth/logout no.
    // Cerrar sesion dos veces (por un reintento, o dos pestanas abiertas) es
    // completamente normal y no puede costarle al usuario todas sus sesiones.
    if (!almacenado || almacenado.isRevoked) {
      return;
    }

    await this.refreshTokens.revokeById(almacenado.id, new Date());
  }
}
