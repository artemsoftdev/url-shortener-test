import { IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsUrl({ require_protocol: true }, { message: 'url must be a valid URL with protocol' })
  url: string;
}
