import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, Matches } from 'class-validator';

export class SetWebhookDto {
  @ApiProperty({
    description: 'Public HTTPS URL Telegram should POST updates to. Must end with /v1/telegram/webhook.',
    example: 'https://api.example.com/v1/telegram/webhook',
  })
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  // Telegram accepts only https, and we want to make sure ops don't
  // accidentally set a non-webhook URL.
  @Matches(/\/v1\/telegram\/webhook\/?$/, {
    message: 'url must end with /v1/telegram/webhook',
  })
  url: string;
}
