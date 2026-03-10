import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { P2pService } from '../p2p/p2p.service';

interface CreateSavingsDto {
  assetSymbol: string;
  quantity: number;
  annualRate: number;
  platform: string;
  savingsType: SavingsType;
  durationDays?: number;
  note?: string;
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

    return this.walletTransactionRepository.save(transaction);
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

    const statsMap: Record<
      string,
      {
        balance: number;
        receivedBalance: number;
        totalInvested: number;
        totalInvestedPortfolio: number;
        savingsBalance: number;
      }
    > = {};

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
        source.startsWith('Đáo hạn');

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
        // Calculate average cost of deposited tokens before this withdrawal
        const depositedBalanceBefore = entry.balance - entry.receivedBalance;
        const avgPrice = entry.totalInvested / (depositedBalanceBefore || 1);

        entry.balance -= quantity;

        // Reduce wallet total invested (cost basis) for the remaining tokens
        const costBasis = Number(tx.avgBuyPriceAtTime) || avgPrice;
        const investedReduction = Math.min(
          entry.totalInvested,
          quantity * costBasis,
        );
        entry.totalInvested -= investedReduction;

        // Reduce portfolio basis ONLY if it's a real external withdrawal/sell
        if (!isSavingsRelated) {
          // Identify the share of portfolio basis corresponding to this quantity
          // For simplicity, we use the same investedReduction calculated from the wallet
          // as savings moves don't change the portfolio-wide avg price.
          entry.totalInvestedPortfolio -= investedReduction;
        }
      }
    }

    // Adjust for active savings
    const activeSavings = await this.walletSavingsRepository.find({
      where: { userId, status: SavingsStatus.ACTIVE },
    });

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
      statsMap[s.assetSymbol].savingsBalance += Number(s.quantity);
    }

    // Post-process to fix receivedBalance clamping and add total
    for (const symbol in statsMap) {
      const entry = statsMap[symbol];
      const combinedBalance = entry.balance + entry.savingsBalance;

      // Proportional reduction of received balance if total ownership is less than total received
      // This handles the case where user withdraws/sells tokens they originally received
      if (combinedBalance < entry.receivedBalance) {
        entry.receivedBalance = Math.max(0, combinedBalance);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (entry as any).totalBalance = combinedBalance;
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
    });

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

      // Deposit principal back to wallet
      const principal = qty;
      await this.createTransaction(s.userId, {
        assetSymbol: s.assetSymbol,
        type: TransactionType.DEPOSIT,
        quantity: principal,
        price: 0,
        total: 0,
        source: `Đáo hạn gửi cố định ${days} ngày - ${s.platform} (Gốc)`,
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

    if (savings.savingsType === SavingsType.FIXED) {
      throw new BadRequestException('Không thể rút sổ gửi cố định trước hạn');
    }

    const totalAmount = Number(savings.quantity);
    const accruedInterest = Number(savings.accruedInterest);
    const principal = totalAmount - accruedInterest;

    // Delete the record
    await this.walletSavingsRepository.remove(savings);

    // Deposit principal back to wallet
    await this.createTransaction(userId, {
      assetSymbol: savings.assetSymbol,
      type: TransactionType.DEPOSIT,
      quantity: principal,
      price: 0,
      total: 0,
      source: `Rút gửi linh hoạt - ${savings.platform} (Gốc)`,
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

    return {
      success: true,
      totalAmount,
      accruedInterest: accruedInterest,
    };
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
    const stats = statsMap[assetSymbol] || {
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
      vndValue: number;
      price: number;
    }[] = [];
    let totalVndValue = 0;

    for (const symbol in assetsMap) {
      const entry = assetsMap[symbol];
      if (entry.balance <= 0 && entry.savingsBalance <= 0 && symbol !== 'VND')
        continue;

      const price = await this.p2pService.getAssetPriceInVnd(symbol);
      const totalBalance = entry.balance + entry.savingsBalance;
      const vndValue = totalBalance * price;
      totalVndValue += vndValue;

      summary.push({
        symbol,
        balance: entry.balance,
        savingsBalance: entry.savingsBalance,
        vndValue,
        price,
      });
    }

    return {
      totalVndValue,
      assets: summary.sort((a, b) => b.vndValue - a.vndValue),
    };
  }
}
