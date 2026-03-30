import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletSavings } from './entities/wallet-savings.entity';
import { WalletConfig } from './entities/wallet-config.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { StorageWallet } from './entities/storage-wallet.entity';
import { StorageHistory } from './entities/storage-history.entity';
import { SystemConfig } from './entities/system-config.entity';
import { P2pModule } from '../p2p/p2p.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletConfig,
      WalletTransaction,
      WalletSavings,
      StorageWallet,
      StorageHistory,
      SystemConfig,
    ]),
    P2pModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
