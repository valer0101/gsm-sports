import {
  Controller,
  Get,
  Delete,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramService } from './telegram.service';
import { SetWebhookDto } from './dto/set-webhook.dto';

@ApiTags('Telegram')
@Controller('v1/telegram')
export class TelegramController {
  constructor(
    private readonly linkService: TelegramLinkService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({
    summary: "Issue a short-lived deep-link so the athlete can bind their Telegram account",
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('link-token')
  getLinkToken(@Request() req: any) {
    return this.linkService.issueLinkToken(req.user.sub);
  }

  @ApiOperation({ summary: 'Get the current Telegram link for the logged-in user (or null)' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('link')
  getLink(@Request() req: any) {
    return this.linkService.getLinkStatus(req.user.sub);
  }

  @ApiOperation({ summary: 'Unlink the Telegram account — stop notifications' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete('link')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(@Request() req: any) {
    return this.linkService.unlink(req.user.sub);
  }

  @ApiOperation({
    summary:
      'Admin: register the webhook URL with Telegram (one-shot; re-run when the public URL changes)',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @Post('set-webhook')
  @HttpCode(HttpStatus.OK)
  async setWebhook(@Body() dto: SetWebhookDto) {
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!secret) {
      throw new InternalServerErrorException(
        'TELEGRAM_WEBHOOK_SECRET is not configured — set it in .env before registering the webhook',
      );
    }
    await this.telegramService.setWebhook(dto.url, secret);
    return { registered: true, url: dto.url };
  }
}
