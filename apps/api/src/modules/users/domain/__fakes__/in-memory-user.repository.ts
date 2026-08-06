import { randomUUID } from 'node:crypto';
import { Role } from '../../../../shared/domain/role.enum';
import { User } from '../user.entity';
import { EmailAlreadyRegisteredError } from '../user.errors';
import { NewUser, PageRequest, UserPage, UserRepository } from '../user.repository.port';

/**
 * Implementacion en memoria del puerto de usuarios, para tests.
 *
 * Esta es la razon practica de que los casos de uso dependan de una interfaz y
 * no de Prisma: se puede probar toda la logica de negocio sin base de datos,
 * sin Docker y sin esperar. Cumple el mismo contrato, incluido lanzar
 * EmailAlreadyRegisteredError ante un email repetido.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  findByEmail(email: string): Promise<User | null> {
    const encontrado = [...this.users.values()].find((u) => u.email === email);
    return Promise.resolve(encontrado ?? null);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  create(data: NewUser): Promise<User> {
    const existente = [...this.users.values()].some((u) => u.email === data.email);
    if (existente) {
      return Promise.reject(new EmailAlreadyRegisteredError());
    }

    const ahora = new Date();
    const user = new User(
      randomUUID(),
      data.email,
      data.passwordHash,
      Role.User,
      ahora,
      ahora,
    );

    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  findPage({ skip, take }: PageRequest): Promise<UserPage> {
    const ordenados = [...this.users.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id),
    );

    return Promise.resolve({
      data: ordenados.slice(skip, skip + take),
      total: ordenados.length,
    });
  }

  // --- Utilidades solo para los tests ---

  seed(user: User): void {
    this.users.set(user.id, user);
  }

  get size(): number {
    return this.users.size;
  }
}
