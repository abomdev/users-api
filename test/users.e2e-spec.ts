import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp, resetDatabase } from './helpers/test-app';

const PASSWORD = 'unaClaveSegura1';

describe('Usuarios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const http = () => request(app.getHttpServer());

  /** Crea una cuenta y devuelve su access token, opcionalmente como ADMIN. */
  async function crearUsuario(email: string, admin = false): Promise<string> {
    await http().post('/auth/register').send({ email, password: PASSWORD });

    if (admin) {
      // El rol se cambia en la base, como dice la spec: no hay endpoint para
      // promover administradores (esta fuera de alcance).
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    }

    const { body } = await http().post('/auth/login').send({ email, password: PASSWORD });
    return body.accessToken as string;
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

  it('CA-18: un usuario con rol USER recibe 403', async () => {
    const token = await crearUsuario('ana@example.com');

    const { status, body } = await http()
      .get('/users')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('sin token recibe 401, no 403: son situaciones distintas', async () => {
    const { status } = await http().get('/users');
    expect(status).toBe(401);
  });

  it('CA-19: un ADMIN recibe 200 con data y meta', async () => {
    const token = await crearUsuario('jefa@example.com', true);

    const { status, body } = await http()
      .get('/users')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('regla 17: el rol se lee del token, asi que promover exige volver a autenticarse', async () => {
    const tokenViejo = await crearUsuario('ana@example.com');
    await prisma.user.update({ where: { email: 'ana@example.com' }, data: { role: 'ADMIN' } });

    // El token se emitio cuando todavia era USER.
    const conViejo = await http().get('/users').set('Authorization', `Bearer ${tokenViejo}`);
    expect(conViejo.status).toBe(403);

    const { body } = await http()
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: PASSWORD });
    const conNuevo = await http()
      .get('/users')
      .set('Authorization', `Bearer ${body.accessToken}`);
    expect(conNuevo.status).toBe(200);
  });

  it('CA-20: limit fuera de rango responde 400', async () => {
    const token = await crearUsuario('jefa@example.com', true);

    const { status, body } = await http()
      .get('/users?limit=101')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(400);
    expect(body.message).toContain('limit no puede superar 100');
  });

  it('CA-20: page=0 tambien responde 400', async () => {
    const token = await crearUsuario('jefa@example.com', true);

    const { status } = await http()
      .get('/users?page=0')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(400);
  });

  it('CA-21: con 25 usuarios, page=2&limit=20 trae 5 elementos', async () => {
    const token = await crearUsuario('jefa@example.com', true);
    for (let i = 0; i < 24; i += 1) {
      await http().post('/auth/register').send({ email: `u${i}@example.com`, password: PASSWORD });
    }

    const { body } = await http()
      .get('/users?page=2&limit=20')
      .set('Authorization', `Bearer ${token}`);

    expect(body.data).toHaveLength(5);
    expect(body.meta).toMatchObject({ total: 25, page: 2, limit: 20, totalPages: 2 });
  });

  it('CA-22: ningun elemento del listado incluye passwordHash', async () => {
    const token = await crearUsuario('jefa@example.com', true);
    await http().post('/auth/register').send({ email: 'otra@example.com', password: PASSWORD });

    const { body } = await http().get('/users').set('Authorization', `Bearer ${token}`);

    expect(JSON.stringify(body)).not.toContain('passwordHash');
    for (const usuario of body.data as Record<string, unknown>[]) {
      expect(Object.keys(usuario).sort()).toEqual(['createdAt', 'email', 'id', 'role']);
    }
  });

  it('regla 21: borrar un usuario arrastra sus refresh tokens', async () => {
    await crearUsuario('ana@example.com');
    expect(await prisma.refreshToken.count()).toBe(1);

    await prisma.user.delete({ where: { email: 'ana@example.com' } });

    // La cascada la garantiza la base (ON DELETE CASCADE en la migracion), no
    // codigo de la aplicacion. Por eso se verifica contra Postgres de verdad.
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it('una pagina mas alla del final devuelve 200 con data vacio', async () => {
    const token = await crearUsuario('jefa@example.com', true);

    const { status, body } = await http()
      .get('/users?page=99')
      .set('Authorization', `Bearer ${token}`);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.meta.total).toBe(1);
  });
});
