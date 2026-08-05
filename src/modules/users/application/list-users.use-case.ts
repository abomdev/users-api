import { Inject, Injectable } from '@nestjs/common';
import { User } from '../domain/user.entity';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository.port';

export interface ListUsersInput {
  page: number;
  limit: number;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListUsersOutput {
  data: User[];
  meta: PageMeta;
}

/**
 * Listado paginado de usuarios.
 *
 * Implementa las reglas 19 y 20 de spec.md. La restriccion por rol (regla 17)
 * no vive aca sino en el guard: es una decision de acceso, no de negocio, y
 * mezclarla haria imposible reusar este caso de uso desde un comando interno.
 *
 * Los limites de `page` y `limit` (regla 18) los aplica el DTO, que rechaza con
 * 400 antes de llegar hasta aca.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute({ page, limit }: ListUsersInput): Promise<ListUsersOutput> {
    const { data, total } = await this.users.findPage({
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        // Con cero usuarios son cero paginas, no una vacia.
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
