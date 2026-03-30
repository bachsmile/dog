import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LawService } from './law.service';
import { LawController } from './law.controller';
import { LawSchedulerService } from './law-scheduler.service';
import { Lawyer } from './entities/lawyer.entity';
import { User } from '../user/entities/user.entity';
import { LawAppointment } from './entities/law-appointment.entity';
import { LawApplication } from './entities/law-application.entity';
import { LawSubmission } from './entities/law-submission.entity';
import { LawArticle } from './entities/law-article.entity';
import { LawQuestion } from './entities/law-question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lawyer,
      User,
      LawAppointment,
      LawApplication,
      LawSubmission,
      LawArticle,
      LawQuestion,
    ]),
  ],
  controllers: [LawController],
  providers: [LawService, LawSchedulerService],
  exports: [LawService, LawSchedulerService],
})
export class LawModule {}
