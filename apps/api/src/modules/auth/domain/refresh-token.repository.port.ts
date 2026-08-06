import { RefreshToken } from './refresh-token.entity';

export interface NewRefreshToken {
  userId: string;
  /** SHA-256 del token entregado al cliente (regla 11). */
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(data: NewRefreshToken): Promise<RefreshToken>;

  /** Busca por hash. El valor original nunca se guarda, asi que es la unica via. */
  findByHash(tokenHash: string): Promise<RefreshToken | null>;

  /** Revoca un token concreto. Idempotente: revocar dos veces no falla. */
  revokeById(id: string, at: Date): Promise<void>;

  /**
   * Revoca de una sola vez todos los tokens vigentes de una familia (regla 14).
   *
   * Va en el repositorio y no como un bucle en el caso de uso porque tiene que
   * ser una sola operacion atomica: si se revocaran de a uno y el proceso se
   * cayera a mitad, quedaria una familia parcialmente valida.
   */
  revokeFamily(familyId: string, at: Date): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');
