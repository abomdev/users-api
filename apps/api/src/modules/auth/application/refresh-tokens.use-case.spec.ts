import { randomUUID } from 'node:crypto';
import { Role } from '../../../shared/domain/role.enum';
import { InMemoryUserRepository } from '../../users/domain/__fakes__/in-memory-user.repository';
import { User } from '../../users/domain/user.entity';
import {
  FakeAccessTokenIssuer,
  FakeRefreshTokenGenerator,
} from '../domain/__fakes__/fake-adapters';
import { InMemoryRefreshTokenRepository } from '../domain/__fakes__/in-memory-refresh-token.repository';
import { InvalidRefreshTokenError } from '../domain/auth.errors';
import { IssueTokenPair } from './issue-token-pair.service';
import { RefreshTokensUseCase } from './refresh-tokens.use-case';

const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000;

describe('RefreshTokensUseCase', () => {
  let users: InMemoryUserRepository;
  let refreshTokens: InMemoryRefreshTokenRepository;
  let generator: FakeRefreshTokenGenerator;
  let issueTokenPair: IssueTokenPair;
  let useCase: RefreshTokensUseCase;
  let user: User;
  let familyId: string;

  /** Deja un refresh vigente y devuelve su valor, como haria un login. */
  async function abrirSesion(expiresAt = new Date(Date.now() + UNA_SEMANA)): Promise<string> {
    const { refreshToken } = await issueTokenPair.execute(user, {
      familyId,
      refreshExpiresAt: expiresAt,
    });
    return refreshToken;
  }

  beforeEach(() => {
    users = new InMemoryUserRepository();
    refreshTokens = new InMemoryRefreshTokenRepository();
    generator = new FakeRefreshTokenGenerator();
    issueTokenPair = new IssueTokenPair(new FakeAccessTokenIssuer(), generator, refreshTokens);
    useCase = new RefreshTokensUseCase(refreshTokens, generator, users, issueTokenPair);

    const ahora = new Date();
    user = new User(randomUUID(), 'ana@example.com', 'hashed:x', Role.User, ahora, ahora);
    users.seed(user);
    familyId = randomUUID();
  });

  it('CA-12: rota el token, devolviendo uno distinto del presentado', async () => {
    const r1 = await abrirSesion();

    const par = await useCase.execute(r1);

    expect(par.refreshToken).not.toBe(r1);
    expect(par.accessToken).toBeDefined();
  });

  it('regla 13: el token presentado queda revocado tras rotar', async () => {
    const r1 = await abrirSesion();

    await useCase.execute(r1);

    const viejo = await refreshTokens.findByHash(generator.hashOf(r1));
    expect(viejo?.isRevoked).toBe(true);
  });

  it('regla 12: rotar NO extiende el vencimiento de la familia', async () => {
    const vence = new Date(Date.now() + UNA_SEMANA);
    const r1 = await abrirSesion(vence);

    const par = await useCase.execute(r1);
    const nuevo = await refreshTokens.findByHash(generator.hashOf(par.refreshToken));

    expect(nuevo?.expiresAt.getTime()).toBe(vence.getTime());
  });

  it('CA-13: reusar un token ya rotado revoca la familia completa', async () => {
    const r1 = await abrirSesion();
    await useCase.execute(r1);

    // Un atacante presenta la copia que se robo.
    await expect(useCase.execute(r1)).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    const familia = refreshTokens.ofFamily(familyId);
    expect(familia).toHaveLength(2);
    expect(familia.every((t) => t.isRevoked)).toBe(true);
  });

  it('CA-14: tras revocarse la familia, el token legitimo tampoco sirve', async () => {
    const r1 = await abrirSesion();
    const { refreshToken: r2 } = await useCase.execute(r1);

    await expect(useCase.execute(r1)).rejects.toThrow();

    // r2 era perfectamente valido un instante antes.
    await expect(useCase.execute(r2)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('CA-15: un refresh vencido es invalido', async () => {
    const vencido = await abrirSesion(new Date(Date.now() - 1000));

    await expect(useCase.execute(vencido)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('regla 15: un token que no existe es invalido', async () => {
    await expect(useCase.execute('jamas-emitido')).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('si la cuenta se borro despues de emitir el token, el refresh es invalido', async () => {
    const ahora = new Date();
    const fantasma = new User(
      randomUUID(),
      'borrada@example.com',
      'hashed:x',
      Role.User,
      ahora,
      ahora,
    );
    // A proposito no se siembra en el repositorio: simula una cuenta que ya no
    // existe pero cuyo refresh token sigue circulando.
    const { refreshToken } = await issueTokenPair.execute(fantasma, {
      familyId: randomUUID(),
      refreshExpiresAt: new Date(Date.now() + UNA_SEMANA),
    });

    await expect(useCase.execute(refreshToken)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('un refresh vencido NO revoca la familia: caducar no es evidencia de robo', async () => {
    const vigente = await abrirSesion();
    const vencido = await abrirSesion(new Date(Date.now() - 1000));

    await expect(useCase.execute(vencido)).rejects.toThrow();

    const sigueVivo = await refreshTokens.findByHash(generator.hashOf(vigente));
    expect(sigueVivo?.isRevoked).toBe(false);
  });
});
