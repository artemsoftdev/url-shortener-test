import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('URL Shortener API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "links", "users" RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  describe('POST /auth/register', () => {
    it('registers a new user and returns a token', async () => {
      const res = await server()
        .post('/auth/register')
        .send({ email: 'alice@example.com', password: 'secret123' })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'alice@example.com' });
    });

    it('rejects invalid body with 400 and meaningful messages', async () => {
      const res = await server()
        .post('/auth/register')
        .send({ email: 'bad', password: 'x' })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'email must be a valid email address',
          'password must be at least 6 characters long',
        ]),
      );
    });

    it('rejects duplicate email with 409', async () => {
      const payload = { email: 'bob@example.com', password: 'secret123' };
      await server().post('/auth/register').send(payload).expect(201);
      await server().post('/auth/register').send(payload).expect(409);
    });
  });

  describe('POST /auth/login', () => {
    const creds = { email: 'carol@example.com', password: 'secret123' };

    beforeEach(async () => {
      await server().post('/auth/register').send(creds).expect(201);
    });

    it('returns a token for correct credentials', async () => {
      const res = await server().post('/auth/login').send(creds).expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('returns 401 for wrong password', async () => {
      await server()
        .post('/auth/login')
        .send({ ...creds, password: 'wrongpass' })
        .expect(401);
    });

    it('returns 401 for unknown user', async () => {
      await server()
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'secret123' })
        .expect(401);
    });
  });

  describe('Links flow', () => {
    let token: string;

    beforeEach(async () => {
      const res = await server()
        .post('/auth/register')
        .send({ email: 'dan@example.com', password: 'secret123' })
        .expect(201);
      token = res.body.accessToken;
    });

    it('creates a short link', async () => {
      const res = await server()
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://example.com/' })
        .expect(201);

      expect(res.body).toMatchObject({
        originalUrl: 'https://example.com/',
        code: expect.any(String),
        shortUrl: expect.stringMatching(/\/links\/.+$/),
      });
      expect(res.body.code).toHaveLength(7);
    });

    it('rejects invalid url with 400', async () => {
      await server()
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'not-a-url' })
        .expect(400);
    });

    it('rejects unauthenticated requests with 401', async () => {
      await server().post('/links').send({ url: 'https://example.com' }).expect(401);
      await server().get('/links').expect(401);
    });

    it('lists only the current user links', async () => {
      await server()
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://one.example.com' })
        .expect(201);
      await server()
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://two.example.com' })
        .expect(201);

      const otherRes = await server()
        .post('/auth/register')
        .send({ email: 'eve@example.com', password: 'secret123' })
        .expect(201);
      await server()
        .post('/links')
        .set('Authorization', `Bearer ${otherRes.body.accessToken}`)
        .send({ url: 'https://evil.example.com' })
        .expect(201);

      const list = await server().get('/links').set('Authorization', `Bearer ${token}`).expect(200);

      expect(list.body).toHaveLength(2);
      expect(list.body.map((l: any) => l.originalUrl)).toEqual(
        expect.arrayContaining(['https://one.example.com', 'https://two.example.com']),
      );
    });

    it('redirects publicly via GET /links/:code', async () => {
      const created = await server()
        .post('/links')
        .set('Authorization', `Bearer ${token}`)
        .send({ url: 'https://example.com/' })
        .expect(201);

      const res = await server().get(`/links/${created.body.code}`).expect(302);
      expect(res.headers.location).toBe('https://example.com/');
    });

    it('returns 404 for unknown code', async () => {
      await server().get('/links/doesnotexist').expect(404);
    });
  });
});
