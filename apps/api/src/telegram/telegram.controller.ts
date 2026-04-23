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
}
