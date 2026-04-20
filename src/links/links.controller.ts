import { Body, Controller, Get, Param, Post, Redirect, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { CreateLinkDto } from './dto/create-link.dto';
import { LinksService } from './links.service';

@Controller('links')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateLinkDto) {
    return this.links.create(user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: User) {
    return this.links.listForUser(user);
  }

  @Get(':code')
  @Redirect()
  async redirect(@Param('code') code: string) {
    const url = await this.links.resolve(code);
    return { url, statusCode: 302 };
  }
}
