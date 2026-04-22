import { Body, Controller, Get, NotFoundException, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: { user: { sub: string } }) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) throw new NotFoundException('User not found');
    return this.usersService.findMeSafe(req.user.sub);
  }

  @Patch('me')
  updateMe(@Request() req: { user: { sub: string } }, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(req.user.sub, dto);
  }
}
