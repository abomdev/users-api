import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp, resetDatabase } from './helpers/test-app';

const EMAIL = 'ana@example.com';
const PASSWORD = 'unaClaveSegura1';

describe('Autenticacion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  async function registrarYLoguear(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });
    const { body } = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });
    return body as { accessToken: string; refreshToken: string };
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('CA-1: crea la cuenta y responde 201 sin exponer el hash', async () => {
      const { status, body } = await http()
        .post('/auth/register')
        .send({ email: EMAIL, password: PASSWORD });

      expect(status).toBe(201);
      expect(body).toMatchObject({ email: EMAIL, role: 'USER' });
      expect(body).not.toHaveProperty('passwordHash');
      expect(body).not.toHaveProperty('password');
    });

    it('CA-1 / regla 3: la contrasena queda hasheada con argon2id en la base', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const fila = await prisma.user.findUnique({ where: { email: EMAIL } });

      expect(fila?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(fila?.passwordHash).not.toContain(PASSWORD);
    });

    it('CA-2: el email duplicado responde 409 con el formato de error de la spec', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const { status, body } = await http()
        .post('/auth/register')
        .send({ email: EMAIL, password: 'otraClaveSegura9' });

      expect(status).toBe(409);
      expect(body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        path: '/auth/register',
      });
      expect(body.timestamp).toBeDefined();
    });

    it('CA-3: el mismo email con mayusculas y espacios tambien da 409', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const { status } = await http()
        .post('/auth/register')
        .send({ email: '  ANA@EXAMPLE.COM  ', password: 'otraClaveSegura9' });

      // 409 y no 400: la normalizacion corre antes de validar (regla 1).
      expect(status).toBe(409);
    });

    it('CA-4: una contrasena de 7 caracteres responde 400', async () => {
      const { status, body } = await http()
        .post('/auth/register')
        .send({ email: EMAIL, password: '1234567' });

      expect(status).toBe(400);
      expect(body.message).toContain('password debe tener al menos 8 caracteres');
    });

    it('CA-5: enviar role ADMIN en el cuerpo no tiene efecto', async () => {
      const { body } = await http()
        .post('/auth/register')
        .send({ email: EMAIL, password: PASSWORD, role: 'ADMIN' });

      expect(body.role).toBe('USER');

      const fila = await prisma.user.findUnique({ where: { email: EMAIL } });
      expect(fila?.role).toBe('USER');
    });
  });

  describe('POST /auth/login', () => {
    it('CA-6 / regla 7: devuelve el par de tokens', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const { status, body } = await http()
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD });

      expect(status).toBe(200);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe(900);
    });

    it('CA-8 / regla 9: el access token es HS256 y lleva sub, email y role', async () => {
      const { accessToken } = await registrarYLoguear();
      const [header, payload] = accessToken
        .split('.')
        .slice(0, 2)
        .map((parte) => JSON.parse(Buffer.from(parte, 'base64url').toString()) as Record<string, unknown>);

      expect(header.alg).toBe('HS256');
      expect(payload).toMatchObject({ email: EMAIL, role: 'USER' });
      expect(payload.sub).toBeDefined();
      expect((payload.exp as number) - (payload.iat as number)).toBe(900);
    });

    it('CA-7: la contrasena incorrecta y el email inexistente dan respuestas identicas', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const malPassword = await http()
        .post('/auth/login')
        .send({ email: EMAIL, password: 'claveEquivocada9' });

      const noExiste = await http()
        .post('/auth/login')
        .send({ email: 'nadie@example.com', password: 'claveEquivocada9' });

      expect(malPassword.status).toBe(401);
      expect(noExiste.status).toBe(401);
      // Si los mensajes difirieran, el login seria un oraculo para averiguar
      // que direcciones estan registradas.
      expect(malPassword.body.message).toBe(noExiste.body.message);
    });
  });

  describe('GET /auth/me', () => {
    it('CA-9: sin token responde 401', async () => {
      const { status } = await http().get('/auth/me');
      expect(status).toBe(401);
    });

    it('CA-10: con token valido devuelve el perfil sin el hash', async () => {
      const { accessToken } = await registrarYLoguear();

      const { status, body } = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(status).toBe(200);
      expect(body).toMatchObject({ email: EMAIL, role: 'USER' });
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('CA-11: un token con la firma alterada responde 401', async () => {
      const { accessToken } = await registrarYLoguear();
      const alterado = `${accessToken.slice(0, -1)}X`;

      const { status } = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${alterado}`);

      expect(status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('CA-12: rota el token y devuelve uno distinto', async () => {
      const { refreshToken } = await registrarYLoguear();

      const { status, body } = await http().post('/auth/refresh').send({ refreshToken });

      expect(status).toBe(200);
      expect(body.refreshToken).not.toBe(refreshToken);
      expect(body.accessToken).toBeDefined();
    });

    it('regla 11: el refresh se guarda hasheado, nunca en claro', async () => {
      const { refreshToken } = await registrarYLoguear();

      const fila = await prisma.refreshToken.findFirst();

      expect(fila?.tokenHash).not.toBe(refreshToken);
      // SHA-256 en hexadecimal: 64 caracteres.
      expect(fila?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      // Y el token entregado es opaco, no un JWT: no tiene tres partes.
      expect(refreshToken.split('.')).toHaveLength(1);
    });

    it('CA-13: reusar un token ya rotado revoca la familia completa', async () => {
      const { refreshToken: r1 } = await registrarYLoguear();
      await http().post('/auth/refresh').send({ refreshToken: r1 });

      const { status } = await http().post('/auth/refresh').send({ refreshToken: r1 });

      expect(status).toBe(401);

      const familia = await prisma.refreshToken.findMany();
      expect(familia).toHaveLength(2);
      expect(familia.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('CA-14: tras revocarse la familia, el token legitimo tampoco sirve', async () => {
      const { refreshToken: r1 } = await registrarYLoguear();
      const { body } = await http().post('/auth/refresh').send({ refreshToken: r1 });
      const r2 = body.refreshToken as string;

      await http().post('/auth/refresh').send({ refreshToken: r1 });

      const { status } = await http().post('/auth/refresh').send({ refreshToken: r2 });
      expect(status).toBe(401);
    });

    it('CA-15: un refresh vencido responde 401', async () => {
      const { refreshToken } = await registrarYLoguear();

      // Se envejece el token en la base en lugar de esperar siete dias.
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const { status } = await http().post('/auth/refresh').send({ refreshToken });
      expect(status).toBe(401);
    });

    it('regla 12: rotar no extiende el vencimiento de la familia', async () => {
      const { refreshToken } = await registrarYLoguear();
      const original = await prisma.refreshToken.findFirst();

      await http().post('/auth/refresh').send({ refreshToken });
      const tokens = await prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });

      expect(tokens).toHaveLength(2);
      expect(tokens[1].expiresAt.getTime()).toBe(original?.expiresAt.getTime());
    });
  });

  describe('POST /auth/logout', () => {
    it('CA-16: revoca la sesion y el token deja de servir', async () => {
      const { refreshToken } = await registrarYLoguear();

      const logout = await http().post('/auth/logout').send({ refreshToken });
      expect(logout.status).toBe(204);

      const refresh = await http().post('/auth/refresh').send({ refreshToken });
      expect(refresh.status).toBe(401);
    });

    it('CA-17: repetirlo sigue devolviendo 204 y no afecta a otras sesiones', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      // Dos logins: dos familias independientes.
      const sesionA = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });
      const sesionB = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });

      await http().post('/auth/logout').send({ refreshToken: sesionA.body.refreshToken });
      const repetido = await http()
        .post('/auth/logout')
        .send({ refreshToken: sesionA.body.refreshToken });

      expect(repetido.status).toBe(204);

      // La otra sesion sigue viva: cerrar sesion dos veces no puede costarle al
      // usuario todas sus sesiones (regla 16 frente a regla 14).
      const refresh = await http()
        .post('/auth/refresh')
        .send({ refreshToken: sesionB.body.refreshToken });
      expect(refresh.status).toBe(200);
    });

    it('CA-17: un token inexistente tambien devuelve 204', async () => {
      const { status } = await http()
        .post('/auth/logout')
        .send({ refreshToken: 'jamas-emitido' });

      expect(status).toBe(204);
    });
  });
});
