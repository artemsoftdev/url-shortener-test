import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { customAlphabet } from 'nanoid';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { CreateLinkDto } from './dto/create-link.dto';
import { Link } from './link.entity';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);

@Injectable()
export class LinksService {
  constructor(
    @InjectRepository(Link)
    private readonly links: Repository<Link>,
    private readonly cfg: ConfigService,
  ) {}

  async create(user: User, dto: CreateLinkDto) {
    const code = await this.generateUniqueCode();
    const link = await this.links.save(
      this.links.create({ code, originalUrl: dto.url, userId: user.id }),
    );
    return this.format(link);
  }

  async listForUser(user: User) {
    const items = await this.links.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    return items.map((l) => this.format(l));
  }

  async resolve(code: string): Promise<string> {
    const link = await this.links.findOne({ where: { code } });
    if (!link) {
      throw new NotFoundException('Short link not found');
    }
    return link.originalUrl;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = nanoid();
      const existing = await this.links.findOne({ where: { code } });
      if (!existing) return code;
    }
    throw new Error('Failed to generate unique short code');
  }

  private format(link: Link) {
    const baseUrl = this.cfg.get<string>('BASE_URL', 'http://localhost:3000');
    return {
      id: link.id,
      code: link.code,
      originalUrl: link.originalUrl,
      shortUrl: `${baseUrl}/links/${link.code}`,
      createdAt: link.createdAt,
    };
  }
}
