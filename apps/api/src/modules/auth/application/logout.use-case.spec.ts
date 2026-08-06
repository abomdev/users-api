import { randomUUID } from 'node:crypto';
import { Role } from '../../../shared/domain/role.enum';
import { User } from '../../users/domain/user.entity';
import {
  FakeAccessTokenIssuer,
  FakeRefreshTokenGenerator,
} from '../domain/__fakes__/fake-adapters';
import { InMemoryRefreshTokenRepository } from '../domain/__fakes__/in-memory-refresh-token.repository';
import { IssueTokenPair } from './issue-token-pair.service';
import { LogoutUseCase } from './logout.use-case';

const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000;

describe('LogoutUseCase', () => {
  let refreshTokens: InMemoryRefreshTokenRepository;
  let generator: FakeRefreshTokenGenerator;
  let issueTokenPair: IssueTokenPair;
  let useCase: LogoutUseCase;
  let user: User;
  let familyId: string;

  async function abrirSesion(): Promise<string> {
    const { refreshToken } = await issueTokenPair.execute(user, {
      familyId,
      refreshExpiresAt: new Date(Date.now() + UNA_SEMANA),
    });
    return refreshToken;
  }

  beforeEach(() => {
    refreshTokens = new InMemoryRefreshTokenRepository();
    generator = new FakeRefreshTokenGenerator();
    issueTokenPair = new IssueTokenPair(new FakeAccessTokenIssuer(), generator, refreshTokens);
    useCase = new LogoutUseCase(refreshTokens, generator);

    const ahora = new Date();
    user = new User(randomUUID(), 'ana@example.com', 'hashed:x', Role.User, ahora, ahora);
    familyId = randomUUID();
  });

  it('CA-16: revoca el token presentado', async () => {
    const token = await abrirSesion();

    await useCase.execute(token);

    const guardado = await refreshTokens.findByHash(generator.hashOf(token));
    expect(guardado?.isRevoked).toBe(true);
  });

  it('CA-17: repetirlo no falla y NO revoca la familia', async () => {
    const primero = await abrirSesion();
    const segundo = await abrirSesion(); // otra sesion de la misma familia

    await useCase.execute(primero);
    // El segundo logout con el mismo token ya revocado: aca es donde la regla
    // 14 NO debe dispararse. Si aplicara, `segundo` quedaria revocado tambien.
    await expect(useCase.execute(primero)).resolves.toBeUndefined();

    const otro = await refreshTokens.findByHash(generator.hashOf(segundo));
    expect(otro?.isRevoked).toBe(false);
  });

  it('CA-17: un token inexistente tampoco es un error', async () => {
    await expect(useCase.execute('jamas-emitido')).resolves.toBeUndefined();
  });
});
