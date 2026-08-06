import { Injectable } from '@nestjs/common';
import { RefreshToken as PrismaRefreshToken } from '../../../generated/prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { RefreshToken } from '../domain/refresh-token.entity';
import {
  NewRefreshToken,
  RefreshTokenRepository,
} from '../domain/refresh-token.repository.port';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: NewRefreshToken): Promise<RefreshToken> {
    const fila = await this.prisma.refreshToken.create({ data });
    return this.toDomain(fila);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const fila = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return fila ? this.toDomain(fila) : null;
  }

  async revokeById(id: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      // El filtro por revokedAt: null hace la operacion idempotente y preserva
      // la fecha de la primera revocacion.
      where: { id, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  private toDomain(fila: PrismaRefreshToken): RefreshToken {
    return new RefreshToken(
      fila.id,
      fila.userId,
      fila.familyId,
      fila.expiresAt,
      fila.revokedAt,
      fila.createdAt,
    );
  }
}
