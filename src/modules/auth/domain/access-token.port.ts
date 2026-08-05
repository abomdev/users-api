import { Role } from '../../../shared/domain/role.enum';

/** Contenido del access token (regla 9). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface IssuedAccessToken {
  token: string;
  /** Segundos hasta el vencimiento, calculados del token realmente emitido. */
  expiresInSeconds: number;
}

export interface AccessTokenIssuer {
  issue(payload: AccessTokenPayload): Promise<IssuedAccessToken>;
}

export const ACCESS_TOKEN_ISSUER = Symbol('AccessTokenIssuer');
