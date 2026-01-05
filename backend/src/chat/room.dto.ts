import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsArray, IsNumber } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsBoolean()
  @IsOptional()
  historyEnabled?: boolean;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  participantIds?: number[];
}
