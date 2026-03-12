import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LawChatGateway } from './law-chat.gateway';
import { ChatModule } from '../chat/chat.module';
import { LawChatRoom } from './entities/law-chat-room.entity';

@Module({
  imports: [ChatModule, TypeOrmModule.forFeature([LawChatRoom])],
  providers: [LawChatGateway],
})
export class LawChatModule {}
