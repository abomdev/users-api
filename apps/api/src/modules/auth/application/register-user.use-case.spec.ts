import { Role } from '../../../shared/domain/role.enum';
import { InMemoryUserRepository } from '../../users/domain/__fakes__/in-memory-user.repository';
import { EmailAlreadyRegisteredError } from '../../users/domain/user.errors';
import { FakePasswordHasher } from '../domain/__fakes__/fake-adapters';
import { RegisterUserUseCase } from './register-user.use-case';

describe('RegisterUserUseCase', () => {
  let users: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    useCase = new RegisterUserUseCase(users, hasher);
  });

  it('CA-1: crea la cuenta con rol USER y sin exponer la contrasena en claro', async () => {
    const user = await useCase.execute({
      email: 'ana@example.com',
      password: 'unaClaveSegura1',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('ana@example.com');
    expect(user.role).toBe(Role.User);
    // Regla 3: lo persistido es el hash, nunca la contrasena original.
    expect(user.passwordHash).not.toBe('unaClaveSegura1');
    expect(user.passwordHash).toBe('hashed:unaClaveSegura1');
  });

  it('CA-2: rechaza un email ya registrado', async () => {
    await useCase.execute({ email: 'ana@example.com', password: 'unaClaveSegura1' });

    await expect(
      useCase.execute({ email: 'ana@example.com', password: 'otraClaveSegura9' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

    expect(users.size).toBe(1);
  });

  it('CA-3: trata mayusculas y espacios como el mismo email (regla 1)', async () => {
    await useCase.execute({ email: 'ana@example.com', password: 'unaClaveSegura1' });

    await expect(
      useCase.execute({ email: '  ANA@EXAMPLE.COM  ', password: 'otraClaveSegura9' }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('regla 1: guarda el email normalizado, no como vino', async () => {
    const user = await useCase.execute({
      email: '  Bea@Example.COM ',
      password: 'unaClaveSegura1',
    });

    expect(user.email).toBe('bea@example.com');
  });

  it('CA-5: no hay forma de elegir el rol al registrarse', async () => {
    // El tipo NewUser no tiene campo `role`, asi que ni siquiera se puede
    // expresar la intencion. Este test deja constancia del comportamiento.
    const user = await useCase.execute({
      email: 'vivo@example.com',
      password: 'unaClaveSegura1',
    });

    expect(user.role).toBe(Role.User);
  });
});
