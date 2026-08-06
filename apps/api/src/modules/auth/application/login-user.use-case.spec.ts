import { ConfigService } from '@nestjs/config';
import { Role } from '../../../shared/domain/role.enum';
import { InMemoryUserRepository } from '../../users/domain/__fakes__/in-memory-user.repository';
import { User } from '../../users/domain/user.entity';
import {
  FakeAccessTokenIssuer,
  FakePasswordHasher,
  FakeRefreshTokenGenerator,
} from '../domain/__fakes__/fake-adapters';
import { InMemoryRefreshTokenRepository } from '../domain/__fakes__/in-memory-refresh-token.repository';
import { InvalidCredentialsError } from '../domain/auth.errors';
import { IssueTokenPair } from './issue-token-pair.service';
import { LoginUserUseCase } from './login-user.use-case';

describe('LoginUserUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let accessTokens: FakeAccessTokenIssuer;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let useCase: LoginUserUseCase;

  const config = { get: () => 7 } as unknown as ConfigService<Record<string, unknown>, true>;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    accessTokens = new FakeAccessTokenIssuer();
    refreshTokens = new InMemoryRefreshTokenRepository();

    const ahora = new Date();
    users.seed(
      new User(
        'user-1',
        'ana@example.com',
        'hashed:unaClaveSegura1',
        Role.User,
        ahora,
        ahora,
      ),
    );

    useCase = new LoginUserUseCase(
      users,
      hasher,
      new IssueTokenPair(accessTokens, new FakeRefreshTokenGenerator(), refreshTokens),
      config,
    );
  });

  it('CA-6 / regla 7: devuelve access y refresh token', async () => {
    const par = await useCase.execute({
      email: 'ana@example.com',
      password: 'unaClaveSegura1',
    });

    expect(par.accessToken).toBeDefined();
    expect(par.refreshToken).toBeDefined();
    expect(par.expiresInSeconds).toBe(900);
  });

  it('CA-8 / regla 9: el payload del token lleva sub, email y role', async () => {
    await useCase.execute({ email: 'ana@example.com', password: 'unaClaveSegura1' });

    expect(accessTokens.emitidos[0]).toEqual({
      sub: 'user-1',
      email: 'ana@example.com',
      role: Role.User,
    });
  });

  it('regla 7: cada login abre una familia nueva, para que las sesiones sean independientes', async () => {
    await useCase.execute({ email: 'ana@example.com', password: 'unaClaveSegura1' });
    await useCase.execute({ email: 'ana@example.com', password: 'unaClaveSegura1' });

    const familias = new Set(refreshTokens.all().map((t) => t.familyId));
    expect(familias.size).toBe(2);
  });

  it('CA-7: la contrasena incorrecta y el email inexistente dan el mismo error', async () => {
    const porPassword = await useCase
      .execute({ email: 'ana@example.com', password: 'equivocada' })
      .catch((e: unknown) => e);

    const porEmail = await useCase
      .execute({ email: 'nadie@example.com', password: 'equivocada' })
      .catch((e: unknown) => e);

    expect(porPassword).toBeInstanceOf(InvalidCredentialsError);
    expect(porEmail).toBeInstanceOf(InvalidCredentialsError);
    // Mismo mensaje: el login no puede servir de oraculo para averiguar que
    // direcciones estan registradas.
    expect((porPassword as Error).message).toBe((porEmail as Error).message);
  });

  it('regla 8: con un email inexistente igual se gasta el tiempo de verificacion', async () => {
    await useCase
      .execute({ email: 'nadie@example.com', password: 'equivocada' })
      .catch(() => undefined);

    // Sin esta llamada, responder mas rapido delataria que el email no existe.
    expect(hasher.fakeVerifyCalls).toBe(1);
  });

  it('regla 1: se puede entrar escribiendo el email con otra capitalizacion', async () => {
    const par = await useCase.execute({
      email: '  ANA@EXAMPLE.COM ',
      password: 'unaClaveSegura1',
    });

    expect(par.accessToken).toBeDefined();
  });
});
