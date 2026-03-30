import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateLawyerDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  officeId?: string;
}

export class UpdateLawyerDto {
  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  officeId?: string;

  @IsOptional()
  rating?: number;

  @IsOptional()
  isVerified?: boolean;

  @IsOptional()
  busySchedule?: string[];
}
