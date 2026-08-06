import { Inject, Injectable, Logger } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository.port';
import { InvalidRefreshTokenError } from '../domain/auth.errors';
import {
  REFRESH_TOKEN_GENERATOR,
  RefreshTokenGenerator,
} from '../domain/refresh-token-generator.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../domain/refresh-token.repository.port';
import { IssueTokenPair, TokenPair } from './issue-token-pair.service';

/**
 * Renovacion del par de tokens con rotacion.
 *
 * Implementa las reglas 12, 13, 14 y 15 de spec.md.
 */
@Injectable()
export class RefreshTokensUseCase {
  private readonly logger = new Logger(RefreshTokensUseCase.name);

  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly generator: RefreshTokenGenerator,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly issueTokenPair: IssueTokenPair,
  ) {}

  async execute(presentedToken: string): Promise<TokenPair> {
    const now = new Date();
    const hash = this.generator.hashOf(presentedToken);
    const almacenado = await this.refreshTokens.findByHash(hash);

    // Regla 15: un token que no existe no dice nada mas que "invalido".
    if (!almacenado) {
      throw new InvalidRefreshTokenError();
    }

    // Regla 14. Este es el corazon del mecanismo.
    //
    // Un token revocado que vuelve a presentarse solo puede significar que hay
    // dos copias en circulacion: la del usuario legitimo y la de quien la robo.
    // Como no hay forma de distinguir cual es cual, se corta la cadena entera.
    // El usuario legitimo tendra que volver a entrar; el atacante se queda sin
    // nada. Molestar al primero es preferible a mantener vivo al segundo.
    if (almacenado.isRevoked) {
      await this.refreshTokens.revokeFamily(almacenado.familyId, now);
      this.logger.warn(
        `Reuso de refresh token detectado. Familia ${almacenado.familyId} revocada por completo.`,
      );
      throw new InvalidRefreshTokenError();
    }

    // Regla 15: vencido tambien es invalido, sin revocar la familia -- un token
    // que caduca solo no es evidencia de robo.
    if (almacenado.isExpired(now)) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(almacenado.userId);
    if (!user) {
      // La cuenta se borro despues de emitir el token.
      throw new InvalidRefreshTokenError();
    }

    // Regla 13: primero se invalida el presentado y despues se emite el nuevo.
    // Ese orden importa: si fallara entre las dos operaciones, el resultado
    // seria una sesion cerrada de mas, nunca un token viejo que sigue vivo.
    await this.refreshTokens.revokeById(almacenado.id, now);

    return this.issueTokenPair.execute(user, {
      // Misma familia: la cadena continua.
      familyId: almacenado.familyId,
      // Regla 12: se hereda el vencimiento, no se renueva.
      refreshExpiresAt: almacenado.expiresAt,
    });
  }
}
