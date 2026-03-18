import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LawService } from './law.service';
import { LawController } from './law.controller';
import { Lawyer } from './entities/lawyer.entity';
import { User } from '../user/entities/user.entity';
import { LawAppointment } from './entities/law-appointment.entity';
import { LawApplication } from './entities/law-application.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lawyer,
      User,
      LawAppointment,
      LawApplication,
    ]),
  ],
  controllers: [LawController],
  providers: [LawService],
  exports: [LawService],
})
export class LawModule {}
