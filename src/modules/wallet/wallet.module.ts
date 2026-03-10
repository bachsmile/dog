import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletSavings } from './entities/wallet-savings.entity';
import { WalletConfig } from './entities/wallet-config.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { P2pModule } from '../p2p/p2p.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletConfig, WalletTransaction, WalletSavings]),
    P2pModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
