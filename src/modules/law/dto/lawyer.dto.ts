import { IsString, IsOptional } from 'class-validator';

export class CreateLawyerDto {
  @IsString()
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

  @IsString()
  @IsOptional()
  title?: string;
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

  @IsString()
  @IsOptional()
  title?: string;

  @IsOptional()
  rating?: number;

  @IsOptional()
  isVerified?: boolean;

  @IsOptional()
  busySchedule?: string[];
}
