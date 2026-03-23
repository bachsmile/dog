import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { WalletConfig } from './entities/wallet-config.entity';
import {
  WalletTransaction,
  TransactionType,
} from './entities/wallet-transaction.entity';
import {
  WalletSavings,
  SavingsStatus,
  SavingsType,
} from './entities/wallet-savings.entity';
import { CreateTransactionDto } from './dto/transaction.dto';
import { CreateStorageWalletDto } from './dto/storage-wallet.dto';
import { P2pService } from '../p2p/p2p.service';
import {
  StorageWallet,
  StorageWalletStatus,
} from './entities/storage-wallet.entity';
import {
  StorageHistory,
  StorageAdjustmentType,
} from './entities/storage-history.entity';
import { AdjustStorageWalletDto } from './dto/adjust-storage.dto';

interface CreateSavingsDto {
  assetSymbol: string;
  quantity: number;
  annualRate: number;
  platform: string;
  savingsType: SavingsType;
  durationDays?: number;
  note?: string;
  storageId?: string;
}

interface WalletStatsEntry {
  balance: number;
  receivedBalance: number;
  totalInvested: number;
  totalInvestedPortfolio: number;
  savingsBalance: number;
  storageBalance?: number;
  totalBalance?: number;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletConfig)
    private readonly walletConfigRepository: Repository<WalletConfig>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionRepository: Repository<WalletTransaction>,
    @InjectRepository(WalletSavings)
    private readonly walletSavingsRepository: Repository<WalletSavings>,
    @InjectRepository(StorageWallet)
    private readonly storageWalletRepository: Repository<StorageWallet>,
    @InjectRepository(StorageHistory)
    private readonly storageHistoryRepository: Repository<StorageHistory>,
    private readonly jwtService: JwtService,
    private readonly p2pService: P2pService,
  ) {}

  async setWalletPassword(
    userId: string,
    assetSymbol: string,
    password: string,
  ) {
    if (password.length !== 6 || !/^\d+$/.test(password)) {
      throw new BadRequestException('Mật mã phải có 6 chữ số');
    }

    let config = await this.walletConfigRepository
      .createQueryBuilder('config')
      .where('config.userId = :userId AND config.assetSymbol = :symbol', {
        userId,
        symbol: assetSymbol,
      })
      .addSelect('config.password')
      .getOne();

    const hashedPassword = await bcrypt.hash(password, 10);

    if (config) {
      config.password = hashedPassword;
    } else {
      config = this.walletConfigRepository.create({
        userId,
        assetSymbol,
        password: hashedPassword,
      });
    }

    await this.walletConfigRepository.save(config);

    const walletToken = this.jwtService.sign({
      userId,
      assetSymbol,
      type: 'wallet_unlock',
    });

    return { success: true, walletToken };
  }

  async getUnlockStatus(userId: string, assetSymbol: string) {
    const config = await this.walletConfigRepository.findOne({
      where: { userId, assetSymbol },
    });

    const stats = await this.getStats(userId, assetSymbol);

    if (!config) {
      return {
        hasPassword: false,
        isUnlocked: false,
        stats,
      };
    }

    const now = new Date();
    const isUnlocked = config.unlockedUntil
      ? config.unlockedUntil > now
      : false;

    return {
      hasPassword: true,
      isUnlocked,
      unlockedUntil: config.unlockedUntil,
      stats,
    };
  }

  async unlockWallet(userId: string, assetSymbol: string, password: string) {
    const config = await this.walletConfigRepository
      .createQueryBuilder('config')
      .where('config.userId = :userId AND config.assetSymbol = :symbol', {
        userId,
        symbol: assetSymbol,
      })
      .addSelect('config.password')
      .getOne();

    if (!config) {
      throw new NotFoundException('Ví chưa được thiết lập mật mã');
    }

    const isMatch = await bcrypt.compare(password, config.password);
    if (!isMatch) {
      throw new UnauthorizedException('Mật mã không chính xác');
    }

    // Unlock for 1 hour
    const unlockedUntil = new Date();
    unlockedUntil.setHours(unlockedUntil.getHours() + 1);

    config.unlockedUntil = unlockedUntil;
    await this.walletConfigRepository.save(config);

    const walletToken = this.jwtService.sign({
      userId,
      assetSymbol,
      type: 'wallet_unlock',
    });

    return { success: true, walletToken, unlockedUntil };
  }

  async createTransaction(userId: string, data: CreateTransactionDto) {
    const transaction = this.walletTransactionRepository.create({
      userId,
      ...data,
      assetSymbol: data.assetSymbol, // Ensure symbol is mapped
    });

    const saved = await this.walletTransactionRepository.save(transaction);

    // Auto-create VND transaction for crypto sales/purchases
    if (data.assetSymbol !== 'VND') {
      const quantity = Number(data.quantity);
      const price = Number(data.price) || 0;
      const total = Number(data.total) || quantity * price;

      // Case 1: SELL Crypto -> Deposit VND
      // Only trigger if it's a real sale (price > 0)
      if (data.type === TransactionType.WITHDRAW && price > 0) {
        const vndDeposit = this.walletTransactionRepository.create({
          userId,
          assetSymbol: 'VND',
          type: TransactionType.DEPOSIT,
          quantity: total,
          price: 1,
          total: total,
          source: `Bán ${quantity} ${data.assetSymbol} @ ${price}`,
          status: 'completed',
        });
        await this.walletTransactionRepository.save(vndDeposit);
      }

      // Case 2: BUY Crypto from VND Source -> Withdraw VND
      if (
        data.type === TransactionType.DEPOSIT &&
        data.source?.toUpperCase() === 'VND'
      ) {
        const vndWithdraw = this.walletTransactionRepository.create({
          userId,
          assetSymbol: 'VND',
          type: TransactionType.WITHDRAW,
          quantity: total,
          price: 1,
          total: total,
          source: `Mua ${quantity} ${data.assetSymbol} @ ${price}`,
          status: 'completed',
        });
        await this.walletTransactionRepository.save(vndWithdraw);
      }
    }

    return saved;
  }

  async updateTransaction(
    userId: string,
    assetSymbol: string,
    id: string,
    data: Partial<WalletTransaction>,
  ) {
    const tx = await this.walletTransactionRepository.findOne({
      where: { id, userId, assetSymbol },
    });

    if (!tx) throw new NotFoundException('Giao dịch không tồn tại');

    // Update with incoming data
    Object.assign(tx, data);

    // Convert string inputs to Numbers if they came from JSON
    if (data.quantity !== undefined) tx.quantity = Number(data.quantity);
    if (data.price !== undefined) tx.price = Number(data.price);
    if (data.total !== undefined) tx.total = Number(data.total);
    if (data.avgBuyPriceAtTime !== undefined)
      tx.avgBuyPriceAtTime = Number(data.avgBuyPriceAtTime);
    if (data.profitAmount !== undefined)
      tx.profitAmount = Number(data.profitAmount);

    return this.walletTransactionRepository.save(tx);
  }


  async getTransactions(userId: string, assetSymbol: string) {
    return this.walletTransactionRepository.find({
      where: { userId, assetSymbol },
      order: { timestamp: 'DESC' },
    });
  }

  async deleteTransaction(userId: string, assetSymbol: string, id: string) {
    const tx = await this.walletTransactionRepository.findOne({
      where: { id, userId, assetSymbol },
    });

    if (!tx) throw new NotFoundException('Giao dịch không tồn tại');

    await this.walletTransactionRepository.remove(tx);
    return { success: true };
  }

  private async calculateStatsMap(userId: string, symbol?: string) {
    const query = this.walletTransactionRepository
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId });

    if (symbol) {
      query.andWhere('tx.assetSymbol = :symbol', { symbol });
    }

    const transactions = await query.orderBy('tx.timestamp', 'ASC').getMany();

    const statsMap: Record<string, WalletStatsEntry> = {};

    for (const tx of transactions) {
      if (!statsMap[tx.assetSymbol]) {
        statsMap[tx.assetSymbol] = {
          balance: 0,
          receivedBalance: 0,
          totalInvested: 0,
          totalInvestedPortfolio: 0,
          savingsBalance: 0,
        };
      }

      const entry = statsMap[tx.assetSymbol];
      const quantity = Number(tx.quantity);
      const source = tx.source || '';
      // Identify internal savings transfers based on transaction source strings
      const isSavingsRelated =
        source.startsWith('Gửi lãi') ||
        source.startsWith('Rút gửi') ||
        source.startsWith('Đáo hạn') ||
        source.startsWith('Chuyển vào ví lưu trữ') ||
        source.startsWith('Rút từ ví lưu trữ');

      if (tx.type === TransactionType.DEPOSIT) {
        entry.balance += quantity;
        entry.totalInvested += Number(tx.total);
        // Add to portfolio basis ONLY if it's a real new deposit/buy, not a return from savings
        if (!isSavingsRelated) {
          entry.totalInvestedPortfolio += Number(tx.total);
        }
      } else if (tx.type === TransactionType.RECEIVE) {
        // Savings interest is compounded directly into s.quantity (savingsBalance),
        // so we record it here for history/profit tracking (receivedBalance)
        // but DON'T add it to wallet balance (balance) to avoid double counting.
        const isSavingsInterest = source.startsWith('Nhận lãi linh hoạt');
        if (!isSavingsInterest) {
          entry.balance += quantity;
        }
        entry.receivedBalance += quantity;
      } else if (tx.type === TransactionType.WITHDRAW) {
        entry.balance -= quantity;
        if (tx.status !== 'locked') {
          const avgPrice = tx.avgBuyPriceAtTime || 0;
          entry.totalInvestedPortfolio -= quantity * avgPrice;
          entry.totalInvested -= quantity * avgPrice;
        }
      }
    }

    // Adjust for active savings and storage wallets
    const [activeSavings, activeStorageWallets] = await Promise.all([
      this.walletSavingsRepository.find({
        where: { userId, status: SavingsStatus.ACTIVE },
      }),
      this.getStorageWallets(userId),
    ]);

    for (const s of activeSavings) {
      if (!statsMap[s.assetSymbol]) {
        statsMap[s.assetSymbol] = {
          balance: 0,
          receivedBalance: 0,
          totalInvested: 0,
          totalInvestedPortfolio: 0,
          savingsBalance: 0,
        };
      }
      if (!s.storageId) {
        statsMap[s.assetSymbol].savingsBalance += Number(s.quantity);
      }
    }

    for (const w of activeStorageWallets) {
      if (!statsMap[w.assetSymbol]) {
        statsMap[w.assetSymbol] = {
          balance: 0,
          receivedBalance: 0,
          totalInvested: 0,
          totalInvestedPortfolio: 0,
          savingsBalance: 0,
          storageBalance: 0,
        };
      }
      const entry = statsMap[w.assetSymbol];
      entry.storageBalance = (entry.storageBalance || 0) + Number(w.quantity);
      // Ensure initial capital is tracked in basis if no other transactions exist
      if (entry.totalInvestedPortfolio === 0 && Number(w.initialQuantity) > 0) {
        // Fallback for manual storage wallets: treat initial as cost
        // Note: For USDT, we assume price 1. For others, we might want to store cost basis.
        // For now, let's keep it simple.
      }
    }

    // Post-process to fix receivedBalance clamping and add total
    for (const symbol in statsMap) {
      const entry = statsMap[symbol];
      const storageBalance = entry.storageBalance || 0;
      const combinedBalance =
        Number(entry.balance) +
        Number(entry.savingsBalance || 0) +
        Number(storageBalance);

      // Clamping receivedBalance to combinedBalance (total ownership)
      entry.receivedBalance = Math.min(entry.receivedBalance, combinedBalance);

      entry.totalBalance = combinedBalance;
    }

    return statsMap;
  }

  async getSavings(userId: string, assetSymbol?: string) {
    return this.walletSavingsRepository.find({
      where: assetSymbol ? { userId, assetSymbol } : { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createSavings(userId: string, data: CreateSavingsDto) {
    if (data.storageId) {
      const storageWallet = await this.storageWalletRepository.findOne({
        where: {
          id: data.storageId,
          userId,
          status: StorageWalletStatus.ACTIVE,
        },
      });
      if (!storageWallet)
        throw new NotFoundException('Ví lưu trữ không tồn tại');
      if (storageWallet.quantity < Number(data.quantity)) {
        throw new BadRequestException('Số dư ví lưu trữ không đủ để gửi lãi');
      }

      // Record history in storage wallet instead of transaction in main wallet
      const history = this.storageHistoryRepository.create({
        storageWalletId: data.storageId,
        type: StorageAdjustmentType.STAKE,
        amount: Number(data.quantity),
        balanceAfter: Number(storageWallet.quantity), // Balance remains unchanged (Total Balance)
        note: `Đang gửi lãi - ${data.platform}`,
      });
      await this.storageHistoryRepository.save(history);
    } else {
      const stats = await this.getStats(userId, data.assetSymbol);
      if (stats.balance < Number(data.quantity)) {
        throw new BadRequestException('Số dư không đủ để gửi lãi');
      }

      // Create a withdrawal transaction to reflect moving funds to savings
      await this.createTransaction(userId, {
        assetSymbol: data.assetSymbol,
        type: TransactionType.WITHDRAW,
        quantity: Number(data.quantity),
        price: 0,
        total: 0,
        source: `Gửi lãi ${data.savingsType === SavingsType.FLEXIBLE ? 'linh hoạt' : `cố định ${data.durationDays} ngày`} - ${data.platform}`,
        status: 'locked',
      });
    }

    const now = new Date();
    const savings = new WalletSavings();
    savings.userId = userId;
    savings.assetSymbol = data.assetSymbol;
    savings.quantity = Number(data.quantity);
    savings.accruedInterest = 0;
    savings.annualRate = Number(data.annualRate);
    savings.platform = data.platform;
    savings.savingsType = data.savingsType;
    savings.durationDays =
      data.savingsType === SavingsType.FIXED ? (data.durationDays ?? 0) : 0;
    savings.note = data.note || '';
    savings.status = SavingsStatus.ACTIVE;
    savings.lastInterestDate = now;

    if (data.savingsType === SavingsType.FIXED && data.durationDays) {
      const startCalcDate = new Date(now);
      startCalcDate.setHours(23, 0, 0, 0);
      if (now.getHours() >= 23) {
        startCalcDate.setDate(startCalcDate.getDate() + 1);
      }
      savings.endDate = new Date(
        startCalcDate.getTime() + data.durationDays * 24 * 60 * 60 * 1000,
      );
    } else {
      savings.endDate = null as unknown as Date;
    }

    if (data.storageId) {
      savings.storageId = data.storageId;
    }

    return this.walletSavingsRepository.save(savings);
  }

  /**
   * Cron: Gọi lúc 7:00 sáng hàng ngày
   * Linh hoạt: Cộng lãi vào thẳng số tiền gửi (compound interest)
   */
  @Cron('0 7 * * *')
  async processFlexibleInterest() {
    const now = new Date();
    const activeSavings = await this.walletSavingsRepository.find({
      where: {
        savingsType: SavingsType.FLEXIBLE,
        status: SavingsStatus.ACTIVE,
      },
    });

    for (const s of activeSavings) {
      const lastPayout = s.lastInterestDate
        ? new Date(s.lastInterestDate)
        : new Date(s.startDate);
      const diffMs = now.getTime() - lastPayout.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const qty = Number(s.quantity);
      const dailyRate = Number(s.annualRate) / 100 / 365;
      const hourlyRate = dailyRate / 24;
      const interest = qty * hourlyRate * diffHours;

      console.log(
        `[Cron] Asset: ${s.assetSymbol}, DiffHours: ${diffHours}, Interest: ${interest}`,
      );

      if (interest <= 0) continue;

      // Update savings record (compound interest into principal)
      s.quantity = qty + interest;
      s.accruedInterest = Number(s.accruedInterest) + interest;
      s.lastDailyInterest = interest;
      s.lastInterestDate = now;

      await this.walletSavingsRepository.save(s);

      // Record interest as a 'RECEIVE' transaction in history
      await this.createTransaction(s.userId, {
        assetSymbol: s.assetSymbol,
        type: TransactionType.RECEIVE,
        quantity: interest,
        price: 0,
        total: 0,
        source: `Nhận lãi linh hoạt - ${s.platform}`,
      });
    }

    return { processed: activeSavings.length };
  }

  /**
   * Cron: Gọi lúc 23:00 hàng ngày
   * Cố định: Kiểm tra nếu đã đến hạn, cộng lãi + chuyển về ví
   */
  @Cron('0 23 * * *')
  async processFixedMaturity() {
    const now = new Date();
    const activeSavings = await this.walletSavingsRepository.find({
      where: { savingsType: SavingsType.FIXED, status: SavingsStatus.ACTIVE },
    });

    let processed = 0;

    for (const s of activeSavings) {
      if (!s.endDate || now < new Date(s.endDate)) continue;

      // Calculate total interest for fixed period
      const qty = Number(s.quantity);
      const days = s.durationDays || 0;
      const totalInterest = qty * (Number(s.annualRate) / 100 / 365) * days;

      // Remove the record since it's completed and returned to wallet
      await this.walletSavingsRepository.remove(s);

      // Deposit principal back to wallet (if not from storage)
      const principal = qty;
      if (s.storageId) {
        const wallet = await this.storageWalletRepository.findOne({
          where: { id: s.storageId },
        });

        if (wallet) {
          // Principal was already in wallet.quantity, only increase for interest
          const interestVal = Number(totalInterest);
          wallet.quantity = Number(wallet.quantity) + interestVal;
          await this.storageWalletRepository.save(wallet);

          // History for Unstake (Principal)
          await this.storageHistoryRepository.save(
            this.storageHistoryRepository.create({
              storageWalletId: s.storageId,
              type: StorageAdjustmentType.UNSTAKE,
              amount: principal,
              balanceAfter: Number(wallet.quantity) - interestVal,
              note: `Đáo hạn (Gốc) - ${s.platform}`,
            }),
          );

          // History for Profit (Interest)
          if (interestVal > 0) {
            await this.storageHistoryRepository.save(
              this.storageHistoryRepository.create({
                storageWalletId: s.storageId,
                type: StorageAdjustmentType.INCREASE,
                amount: interestVal,
                balanceAfter: Number(wallet.quantity),
                note: `Đáo hạn (Lãi) - ${s.platform}`,
              }),
            );
          }
        }
      } else {
        await this.createTransaction(s.userId, {
          assetSymbol: s.assetSymbol,
          type: TransactionType.DEPOSIT,
          quantity: principal,
          price: 0,
          total: 0,
          source: `Đáo hạn gửi cố định ${days} ngày - ${s.platform} (Gốc)`,
          status: 'locked',
        });

        // Record interest as RECEIVED if > 0
        if (totalInterest > 0) {
          await this.createTransaction(s.userId, {
            assetSymbol: s.assetSymbol,
            type: TransactionType.RECEIVE,
            quantity: totalInterest,
            price: 0,
            total: 0,
            source: `Đáo hạn gửi cố định ${days} ngày - ${s.platform} (Lãi)`,
          });
        }
      }

      processed++;
    }

    return { processed };
  }

  /**
   * Rút tiền gửi linh hoạt về ví
   */
  async withdrawSavings(userId: string, savingsId: string) {
    const savings = await this.walletSavingsRepository.findOne({
      where: { id: savingsId, userId, status: SavingsStatus.ACTIVE },
    });

    if (!savings) {
      throw new NotFoundException('Sổ gửi không tồn tại hoặc đã hoàn thành');
    }

    let accruedInterest = 0;

    if (savings.savingsType === SavingsType.FLEXIBLE) {
      accruedInterest = Number(savings.accruedInterest);
    }

    const totalAmount = Number(savings.quantity);
    const principal = totalAmount - accruedInterest;

    // Delete the record
    await this.walletSavingsRepository.remove(savings);

    // Deposit principal back to wallet or storage
    if (savings.storageId) {
      const wallet = await this.storageWalletRepository.findOne({
        where: { id: savings.storageId },
      });

      if (wallet) {
        const interestVal = Number(accruedInterest);
        wallet.quantity = Number(wallet.quantity) + interestVal;
        await this.storageWalletRepository.save(wallet);

        // History for Unstake (Principal)
        await this.storageHistoryRepository.save(
          this.storageHistoryRepository.create({
            storageWalletId: savings.storageId,
            type: StorageAdjustmentType.UNSTAKE,
            amount: principal,
            balanceAfter: Number(wallet.quantity) - interestVal,
            note: `Rút gửi linh hoạt (Gốc) - ${savings.platform}`,
          }),
        );

        // History for Profit (Interest)
        if (interestVal > 0) {
          await this.storageHistoryRepository.save(
            this.storageHistoryRepository.create({
              storageWalletId: savings.storageId,
              type: StorageAdjustmentType.INCREASE,
              amount: interestVal,
              balanceAfter: Number(wallet.quantity),
              note: `Rút gửi linh hoạt (Lãi) - ${savings.platform}`,
            }),
          );
        }
      }
    } else {
      await this.createTransaction(userId, {
        assetSymbol: savings.assetSymbol,
        type: TransactionType.DEPOSIT,
        quantity: principal,
        price: 0,
        total: 0,
        source: `Rút gửi linh hoạt - ${savings.platform} (Gốc)`,
        status: 'locked',
      });

      // Record interest as RECEIVED if > 0
      if (accruedInterest > 0) {
        await this.createTransaction(userId, {
          assetSymbol: savings.assetSymbol,
          type: TransactionType.RECEIVE,
          quantity: accruedInterest,
          price: 0,
          total: 0,
          source: `Rút gửi linh hoạt - ${savings.platform} (Lãi)`,
        });
      }
    }

    return {
      success: true,
      totalAmount,
      accruedInterest: accruedInterest,
    };
  }

  async deleteSavings(userId: string, id: string) {
    const savings = await this.walletSavingsRepository.findOne({
      where: { id, userId },
    });
    if (!savings) {
      throw new NotFoundException('Sổ gửi không tồn tại');
    }
    await this.walletSavingsRepository.remove(savings);
    return { success: true };
  }

  async getSavingsSummary(userId: string) {
    const savings = await this.getSavings(userId);
    const activeSavings = savings.filter(
      (s) => s.status === SavingsStatus.ACTIVE,
    );

    let totalVndValue = 0;
    let totalProfitEstimate = 0; // Simplified daily profit

    const details: Array<
      WalletSavings & { vndValue: number; dailyProfitVnd: number }
    > = [];

    for (const s of activeSavings) {
      const price = await this.p2pService.getAssetPriceInVnd(s.assetSymbol);
      const vndValue = Number(s.quantity) * price;
      totalVndValue += vndValue;

      // Estimate daily profit: (Qty * Rate / 100) / 365
      const dailyProfit =
        (Number(s.quantity) * (Number(s.annualRate) / 100)) / 365;
      totalProfitEstimate += dailyProfit * price;

      details.push({
        ...s,
        vndValue,
        dailyProfitVnd: dailyProfit * price,
      });
    }

    return {
      totalVndValue,
      totalProfitEstimateVnd: totalProfitEstimate,
      count: activeSavings.length,
      details,
    };
  }

  async getStats(userId: string, assetSymbol: string) {
    const statsMap = await this.calculateStatsMap(userId, assetSymbol);
    const stats: WalletStatsEntry = statsMap[assetSymbol] || {
      balance: 0,
      receivedBalance: 0,
      totalInvested: 0,
      totalInvestedPortfolio: 0,
      savingsBalance: 0,
    };

    if (stats.balance < 0) stats.balance = 0;
    if (stats.totalInvested < 0) stats.totalInvested = 0;
    if (stats.totalInvestedPortfolio < 0) stats.totalInvestedPortfolio = 0;

    return {
      assetSymbol,
      ...stats,
    };
  }

  async getPortfolioSummary(userId: string) {
    const assetsMap = await this.calculateStatsMap(userId);

    const summary: {
      symbol: string;
      balance: number;
      savingsBalance: number;
      storageBalance: number;
      receivedBalance: number;
      totalBalance: number | undefined;
      vndValue: number;
      price: number;
      change24h: number;
    }[] = [];
    let totalVndValue = 0;
    let totalVndValueYesterday = 0;

    for (const symbol in assetsMap) {
      const entry = assetsMap[symbol];
      if (entry.balance <= 0 && entry.savingsBalance <= 0 && symbol !== 'VND')
        continue;

      const price = await this.p2pService.getAssetPriceInVnd(symbol);
      const change24h = await this.p2pService.getAsset24hChange(symbol);
      const storageBalance = entry.storageBalance || 0;
      const totalBalance =
        Number(entry.balance) +
        Number(entry.savingsBalance || 0) +
        Number(storageBalance);
      const vndValue = totalBalance * price;

      // Calculate yesterday's value for this asset
      const yesterdayVndValue = vndValue / (1 + change24h / 100);

      totalVndValue += vndValue;
      totalVndValueYesterday += yesterdayVndValue;

      summary.push({
        symbol,
        balance: entry.balance,
        savingsBalance: entry.savingsBalance,
        storageBalance: entry.storageBalance || 0,
        receivedBalance: entry.receivedBalance || 0,
        totalBalance: entry.totalBalance,
        vndValue,
        price,
        change24h,
      });
    }

    const diff = totalVndValue - totalVndValueYesterday;
    const percent =
      totalVndValueYesterday > 0 ? (diff / totalVndValueYesterday) * 100 : 0;

    return {
      totalVndValue,
      totalVndValueYesterday,
      dailyChangeVnd: diff,
      dailyChangePercent: percent,
      assets: summary.sort((a, b) => b.vndValue - a.vndValue),
    };
  }

  async getStorageWallets(userId: string, assetSymbol?: string) {
    return this.storageWalletRepository.find({
      where: assetSymbol ? { userId, assetSymbol } : { userId },
      relations: ['history'],
      order: { createdAt: 'DESC' },
    });
  }

  async createStorageWallet(userId: string, data: CreateStorageWalletDto) {
    const stats = await this.getStats(userId, data.assetSymbol);
    if (stats.balance < Number(data.quantity)) {
      throw new BadRequestException(
        'Số dư khả dụng không đủ để chuyển vào ví lưu trữ',
      );
    }

    // Create withdrawal transaction
    await this.createTransaction(userId, {
      assetSymbol: data.assetSymbol,
      type: TransactionType.WITHDRAW,
      quantity: Number(data.quantity),
      price: 0,
      total: 0,
      source: `Chuyển vào ví lưu trữ - ${data.platform}`,
      status: 'locked',
    });

    const storageWallet = this.storageWalletRepository.create({
      userId,
      ...data,
      initialQuantity: Number(data.quantity),
      status: StorageWalletStatus.ACTIVE,
    });

    return this.storageWalletRepository.save(storageWallet);
  }

  async adjustStorageWallet(
    userId: string,
    storageId: string,
    data: AdjustStorageWalletDto,
  ) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id: storageId, userId, status: StorageWalletStatus.ACTIVE },
    });

    if (!wallet) {
      throw new NotFoundException('Ví lưu trữ không tồn tại hoặc đã đóng');
    }

    const amount = Number(data.amount);
    const oldQuantity = Number(wallet.quantity);
    let newQuantity = oldQuantity;

    if (data.type === StorageAdjustmentType.INCREASE) {
      newQuantity += amount;
    } else {
      newQuantity -= amount;
    }

    wallet.quantity = newQuantity;
    await this.storageWalletRepository.save(wallet);

    const history = this.storageHistoryRepository.create({
      storageWalletId: storageId,
      type: data.type,
      amount,
      balanceAfter: newQuantity,
      note: data.note,
    });

    await this.storageHistoryRepository.save(history);

    return { success: true, newQuantity };
  }

  async getStorageHistory(userId: string, storageId: string) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id: storageId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Ví lưu trữ không tồn tại');
    }

    return this.storageHistoryRepository.find({
      where: { storageWalletId: storageId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateInitialQuantity(
    userId: string,
    storageId: string,
    initialQuantity: number,
  ) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id: storageId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Ví lưu trữ không tồn tại');
    }

    wallet.initialQuantity = Number(initialQuantity);
    return this.storageWalletRepository.save(wallet);
  }

  async deleteStorageWallet(userId: string, storageId: string) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id: storageId, userId },
    });

    if (!wallet) {
      throw new NotFoundException('Ví lưu trữ không tồn tại');
    }

    // Cascade delete handles history
    return this.storageWalletRepository.remove(wallet);
  }

  async deleteStorageHistory(userId: string, historyId: string) {
    const history = await this.storageHistoryRepository.findOne({
      where: { id: historyId },
      relations: ['storageWallet'],
    });

    if (!history || history.storageWallet.userId !== userId) {
      throw new NotFoundException('Lịch sử không tồn tại');
    }

    // Optional: Recalculate wallet balance?
    // For now, just delete the record as requested.
    return this.storageHistoryRepository.remove(history);
  }

  async updateStorageHistory(
    userId: string,
    historyId: string,
    data: { note?: string; amount?: number },
  ) {
    const history = await this.storageHistoryRepository.findOne({
      where: { id: historyId },
      relations: ['storageWallet'],
    });

    if (!history || history.storageWallet.userId !== userId) {
      throw new NotFoundException('Lịch sử không tồn tại');
    }

    if (data.note !== undefined) history.note = data.note;
    // Note: Updating amount is risky without recalculating balanceAfter.
    // I'll stick to note for now or allow amount if user really wants it.
    if (data.amount !== undefined) history.amount = Number(data.amount);

    return this.storageHistoryRepository.save(history);
  }

  async withdrawFromStorage(userId: string, storageId: string) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id: storageId, userId, status: StorageWalletStatus.ACTIVE },
    });

    if (!wallet) {
      throw new NotFoundException('Ví lưu trữ không tồn tại hoặc đã đóng');
    }

    const quantity = Number(wallet.quantity);

    await this.storageWalletRepository.remove(wallet);

    await this.createTransaction(userId, {
      assetSymbol: wallet.assetSymbol,
      type: TransactionType.RECEIVE,
      quantity,
      price: 0,
      total: 0,
      source: `Rút từ ví lưu trữ - ${wallet.platform}`,
    });

    return { success: true, quantity };
  }

  async clearAllWalletData(userId: string) {
    // Delete all transactions
    await this.walletTransactionRepository.delete({ userId });

    // Delete all savings
    await this.walletSavingsRepository.delete({ userId });

    // Delete all storage history records first (to be safe if DB cascade is not set)
    const wallets = await this.storageWalletRepository.find({
      where: { userId },
    });
    const walletIds = wallets.map((w) => w.id);
    if (walletIds.length > 0) {
      await this.storageHistoryRepository
        .createQueryBuilder()
        .delete()
        .where('storageWalletId IN (:...ids)', { ids: walletIds })
        .execute();
    }

    // Delete all storage wallets
    await this.storageWalletRepository.delete({ userId });

    // Delete all wallet configs (passwords, etc)
    await this.walletConfigRepository.delete({ userId });

    return { success: true };
  }

  async importTransactions(userId: string, transactions: any[]) {
    for (const tx of transactions) {
      try {
        const data: any = {
          ...tx,
          userId,
          assetSymbol: tx.assetSymbol || tx.asset,
          quantity: Number(tx.quantity) || 0,
          price: Number(tx.price) || 0,
          total: Number(tx.total) || 0,
          timestamp: tx.timestamp ? new Date(tx.timestamp) : new Date(),
        };
        delete data.id;
        delete data.asset;

        const transaction = this.walletTransactionRepository.create(
          data as DeepPartial<WalletTransaction>,
        );
        await this.walletTransactionRepository.save(transaction);
      } catch (e) {
        console.error('Error importing transaction:', e, tx);
        throw e;
      }
    }
    return { success: true, count: transactions.length };
  }

  async importSavings(userId: string, savings: any[]) {
    for (const s of savings) {
      try {
        const data: any = {
          ...s,
          userId,
          assetSymbol: s.assetSymbol || s.asset,
          quantity: Number(s.quantity) || 0,
          annualRate: Number(s.annualRate) || 0,
          accruedInterest: Number(s.accruedInterest) || 0,
          startDate: s.startDate ? new Date(s.startDate) : new Date(),
          endDate: s.endDate ? new Date(s.endDate) : null,
          lastInterestDate: s.lastInterestDate
            ? new Date(s.lastInterestDate)
            : new Date(),
        };
        delete data.id;
        delete data.asset;

        const saving = this.walletSavingsRepository.create(
          data as DeepPartial<WalletSavings>,
        );
        await this.walletSavingsRepository.save(saving);
      } catch (e) {
        console.error('Error importing saving:', e, s);
        throw e;
      }
    }
    return { success: true, count: savings.length };
  }

  async importStorage(userId: string, storage: any[]) {
    for (const s of storage) {
      try {
        const history = s.history;
        const data: any = {
          ...s,
          userId,
          assetSymbol: s.assetSymbol || s.asset,
          initialQuantity: Number(s.initialQuantity) || 0,
          quantity: Number(s.quantity) || 0,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        };
        delete data.id;
        delete data.asset;
        delete data.history;

        const wallet = this.storageWalletRepository.create(
          data as DeepPartial<StorageWallet>,
        );
        const saved = await this.storageWalletRepository.save(wallet);

        if (history && Array.isArray(history)) {
          for (const h of history) {
            const hData: any = {
              ...h,
              storageWalletId: (saved as any).id,
              amount: Number(h.amount) || 0,
              balanceAfter: Number(h.balanceAfter) || 0,
              createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
            };
            delete hData.id;
            const hist = this.storageHistoryRepository.create(
              hData as DeepPartial<StorageHistory>,
            );
            await this.storageHistoryRepository.save(hist);
          }
        }
      } catch (e) {
        console.error('Error importing storage wallet:', e, s);
        throw e;
      }
    }
    return { success: true, count: storage.length };
  }

  async faucet(userId: string, assetSymbol: string) {
    if (assetSymbol !== 'FZ' && assetSymbol !== 'VND') {
      throw new BadRequestException('Faucet chỉ hỗ trợ FZ và VND (Triển khai nội bộ)');
    }

    return this.createTransaction(userId, {
      assetSymbol,
      type: TransactionType.DEPOSIT,
      quantity: 1000,
      price: assetSymbol === 'VND' ? 1 : 50000,
      total: assetSymbol === 'VND' ? 1000 : 50000000,
      source: 'Internal Faucet (Hệ thống cấp phát nội bộ)',
      status: 'completed',
    });
  }
}
