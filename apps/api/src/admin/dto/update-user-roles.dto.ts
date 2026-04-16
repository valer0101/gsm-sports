import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';

const ALLOWED_ROLES = ['user', 'organizer', 'editor', 'admin'];

export class UpdateUserRolesDto {
  @ApiProperty({ example: ['user', 'organizer'], enum: ALLOWED_ROLES, isArray: true })
  @IsArray()
  @IsString({ each: true })
  @IsIn(ALLOWED_ROLES, { each: true })
  roles: string[];
}
