import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum LawRole {
  EMPLOYEE = 'employee',
  LAWYER = 'lawyer',  // Translated 'teacher' to 'lawyer' for law office context
  CLIENT = 'client',  // Translated 'student' to 'client' for law office context
  ADMIN = 'admin',
}

export enum ResourceType {
  ROOM = 'room',
  EQUIPMENT = 'equipment',
}

export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export enum HardConstraintType {
  NO_USER_OVERLAP = 'no_user_overlap',
  NO_RESOURCE_OVERLAP = 'no_resource_overlap',
  RESPECT_AVAILABILITY = 'respect_availability',
  RESPECT_SKILLS = 'respect_skills',
  MAX_HOURS_PER_WEEK = 'max_hours_per_week',
  NO_CONSECUTIVE_SHIFTS = 'no_consecutive_shifts', // Advanced rule
  NO_NIGHT_AFTER_MORNING = 'no_night_after_morning', // Advanced rule
}

export enum SoftConstraintType {
  PREFER_MORNING = 'prefer_morning',
  AVOID_GAPS = 'avoid_gaps',
  GROUP_SESSIONS = 'group_sessions',
  RESPECT_PREFERENCES = 'respect_preferences',
  MINIMIZE_TRAVEL_DISTANCE = 'minimize_travel_distance', // Advanced rule
  BALANCE_WORKLOAD = 'balance_workload', // Fairness
}

export enum OptimizationStrategy {
  GREEDY = 'greedy',
  BACKTRACKING = 'backtracking',
  GENETIC = 'genetic',
  CP = 'cp',
}

export class TimeSlotDto {
  @IsString()
  start: string; // HH:mm

  @IsString()
  end: string; // HH:mm
}

export class TimeConfigDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays: number[]; // 1 = Monday, 7 = Sunday

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  timeSlots: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  holidays?: string[];
}

export class AvailabilityDto {
  @IsNumber()
  @Min(1)
  @Max(7)
  day: number;

  @IsString()
  start: string;

  @IsString()
  end: string;
}

export class PreferencesDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  preferredDays?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredTimeSlots?: string[];
}

export class LawUserDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum(LawRole)
  role: LawRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHoursPerWeek?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;
}

export class LawResourceDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum(ResourceType)
  type: ResourceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto[];
}

export class PreferredTimeDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7)
  day?: number;

  @IsOptional()
  @IsString()
  start?: string;
}

export class RecurrenceDto {
  @IsEnum(RecurrenceType)
  type: RecurrenceType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  interval?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];
}

export class LawActivityDto {
  @IsString()
  id: string;

  @IsString()
  name: string; // e.g. Client consultation, Court hearing, Internal meeting

  @IsNumber()
  duration: number; // in minutes

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  requiredUsers?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredResources?: string[];

  @IsOptional()
  @IsBoolean()
  fixedTime?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferredTimeDto)
  preferredTime?: PreferredTimeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;
}

export class SoftConstraintConfigDto {
  @IsEnum(SoftConstraintType)
  type: SoftConstraintType;

  @IsNumber()
  weight: number;
}

export class ConstraintsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(HardConstraintType, { each: true })
  hard?: HardConstraintType[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SoftConstraintConfigDto)
  soft?: SoftConstraintConfigDto[];
}

export class OptimizationDto {
  @IsOptional()
  @IsEnum(OptimizationStrategy)
  strategy?: OptimizationStrategy;

  @IsOptional()
  @IsNumber()
  maxIterations?: number;

  @IsOptional()
  @IsNumber()
  timeLimitSeconds?: number;
}

export class CreateLawScheduleDto {
  @ValidateNested()
  @Type(() => TimeConfigDto)
  timeConfig: TimeConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LawUserDto)
  users: LawUserDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LawResourceDto)
  resources: LawResourceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LawActivityDto)
  activities: LawActivityDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ConstraintsDto)
  constraints?: ConstraintsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => OptimizationDto)
  optimization?: OptimizationDto;
}
