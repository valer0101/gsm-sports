import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class SetWebhookDto {
  @ApiProperty({
    description:
      'Public HTTPS URL Telegram should POST updates to. Path must end with /v1/telegram/webhook (query string / fragment allowed).',
    example: 'https://api.example.com/v1/telegram/webhook',
  })
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  // Telegram accepts only https. The path-end check is a pragmatic
  // ops safety rail — `?query` and `#fragment` are permitted so
  // re-registering with cache-busting params doesn't fail validation.
  @Matches(/\/v1\/telegram\/webhook\/?(?:[?#]|$)/, {
    message: 'url path must end with /v1/telegram/webhook (optionally followed by ? or #)',
  })
  url: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'If true, Telegram discards any updates queued while the webhook was down. Default false — do NOT drop pending `/start` deep-links silently; set only for the very first registration or when you really do want a clean slate.',
  })
  @IsOptional()
  @IsBoolean()
  dropPendingUpdates?: boolean;
}
