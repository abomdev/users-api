import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { Role as PrismaRole, User as PrismaUser } from '../../../generated/prisma/client';
import { Role } from '../domain/role.enum';
import { User } from '../domain/user.entity';
import { EmailAlreadyRegisteredError } from '../domain/user.errors';
import { NewUser, UserRepository } from '../domain/user.repository.port';

/** Postgres viola el indice unico de `email`. */
const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const fila = await this.prisma.user.findUnique({ where: { email } });
    return fila ? this.toDomain(fila) : null;
  }

  async create(data: NewUser): Promise<User> {
    try {
      const fila = await this.prisma.user.create({ data });
      return this.toDomain(fila);
    } catch (error) {
      // La comprobacion previa del caso de uso deja una ventana: dos registros
      // simultaneos con el mismo email pueden pasarla los dos. El indice unico
      // de la base es la garantia real; aca solo se traduce ese fallo tecnico
      // al lenguaje del dominio.
      if (this.isUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }

  /**
   * Frontera entre la fila de Prisma y la entidad de dominio. Es el unico
   * lugar del proyecto donde conviven los dos enums de Role.
   */
  private toDomain(fila: PrismaUser): User {
    return new User(
      fila.id,
      fila.email,
      fila.passwordHash,
      fila.role === PrismaRole.ADMIN ? Role.Admin : Role.User,
      fila.createdAt,
      fila.updatedAt,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === UNIQUE_VIOLATION
    );
  }
}
