import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Link } from './link.entity';
import { LinksService } from './links.service';

type LinksRepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

describe('LinksService', () => {
  let service: LinksService;
  let repo: LinksRepoMock;
  const cfg = { get: (_key: string, def: string) => def } as unknown as ConfigService;
  const user = { id: 'u1' } as User;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity) => entity as Link),
      save: jest.fn((entity) =>
        Promise.resolve({ id: 'l1', createdAt: new Date('2026-01-01'), ...entity } as Link),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: getRepositoryToken(Link), useValue: repo },
        { provide: ConfigService, useValue: cfg },
      ],
    }).compile();

    service = moduleRef.get(LinksService);
  });

  describe('create', () => {
    it('saves a new link with a unique code and returns shortUrl', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create(user, { url: 'https://example.com' });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.userId).toBe('u1');
      expect(saved.originalUrl).toBe('https://example.com');
      expect(typeof saved.code).toBe('string');
      expect(saved.code).toHaveLength(7);

      expect(result).toMatchObject({
        id: 'l1',
        originalUrl: 'https://example.com',
        shortUrl: `http://localhost:3000/links/${saved.code}`,
      });
    });

    it('retries when generated code collides', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'collision' } as Link).mockResolvedValueOnce(null);

      await service.create(user, { url: 'https://example.com' });

      expect(repo.findOne).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('listForUser', () => {
    it('returns formatted links scoped to the user', async () => {
      repo.find.mockResolvedValue([
        {
          id: 'l1',
          code: 'abc1234',
          originalUrl: 'https://example.com',
          userId: 'u1',
          createdAt: new Date('2026-01-01'),
        } as Link,
      ]);

      const result = await service.listForUser(user);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([
        {
          id: 'l1',
          code: 'abc1234',
          originalUrl: 'https://example.com',
          shortUrl: 'http://localhost:3000/links/abc1234',
          createdAt: new Date('2026-01-01'),
        },
      ]);
    });
  });

  describe('resolve', () => {
    it('returns original URL for an existing code', async () => {
      repo.findOne.mockResolvedValue({
        originalUrl: 'https://example.com',
      } as Link);

      await expect(service.resolve('abc1234')).resolves.toBe('https://example.com');
    });

    it('throws NotFoundException when code is unknown', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.resolve('unknown')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
