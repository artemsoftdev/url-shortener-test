import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'sign'>>;

  beforeEach(async () => {
    users = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-token') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('creates a user, hashes the password, and returns a token', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockImplementation(async (email, hash) => ({
        id: 'u1',
        email,
        passwordHash: hash,
        createdAt: new Date(),
        links: [],
      }));

      const result = await service.register({ email: 'a@b.c', password: 'secret123' });

      expect(users.create).toHaveBeenCalledTimes(1);
      const [, storedHash] = users.create.mock.calls[0];
      expect(storedHash).not.toBe('secret123');
      await expect(bcrypt.compare('secret123', storedHash)).resolves.toBe(true);
      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'a@b.c' });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: 'u1', email: 'a@b.c' },
      });
    });

    it('throws ConflictException when email is taken', async () => {
      users.findByEmail.mockResolvedValue({ id: 'u1' } as any);

      await expect(
        service.register({ email: 'a@b.c', password: 'secret123' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token when credentials match', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        passwordHash,
      } as any);

      const result = await service.login({ email: 'a@b.c', password: 'secret123' });

      expect(result.accessToken).toBe('signed-token');
      expect(result.user).toEqual({ id: 'u1', email: 'a@b.c' });
    });

    it('throws UnauthorizedException when user is missing', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nope@b.c', password: 'secret123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      const passwordHash = await bcrypt.hash('real-password', 10);
      users.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        passwordHash,
      } as any);

      await expect(
        service.login({ email: 'a@b.c', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
