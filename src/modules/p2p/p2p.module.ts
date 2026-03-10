import { Module } from '@nestjs/common';
import { P2pController } from './p2p.controller';
import { P2pService } from './p2p.service';

@Module({
  controllers: [P2pController],
  providers: [P2pService],
  exports: [P2pService],
})
export class P2pModule {}
