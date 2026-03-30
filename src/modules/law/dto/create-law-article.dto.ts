import { IsString, IsOptional, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateLawArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  cover?: string;
}
