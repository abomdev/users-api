import { Role } from '../../../shared/domain/role.enum';
import { InMemoryUserRepository } from '../../users/domain/__fakes__/in-memory-user.repository';
import { User } from '../../users/domain/user.entity';
import { InvalidCredentialsError } from '../domain/auth.errors';
import { GetOwnProfileUseCase } from './get-own-profile.use-case';

describe('GetOwnProfileUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: GetOwnProfileUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new GetOwnProfileUseCase(users);
  });

  it('CA-10: devuelve el usuario correspondiente al identificador del token', async () => {
    const ahora = new Date();
    users.seed(
      new User('user-1', 'ana@example.com', 'hashed:x', Role.User, ahora, ahora),
    );

    const user = await useCase.execute('user-1');

    expect(user.email).toBe('ana@example.com');
  });

  it('un token con firma valida pero cuenta ya borrada no autoriza nada', async () => {
    await expect(useCase.execute('user-inexistente')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});
