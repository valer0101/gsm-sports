import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TelegramLinkService } from './telegram-link.service';

@ApiTags('Telegram')
@Controller('v1/telegram')
export class TelegramController {
  constructor(private readonly linkService: TelegramLinkService) {}

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
  async getLink(@Request() req: any) {
    const link = await this.linkService.findByUser(req.user.sub);
    if (!link) return null;
    // Don't leak the full chat_id — last 4 digits are enough for the UI
    // to render "connected ending in …1234" without turning every linked
    // athlete into a scrape-able directory.
    const masked = link.chatId.length > 4 ? `…${link.chatId.slice(-4)}` : link.chatId;
    return {
      id: link.id,
      chatIdMasked: masked,
      linkedAt: link.createdAt,
    };
  }

  @ApiOperation({ summary: 'Unlink the Telegram account — stop notifications' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete('link')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(@Request() req: any) {
    return this.linkService.unlink(req.user.sub);
  }
}
