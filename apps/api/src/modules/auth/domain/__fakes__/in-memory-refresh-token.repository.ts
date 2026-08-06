import { randomUUID } from 'node:crypto';
import { RefreshToken } from '../refresh-token.entity';
import { NewRefreshToken, RefreshTokenRepository } from '../refresh-token.repository.port';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly tokens = new Map<string, RefreshToken>();
  private readonly hashes = new Map<string, string>();

  create(data: NewRefreshToken): Promise<RefreshToken> {
    const token = new RefreshToken(
      randomUUID(),
      data.userId,
      data.familyId,
      data.expiresAt,
      null,
      new Date(),
    );

    this.tokens.set(token.id, token);
    this.hashes.set(data.tokenHash, token.id);
    return Promise.resolve(token);
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const id = this.hashes.get(tokenHash);
    return Promise.resolve(id ? (this.tokens.get(id) ?? null) : null);
  }

  revokeById(id: string, at: Date): Promise<void> {
    const token = this.tokens.get(id);
    // Igual que el repositorio real: no pisa la fecha de la primera revocacion.
    if (token && !token.isRevoked) {
      this.tokens.set(id, this.conRevocacion(token, at));
    }
    return Promise.resolve();
  }

  revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const [id, token] of this.tokens) {
      if (token.familyId === familyId && !token.isRevoked) {
        this.tokens.set(id, this.conRevocacion(token, at));
      }
    }
    return Promise.resolve();
  }

  private conRevocacion(token: RefreshToken, at: Date): RefreshToken {
    return new RefreshToken(
      token.id,
      token.userId,
      token.familyId,
      token.expiresAt,
      at,
      token.createdAt,
    );
  }

  // --- Utilidades solo para los tests ---

  all(): RefreshToken[] {
    return [...this.tokens.values()];
  }

  ofFamily(familyId: string): RefreshToken[] {
    return this.all().filter((t) => t.familyId === familyId);
  }
}
