import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../users/domain/user.entity';
import { ACCESS_TOKEN_ISSUER, AccessTokenIssuer } from '../domain/access-token.port';
import {
  REFRESH_TOKEN_GENERATOR,
  RefreshTokenGenerator,
} from '../domain/refresh-token-generator.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../domain/refresh-token.repository.port';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface IssueTokenPairOptions {
  /** Familia a la que pertenece el nuevo refresh: nueva en el login, heredada al rotar. */
  familyId: string;
  /**
   * Vencimiento del refresh.
   *
   * En el login es "ahora + REFRESH_TTL_DAYS". Al rotar se hereda el del token
   * anterior, porque la regla 12 dice que rotar no extiende la vida de la
   * familia: si cada rotacion corriera la fecha, una sesion activa nunca
   * caducaria y el limite de 7 dias no significaria nada.
   */
  refreshExpiresAt: Date;
}

/**
 * Emite un par access + refresh y persiste el refresh hasheado.
 *
 * Login y refresh necesitan exactamente lo mismo, y duplicarlo seria la via
 * mas facil de que un dia solo uno de los dos recuerde guardar el hash.
 */
@Injectable()
export class IssueTokenPair {
  constructor(
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer,
    @Inject(REFRESH_TOKEN_GENERATOR) private readonly generator: RefreshTokenGenerator,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(user: User, options: IssueTokenPairOptions): Promise<TokenPair> {
    // Regla 9: el access token lleva sub, email y role.
    const { token: accessToken, expiresInSeconds } = await this.accessTokens.issue({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { token: refreshToken, hash } = this.generator.generate();

    // Regla 11: se guarda el hash; el token viaja al cliente y no queda copia.
    await this.refreshTokens.create({
      userId: user.id,
      tokenHash: hash,
      familyId: options.familyId,
      expiresAt: options.refreshExpiresAt,
    });

    return { accessToken, refreshToken, expiresInSeconds };
  }
}
