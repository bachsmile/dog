import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateLawQuestionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class AnswerLawQuestionDto {
  @IsString()
  @IsNotEmpty()
  answer: string;
}

export class UpdateLawQuestionStatusDto {
  @IsEnum(['Pending', 'Answered', 'Rejected'])
  status: string;
}
