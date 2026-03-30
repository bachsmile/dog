import { PartialType } from '@nestjs/mapped-types';
import { CreateLawArticleDto } from './create-law-article.dto';

export class UpdateLawArticleDto extends PartialType(CreateLawArticleDto) {}
