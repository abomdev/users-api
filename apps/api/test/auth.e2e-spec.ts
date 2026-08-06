import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import {
  createTestApp,
  refreshCookieDe,
  resetDatabase,
  setCookieCrudo,
} from './helpers/test-app';

const EMAIL = 'ana@example.com';
const PASSWORD = 'unaClaveSegura1';

describe('Autenticacion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  /**
   * Deja una sesion abierta y devuelve el access token junto con la cookie de
   * refresh, ya en el formato que hay que reenviar en la cabecera `Cookie`.
   */
  async function registrarYLoguear(): Promise<{
    accessToken: string;
    cookie: string;
  }> {
    await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });
    const respuesta = await http()
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    return {
      accessToken: respuesta.body.accessToken as string,
      cookie: refreshCookieDe(respuesta),
    };
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
    it('CA-6 / reglas 7 y 22: el access token va en el cuerpo y el refresh en la cookie', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const respuesta = await http()
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.accessToken).toBeDefined();
      expect(respuesta.body.tokenType).toBe('Bearer');
      expect(respuesta.body.expiresIn).toBe(900);

      // Lo que hace segura a la regla 22: el refresh no viaja en el cuerpo,
      // asi que ningun script podria leerlo de la respuesta.
      expect(respuesta.body).not.toHaveProperty('refreshToken');
      expect(JSON.stringify(respuesta.body)).not.toContain('refresh');

      expect(refreshCookieDe(respuesta)).not.toBe('');
    });

    it('CA-23 / regla 22: la cookie lleva HttpOnly, SameSite=Lax y Path=/auth', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      const respuesta = await http()
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD });

      const cookie = setCookieCrudo(respuesta);

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/auth');
      // En los tests NODE_ENV es "test", asi que Secure queda apagado: sobre
      // http el navegador descartaria una cookie marcada como Secure.
      expect(cookie).not.toContain('Secure');
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
    it('CA-12 / regla 22: rota la cookie y devuelve una con otro valor', async () => {
      const { cookie } = await registrarYLoguear();

      const respuesta = await http().post('/auth/refresh').set('Cookie', cookie);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.accessToken).toBeDefined();
      expect(refreshCookieDe(respuesta)).not.toBe(cookie);
      expect(respuesta.body).not.toHaveProperty('refreshToken');
    });

    it('regla 22: sin cookie responde 401, igual que con una invalida', async () => {
      const { status } = await http().post('/auth/refresh');
      expect(status).toBe(401);
    });

    it('regla 11: el refresh se guarda hasheado, nunca en claro', async () => {
      const { cookie } = await registrarYLoguear();
      const valor = cookie.replace('refresh_token=', '');

      const fila = await prisma.refreshToken.findFirst();

      expect(fila?.tokenHash).not.toBe(valor);
      // SHA-256 en hexadecimal: 64 caracteres.
      expect(fila?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      // Y el token entregado es opaco, no un JWT: no tiene tres partes.
      expect(valor.split('.')).toHaveLength(1);
    });

    it('CA-13: reusar un token ya rotado revoca la familia completa', async () => {
      const { cookie: c1 } = await registrarYLoguear();
      await http().post('/auth/refresh').set('Cookie', c1);

      const { status } = await http().post('/auth/refresh').set('Cookie', c1);

      expect(status).toBe(401);

      const familia = await prisma.refreshToken.findMany();
      expect(familia).toHaveLength(2);
      expect(familia.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('CA-14: tras revocarse la familia, el token legitimo tampoco sirve', async () => {
      const { cookie: c1 } = await registrarYLoguear();
      const rotada = await http().post('/auth/refresh').set('Cookie', c1);
      const c2 = refreshCookieDe(rotada);

      await http().post('/auth/refresh').set('Cookie', c1);

      const { status } = await http().post('/auth/refresh').set('Cookie', c2);
      expect(status).toBe(401);
    });

    it('CA-15: un refresh vencido responde 401', async () => {
      const { cookie } = await registrarYLoguear();

      // Se envejece el token en la base en lugar de esperar siete dias.
      await prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const { status } = await http().post('/auth/refresh').set('Cookie', cookie);
      expect(status).toBe(401);
    });

    it('regla 12: rotar no extiende el vencimiento de la familia', async () => {
      const { cookie } = await registrarYLoguear();
      const original = await prisma.refreshToken.findFirst();

      await http().post('/auth/refresh').set('Cookie', cookie);
      const tokens = await prisma.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });

      expect(tokens).toHaveLength(2);
      expect(tokens[1].expiresAt.getTime()).toBe(original?.expiresAt.getTime());
    });
  });

  describe('POST /auth/logout', () => {
    it('CA-16: revoca la sesion y el token deja de servir', async () => {
      const { cookie } = await registrarYLoguear();

      const logout = await http().post('/auth/logout').set('Cookie', cookie);
      expect(logout.status).toBe(204);

      const refresh = await http().post('/auth/refresh').set('Cookie', cookie);
      expect(refresh.status).toBe(401);
    });

    it('regla 22: el logout le pide al navegador que borre la cookie', async () => {
      const { cookie } = await registrarYLoguear();

      const logout = await http().post('/auth/logout').set('Cookie', cookie);

      // Se borra emitiendo la misma cookie vacia y ya vencida.
      const borrado = setCookieCrudo(logout);
      expect(borrado).toContain('refresh_token=;');
      expect(borrado).toContain('Path=/auth');
    });

    it('CA-17: repetirlo sigue devolviendo 204 y no afecta a otras sesiones', async () => {
      await http().post('/auth/register').send({ email: EMAIL, password: PASSWORD });

      // Dos logins: dos familias independientes.
      const sesionA = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });
      const sesionB = await http().post('/auth/login').send({ email: EMAIL, password: PASSWORD });

      const cookieA = refreshCookieDe(sesionA);
      const cookieB = refreshCookieDe(sesionB);

      await http().post('/auth/logout').set('Cookie', cookieA);
      const repetido = await http().post('/auth/logout').set('Cookie', cookieA);

      expect(repetido.status).toBe(204);

      // La otra sesion sigue viva: cerrar sesion dos veces no puede costarle al
      // usuario todas sus sesiones (regla 16 frente a regla 14).
      const refresh = await http().post('/auth/refresh').set('Cookie', cookieB);
      expect(refresh.status).toBe(200);
    });

    it('CA-17: un token inexistente tambien devuelve 204', async () => {
      const { status } = await http()
        .post('/auth/logout')
        .set('Cookie', 'refresh_token=jamas-emitido');

      expect(status).toBe(204);
    });

    it('CA-17 / regla 22: sin cookie tambien devuelve 204, por la idempotencia', async () => {
      const { status } = await http().post('/auth/logout');
      expect(status).toBe(204);
    });
  });
});
