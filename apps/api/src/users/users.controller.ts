import { Body, Controller, Get, NotFoundException, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: any) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _ph, ...safe } = user as any;
    return safe;
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() dto: UpdateMeDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.dateOfBirth) data.dateOfBirth = new Date(dto.dateOfBirth);
    const updated = await this.usersService.update(req.user.sub, data);
    const { passwordHash: _ph, ...safe } = updated as any;
    return safe;
  }
}
