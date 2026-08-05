import { AccessTokenIssuer, AccessTokenPayload, IssuedAccessToken } from '../access-token.port';
import { PasswordHasher } from '../password-hasher.port';
import { GeneratedRefreshToken, RefreshTokenGenerator } from '../refresh-token-generator.port';

/**
 * Hasheo falso, reversible y sin coste.
 *
 * Usar argon2 de verdad en los tests unitarios sumaria ~30ms por operacion sin
 * probar nada nuevo: que argon2 hashea bien es responsabilidad de argon2. Lo
 * que se prueba aca es que el caso de uso lo llama cuando corresponde.
 */
export class FakePasswordHasher implements PasswordHasher {
  /** Cuantas veces se igualo el tiempo de respuesta (regla 8). */
  fakeVerifyCalls = 0;

  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return Promise.resolve(hash === `hashed:${plain}`);
  }

  fakeVerify(): Promise<void> {
    this.fakeVerifyCalls += 1;
    return Promise.resolve();
  }
}

export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  emitidos: AccessTokenPayload[] = [];
  private contador = 0;

  issue(payload: AccessTokenPayload): Promise<IssuedAccessToken> {
    this.emitidos.push(payload);
    this.contador += 1;
    return Promise.resolve({
      token: `access-token-${this.contador}`,
      expiresInSeconds: 900,
    });
  }
}

/** Genera tokens predecibles para poder afirmar sobre ellos en los tests. */
export class FakeRefreshTokenGenerator implements RefreshTokenGenerator {
  private contador = 0;

  generate(): GeneratedRefreshToken {
    this.contador += 1;
    const token = `refresh-token-${this.contador}`;
    return { token, hash: this.hashOf(token) };
  }

  hashOf(token: string): string {
    return `sha256:${token}`;
  }
}
