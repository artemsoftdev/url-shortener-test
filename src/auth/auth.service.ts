import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthDto } from './dto/auth.dto';

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: AuthDto): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create(dto.email, passwordHash);
    return this.buildResponse(user.id, user.email);
  }

  async login(dto: AuthDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildResponse(user.id, user.email);
  }

  private buildResponse(id: string, email: string): AuthResponse {
    const accessToken = this.jwt.sign({ sub: id, email });
    return { accessToken, user: { id, email } };
  }
}
