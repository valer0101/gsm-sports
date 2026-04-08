import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignOperatorDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
