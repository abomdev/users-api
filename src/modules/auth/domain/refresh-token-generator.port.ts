export interface GeneratedRefreshToken {
  /** El valor que se le entrega al cliente. Nunca se persiste. */
  token: string;
  /** Lo unico que se guarda en la base. */
  hash: string;
}

/**
 * Genera y resume refresh tokens opacos (regla 11).
 *
 * "Opaco" quiere decir que el token no contiene informacion: es puro azar. A
 * diferencia de un JWT, no se puede leer ni verificar sin consultar la base, y
 * justamente por eso se puede revocar de verdad.
 */
export interface RefreshTokenGenerator {
  generate(): GeneratedRefreshToken;

  /** Resumen del token recibido, para buscarlo entre los guardados. */
  hashOf(token: string): string;
}

export const REFRESH_TOKEN_GENERATOR = Symbol('RefreshTokenGenerator');
