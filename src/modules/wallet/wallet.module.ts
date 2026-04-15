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
import { WalletDeposit } from './entities/wallet-deposit.entity';
import { Wallet } from './entities/wallet.entity';
import { User } from '../user/entities/user.entity';
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
      WalletDeposit,
      Wallet,
      User,
    ]),
    P2pModule,
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
