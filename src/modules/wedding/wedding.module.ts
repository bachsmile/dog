import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeddingController } from './wedding.controller';
import { WeddingService } from './wedding.service';
import { WeddingOrder } from './entities/wedding-order.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WeddingOrder, User])],
  controllers: [WeddingController],
  providers: [WeddingService],
})
export class WeddingModule {}
