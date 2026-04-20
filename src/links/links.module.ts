import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Link } from './link.entity';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [TypeOrmModule.forFeature([Link]), AuthModule],
  controllers: [LinksController],
  providers: [LinksService],
})
export class LinksModule {}
