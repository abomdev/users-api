import { Role } from '../../../shared/domain/role.enum';
import { InMemoryUserRepository } from '../domain/__fakes__/in-memory-user.repository';
import { User } from '../domain/user.entity';
import { ListUsersUseCase } from './list-users.use-case';

describe('ListUsersUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: ListUsersUseCase;

  function sembrar(cantidad: number): void {
    for (let i = 0; i < cantidad; i += 1) {
      const fecha = new Date(2026, 0, 1, 0, 0, i);
      users.seed(
        new User(`user-${i}`, `u${i}@example.com`, 'hashed:x', Role.User, fecha, fecha),
      );
    }
  }

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new ListUsersUseCase(users);
  });

  it('CA-21: con 25 usuarios, la pagina 2 de 20 trae 5 elementos', async () => {
    sembrar(25);

    const { data, meta } = await useCase.execute({ page: 2, limit: 20 });

    expect(data).toHaveLength(5);
    expect(meta).toEqual({ total: 25, page: 2, limit: 20, totalPages: 2 });
  });

  it('regla 19: meta refleja el total de usuarios, no el de la pagina', async () => {
    sembrar(25);

    const { meta } = await useCase.execute({ page: 1, limit: 10 });

    expect(meta.total).toBe(25);
    expect(meta.totalPages).toBe(3);
  });

  it('regla 20: ordena por fecha de creacion descendente', async () => {
    sembrar(3);

    const { data } = await useCase.execute({ page: 1, limit: 10 });

    expect(data.map((u) => u.id)).toEqual(['user-2', 'user-1', 'user-0']);
  });

  it('una pagina mas alla del final devuelve vacio, no un error', async () => {
    sembrar(5);

    const { data, meta } = await useCase.execute({ page: 99, limit: 20 });

    expect(data).toHaveLength(0);
    expect(meta.total).toBe(5);
  });

  it('sin usuarios, totalPages es 0 y no 1', async () => {
    const { data, meta } = await useCase.execute({ page: 1, limit: 20 });

    expect(data).toHaveLength(0);
    expect(meta.totalPages).toBe(0);
  });
});
