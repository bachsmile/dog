import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  lawyerId: string;

  @IsString()
  date: string; // YYYY-MM-DD

  @IsArray()
  @IsNumber({}, { each: true })
  hours: number[];

  @IsString()
  @IsOptional()
  specialty?: string;
}

export class QuickBookingDto {
  @IsString()
  date: string;

  @IsArray()
  @IsNumber({}, { each: true })
  hours: number[];

  @IsString()
  specialty: string;
}
