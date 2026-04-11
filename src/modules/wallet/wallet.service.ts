/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
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
import {
  StorageWallet,
  StorageWalletStatus,
} from './entities/storage-wallet.entity';
import {
  StorageHistory,
  StorageAdjustmentType,
} from './entities/storage-history.entity';
import { AdjustStorageWalletDto } from './dto/adjust-storage.dto';
import { SystemConfig } from './entities/system-config.entity';
import { WalletLoan, LoanStatus } from './entities/wallet-loan.entity';

export interface WalletStatsEntry {
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
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(WalletLoan)
    private walletLoanRepository: Repository<WalletLoan>,
    private readonly jwtService: JwtService,
    private readonly p2pService: P2pService,
  ) {}

  async onModuleInit() {
    const existingAddress = await this.getSystemValue('fz_contract_address');
    if (!existingAddress) {
      const defaultAddress =
        process.env.VITE_FZ_CONTRACT_ADDRESS ||
        '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';
      await this.setSystemValue('fz_contract_address', defaultAddress);
    }
  }

  async getSystemValue(key: string): Promise<string | undefined> {
    const config = await this.systemConfigRepository.findOne({
      where: { key },
    });
    return config ? config.value : undefined;
  }

  async setSystemValue(key: string, value: string): Promise<SystemConfig> {
    let config = await this.systemConfigRepository.findOne({ where: { key } });
    if (config) {
      config.value = value;
    } else {
      config = this.systemConfigRepository.create({ key, value });
    }
    return this.systemConfigRepository.save(config);
  }

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
    const qty = Number(data.quantity);
    const price = Number(data.price) || 0;
    const total = Number(data.total) || qty * price;

    const transaction = this.walletTransactionRepository.create({
      userId,
      ...data,
      assetSymbol: data.assetSymbol,
      remainingQuantity: (data.type === TransactionType.DEPOSIT || data.type === TransactionType.RECEIVE) ? qty : 0,
    });

    // --- Lot Management Logic for Deposits/Receives ---
    if (data.type === TransactionType.DEPOSIT || data.type === TransactionType.RECEIVE) {
      const inputCode = (data.contractCode || '').trim();
      let finalCode: string | null =
        inputCode && inputCode.toUpperCase() !== 'PENDING' ? inputCode : null;

      if (!finalCode) {
        // Find existing lot with same price to pool
        const existingLot = await this.walletTransactionRepository.findOne({
          where: {
            userId,
            assetSymbol: data.assetSymbol,
            type: data.type, // Match the exact type (Deposit or Receive)
            price: price,
            remainingQuantity: MoreThan(0),
          },
          order: { timestamp: 'ASC' },
        });

        if (existingLot && existingLot.contractCode) {
          finalCode = existingLot.contractCode;
          transaction.contractCode = finalCode;
          transaction.source = data.source
            ? `${data.source} (Bổ sung lô ${finalCode})`
            : `Bổ sung lô ${finalCode}`;
        } else {
          const displayPrice = Math.floor(price);
          transaction.contractCode = `PK-${displayPrice}`;
        }
      } else {
        transaction.contractCode = finalCode;
        transaction.source = data.source
          ? `${data.source} [Lô: ${finalCode}]`
          : `[Lô: ${finalCode}]`;
      }
    }

    // --- HIFO Logic for Withdrawals ---
    if (
      data.type === TransactionType.WITHDRAW ||
      data.type === TransactionType.STAKING ||
      data.type === TransactionType.SWAP ||
      data.type === TransactionType.LOAN
    ) {
      const lots = await this.walletTransactionRepository
        .createQueryBuilder('tx')
        .where('tx.userId = :userId', { userId })
        .andWhere('tx.assetSymbol = :symbol', { symbol: data.assetSymbol })
        .andWhere('tx.type IN (:...types)', { types: [TransactionType.DEPOSIT, TransactionType.RECEIVE] })
        .andWhere('tx.remainingQuantity > 0')
        .orderBy('tx.price', 'DESC')
        .addOrderBy('tx.timestamp', 'ASC')
        .getMany();

      let remainingToWithdraw = qty;
      let totalCostBasis = 0;
      const lotWithdrawals: Array<{
        lotId: string;
        contractCode: string;
        quantityTaken: number;
        lotPrice: number;
        profit: number;
      }> = [];

      for (const lot of lots) {
        if (remainingToWithdraw <= 0) break;

        const taken = Math.min(
          Number(lot.remainingQuantity),
          remainingToWithdraw,
        );
        const lotPrice = Number(lot.price);
        const lotProfit = taken * (price - lotPrice);

        lot.remainingQuantity = Number(lot.remainingQuantity) - taken;

        if (data.type === TransactionType.STAKING) {
          lot.stakedQuantity = (Number(lot.stakedQuantity) || 0) + taken;
        }

        if (Number(lot.remainingQuantity) <= 0) {
          lot.status = 'exhausted';
        }
        await this.walletTransactionRepository.save(lot);

        lotWithdrawals.push({
          lotId: lot.id,
          contractCode: lot.contractCode || lot.id,
          quantityTaken: taken,
          lotPrice,
          profit: lotProfit,
        });

        totalCostBasis += taken * lotPrice;
        remainingToWithdraw -= taken;
      }

      transaction.lotWithdrawals = lotWithdrawals;
      transaction.avgBuyPriceAtTime = qty > 0 ? totalCostBasis / qty : 0;
      transaction.profitAmount =
        data.type === TransactionType.STAKING
          ? 0
          : qty * price - totalCostBasis;
    }

    if (data.type === TransactionType.UNSTAKING && data.stakingTransactionId) {
      const stakingTx = await this.walletTransactionRepository.findOne({
        where: { id: data.stakingTransactionId, userId },
      });
      if (stakingTx && stakingTx.lotWithdrawals) {
        for (const lw of stakingTx.lotWithdrawals as any[]) {
          const lot = await this.walletTransactionRepository.findOne({
            where: { id: lw.lotId },
          });
          if (lot) {
            lot.stakedQuantity = Math.max(
              0,
              Number(lot.stakedQuantity) - Number(lw.quantityTaken),
            );
            lot.remainingQuantity =
              Number(lot.remainingQuantity) + Number(lw.quantityTaken);
            lot.status = 'active';
            await this.walletTransactionRepository.save(lot);
          }
        }
      }
    }

    let saved = await this.walletTransactionRepository.save(transaction);

    // Final safety check for missing codes
    if (
      data.type === TransactionType.DEPOSIT &&
      (!saved.contractCode || saved.contractCode.startsWith('DP-'))
    ) {
      const displayPrice = Math.floor(Number(saved.price || 0));
      saved.contractCode = `PK-${displayPrice}`;
      saved = await this.walletTransactionRepository.save(saved);
    }

    // Auto-create VND transaction for crypto sales/purchases
    if (data.assetSymbol !== 'VND') {
      if (
        (data.type === TransactionType.WITHDRAW ||
          data.type === TransactionType.SWAP) &&
        price > 0
      ) {
        const vndDeposit = this.walletTransactionRepository.create({
          userId,
          assetSymbol: 'VND',
          type: TransactionType.DEPOSIT,
          quantity: total,
          price: 1,
          total: total,
          remainingQuantity: total,
          source: `Bán ${qty} ${data.assetSymbol} @ ${price}`,
          status: 'completed',
        });
        await this.walletTransactionRepository.save(vndDeposit);
      }

      if (
        data.type === TransactionType.DEPOSIT &&
        data.source?.toUpperCase() === 'VND'
      ) {
        await this.createTransaction(userId, {
          assetSymbol: 'VND',
          type: TransactionType.WITHDRAW,
          quantity: total,
          price: 1,
          total: total,
          source: `Mua ${qty} ${data.assetSymbol} @ ${price}`,
          status: 'completed',
        });
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
    Object.assign(tx, data);
    return this.walletTransactionRepository.save(tx);
  }

  async getTransactions(userId: string, assetSymbol: string) {
    return this.walletTransactionRepository.find({
      where: { userId, assetSymbol },
      order: { timestamp: 'DESC' },
    });
  }

  async getLots(userId: string, assetSymbol: string) {
    const lots = await this.walletTransactionRepository.find({
      where: {
        userId,
        assetSymbol,
        type: TransactionType.DEPOSIT,
      },
      order: { price: 'DESC', timestamp: 'ASC' },
    });

    // Calculate realized profit per lot from withdrawals
    const withdrawals = await this.walletTransactionRepository.find({
      where: { userId, assetSymbol, type: TransactionType.WITHDRAW },
    });

    const lotProfits: Record<string, number> = {};
    for (const w of withdrawals) {
      if (w.lotWithdrawals && Array.isArray(w.lotWithdrawals)) {
        for (const lw of w.lotWithdrawals as Array<{
          lotId: string;
          profit: number;
        }>) {
          lotProfits[lw.lotId] =
            (lotProfits[lw.lotId] || 0) + Number(lw.profit || 0);
        }
      }
    }

    // Fix up any missing, legacy, or 'PENDING' codes and attach profit
    for (const lot of lots) {
      const displayPrice = Math.floor(Number(lot.price || 0));
      const targetCode = `PK-${displayPrice}`;

      if (
        !lot.contractCode ||
        lot.contractCode.toUpperCase() === 'PENDING' ||
        lot.contractCode !== targetCode
      ) {
        lot.contractCode = targetCode;
        await this.walletTransactionRepository.save(lot);
      }

      // Attach calculated profit
      (lot as any).realizedProfit = lotProfits[lot.id] || 0;
    }

    return lots;
  }

  async deleteTransaction(userId: string, assetSymbol: string, id: string) {
    const tx = await this.walletTransactionRepository.findOne({
      where: { id, userId, assetSymbol },
    });
    if (!tx) throw new NotFoundException('Giao dịch không tồn tại');
    await this.walletTransactionRepository.remove(tx);
    return { success: true };
  }

  async getStats(userId: string, symbol: string) {
    const statsMap = await this.calculateStatsMap(userId, symbol);
    return (
      statsMap[symbol] || {
        balance: 0,
        receivedBalance: 0,
        totalInvested: 0,
        totalInvestedPortfolio: 0,
        savingsBalance: 0,
      }
    );
  }

  async getPortfolioSummary(userId: string) {
    const configs = await this.walletConfigRepository.find({
      where: { userId },
    });
    const configMap = new Map(configs.map((c) => [c.assetSymbol, true]));
    const statsMap = await this.calculateStatsMap(userId);
    const assets: any[] = [];
    let totalVndValue = 0;

    for (const symbol in statsMap) {
      const entry = statsMap[symbol];
      const price = await this.p2pService.getAssetPriceInVnd(symbol);
      const vndValue = (entry.totalBalance || 0) * price;
      totalVndValue += vndValue;

      assets.push({
        symbol,
        balance: entry.balance,
        savingsBalance: entry.savingsBalance,
        storageBalance: entry.storageBalance || 0,
        totalBalance: entry.totalBalance || 0,
        price,
        vndValue,
        hasPassword: configMap.has(symbol),
      });
    }

    // Force inclusion of configured assets even if no balance
    for (const config of configs) {
      if (!statsMap[config.assetSymbol]) {
        const price = await this.p2pService.getAssetPriceInVnd(
          config.assetSymbol,
        );
        assets.push({
          symbol: config.assetSymbol,
          balance: 0,
          savingsBalance: 0,
          storageBalance: 0,
          totalBalance: 0,
          price,
          vndValue: 0,
          hasPassword: true,
        });
      }
    }

    return {
      assets,
      totalVndValue,
      dailyPerformanceVnd: 0,
      dailyPerformancePercent: 0,
    };
  }

  async getGrowthStats(userId: string) {
    const transactions = await this.walletTransactionRepository.find({
      where: { userId },
      order: { timestamp: 'ASC' },
    });

    const prices: Record<string, number> = {};
    const assets = [...new Set(transactions.map((t) => t.assetSymbol))];
    for (const sym of assets) {
      prices[sym] = await this.p2pService.getAssetPriceInVnd(sym);
    }

    const history: Array<{ date: string; value: number }> = [];
    const dailyBalances: Record<string, number> = {};
    const daysToLookBack = 30;

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysToLookBack);
    startDate.setHours(0, 0, 0, 0);

    // Initial balances before the start date
    const preStartTxs = transactions.filter((t) => t.timestamp < startDate);
    for (const tx of preStartTxs) {
      if (!dailyBalances[tx.assetSymbol]) dailyBalances[tx.assetSymbol] = 0;
      if (
        tx.type === TransactionType.DEPOSIT ||
        tx.type === TransactionType.RECEIVE
      ) {
        dailyBalances[tx.assetSymbol] += Number(tx.quantity);
      } else if (tx.type === TransactionType.WITHDRAW) {
        dailyBalances[tx.assetSymbol] -= Number(tx.quantity);
      }
    }

    // Daily snapshots
    for (let i = 0; i <= daysToLookBack; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const dayTxs = transactions.filter(
        (t) =>
          t.timestamp >= d &&
          t.timestamp < new Date(d.getTime() + 24 * 60 * 60 * 1000),
      );

      for (const tx of dayTxs) {
        if (!dailyBalances[tx.assetSymbol]) dailyBalances[tx.assetSymbol] = 0;
        if (
          tx.type === TransactionType.DEPOSIT ||
          tx.type === TransactionType.RECEIVE
        ) {
          dailyBalances[tx.assetSymbol] += Number(tx.quantity);
        } else if (tx.type === TransactionType.WITHDRAW) {
          dailyBalances[tx.assetSymbol] -= Number(tx.quantity);
        }
      }

      let dailyTotalVnd = 0;
      for (const sym in dailyBalances) {
        dailyTotalVnd += dailyBalances[sym] * (prices[sym] || 0);
      }

      history.push({ date: dateStr, value: Math.floor(dailyTotalVnd) });
    }

    return history;
  }

  // --- LOANS ---
  async getLoans(userId: string, assetSymbol: string) {
    const where: any = { userId };
    if (assetSymbol && assetSymbol.toUpperCase() !== 'ALL') {
      where.assetSymbol = assetSymbol;
    }
    const loans = await this.walletLoanRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    // Enrich with lot information if transaction ID exists
    const enriched = await Promise.all(loans.map(async (loan) => {
      if (loan.originalTransactionId) {
        const tx = await this.walletTransactionRepository.findOne({
          where: { id: loan.originalTransactionId },
          select: ['lotWithdrawals']
        });
        return {
          ...loan,
          slots: tx?.lotWithdrawals?.map((w: any) => w.contractCode).join(', ') || '---'
        };
      }
      return { ...loan, slots: '---' };
    }));

    return enriched;
  }

  async createLoan(
    userId: string,
    data: {
      assetSymbol: string;
      borrower: string;
      amount: number;
      hasInterest: boolean;
      interestRate: number;
    },
  ) {
    // Optionally create a transaction for the outgoing funds (withdraw style)
    const loanTx = await this.createTransaction(userId, {
      assetSymbol: data.assetSymbol,
      type: TransactionType.LOAN,
      quantity: data.amount,
      price: data.assetSymbol === 'VND' ? 1 : 0,
      total: data.amount,
      source: `Cấp khoản vay: ${data.borrower}`,
      status: 'completed',
    });

    const loan = this.walletLoanRepository.create({
      userId,
      ...data,
      collected: 0,
      originalTransactionId: loanTx.id,
    });
    return this.walletLoanRepository.save(loan);
  }

  async collectLoan(userId: string, id: string, amount: number) {
    const loan = await this.walletLoanRepository.findOne({
      where: { id, userId },
    });
    if (!loan) throw new NotFoundException('Khoản vay không tồn tại');

    loan.collected = Number(loan.collected) + Number(amount);
    if (loan.collected >= loan.amount) {
      loan.collected = loan.amount;
      loan.status = LoanStatus.COMPLETED;
    }

    // --- Restore Liquidity to Original Lots ---
    let refillSlotCode = '---';
    if (loan.originalTransactionId) {
      const originTx = await this.walletTransactionRepository.findOne({
        where: { id: loan.originalTransactionId },
      });
      if (originTx && originTx.lotWithdrawals) {
        // Use the first lot's code for the RECEIVE transaction display
        if (originTx.lotWithdrawals.length > 0) {
          refillSlotCode = originTx.lotWithdrawals[0].contractCode;
        }

        let refillLeft = Number(amount);
        for (const w of originTx.lotWithdrawals) {
          if (refillLeft <= 0) break;
          const lotId = String(w.lotId);
          const take = Math.min(refillLeft, Number(w.quantity));
          
          if (take > 0) {
            // Refill the lot using native increment for safety
            await this.walletTransactionRepository.increment(
              { id: lotId },
              'remainingQuantity',
              take
            );
            refillLeft -= take;
          }
        }
      }
    }

    // Create a RECEIVE transaction for audit, with the correct slot code inherited
    await this.createTransaction(userId, {
      assetSymbol: loan.assetSymbol,
      type: TransactionType.RECEIVE,
      quantity: amount,
      price: loan.assetSymbol === 'VND' ? 1 : 0,
      total: amount,
      source: `Thu hồi nợ: ${loan.borrower} (Hoàn trả lô gốc)`,
      contractCode: refillSlotCode, // Inherit the original lot code
      status: 'completed',
    });

    return this.walletLoanRepository.save(loan);
  }

  async getSavings(userId: string) {
    return this.walletSavingsRepository.find({
      where: { userId, status: SavingsStatus.ACTIVE },
    });
  }

  async createSavings(
    userId: string,
    data: {
      assetSymbol: string;
      quantity: number;
      annualRate: number;
      platform: string;
      savingsType: SavingsType;
      durationDays?: number;
      note?: string;
      storageId?: string;
    },
  ) {
    const {
      assetSymbol,
      quantity,
      annualRate,
      platform,
      savingsType,
      durationDays,
      note,
      storageId,
    } = data;

    // 1. Check source and deduct funds
    if (storageId) {
      // Deduct from storage wallet
      await this.adjustStorageWallet(userId, storageId, {
        amount: quantity,
        type: StorageAdjustmentType.DECREASE,
        note: `Chuyển sang gửi lãi - ${platform}`,
      });
    } else {
      // Deduct from main wallet
    }
    const transaction = await this.createTransaction(userId, {
      assetSymbol,
      type: TransactionType.STAKING,
      quantity,
      price: 0,
      total: 0,
      source: `Gửi lãi - ${platform}`,
      status: 'completed',
    });

    const savings = this.walletSavingsRepository.create({
      userId,
      assetSymbol,
      quantity,
      annualRate,
      platform,
      savingsType,
      note,
      status: SavingsStatus.ACTIVE,
      startDate: new Date(),
      stakingTransactionId: transaction.id,
    } as WalletSavings);

    if (savingsType === SavingsType.FIXED && durationDays) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + Number(durationDays));
      savings.endDate = endDate;
    }

    return this.walletSavingsRepository.save(savings);
  }

  async withdrawSavings(userId: string, id: string) {
    const savings = await this.walletSavingsRepository.findOne({
      where: { id, userId, status: SavingsStatus.ACTIVE },
    });
    if (!savings) throw new NotFoundException('Khoản tiết kiệm không tồn tại');

    // Withdraw staking (if exists)
    if (savings.stakingTransactionId) {
      await this.createTransaction(userId, {
        assetSymbol: savings.assetSymbol,
        type: TransactionType.UNSTAKING,
        quantity: savings.quantity,
        price: 0,
        total: 0,
        source: `Rút gửi lãi - ${savings.platform}`,
        status: 'completed',
        stakingTransactionId: savings.stakingTransactionId,
      });
    } else {
      // Legacy support: Just add back to main wallet
      await this.createTransaction(userId, {
        assetSymbol: savings.assetSymbol,
        type: TransactionType.DEPOSIT,
        quantity: savings.quantity,
        price: 0,
        total: 0,
        source: `Rút gửi lãi - ${savings.platform}`,
        status: 'completed',
      });
    }

    savings.status = SavingsStatus.COMPLETED;
    await this.walletSavingsRepository.save(savings);

    return { success: true };
  }

  async getSavingsSummary(userId: string) {
    const savings = await this.getSavings(userId);
    const details = savings.map((s) => ({
      ...s,
      dailyProfitVnd:
        Number(s.quantity) * (Number(s.annualRate) / 100 / 365) * 24000, // Approximate
    }));
    return { details };
  }

  async deleteSavings(userId: string, id: string) {
    const s = await this.walletSavingsRepository.findOne({
      where: { id, userId },
    });
    if (!s) throw new NotFoundException();
    await this.walletSavingsRepository.remove(s);
    return { success: true };
  }

  @Cron('0 7 * * *')
  async processFlexibleInterest() {
    const activeSavings = await this.walletSavingsRepository.find({
      where: {
        savingsType: SavingsType.FLEXIBLE,
        status: SavingsStatus.ACTIVE,
      },
    });
    for (const s of activeSavings) {
      const interest =
        Number(s.quantity) * (Number(s.annualRate) / 100 / 365 / 24); // 1 hour interest
      s.quantity = Number(s.quantity) + interest;
      await this.walletSavingsRepository.save(s);
    }
  }

  @Cron('0 23 * * *')
  async processFixedMaturity() {
    // Simplified trigger
  }

  async getStorageWallets(userId: string) {
    return this.storageWalletRepository.find({
      where: { userId, status: StorageWalletStatus.ACTIVE },
    });
  }

  async createStorageWallet(
    userId: string,
    data: {
      assetSymbol: string;
      quantity: number;
      platform: string;
      note?: string;
    },
  ) {
    const { assetSymbol, quantity, platform, note } = data;

    // 1. Deduct from main wallet
    await this.createTransaction(userId, {
      assetSymbol,
      type: TransactionType.WITHDRAW,
      quantity,
      price: 0,
      total: 0,
      source: `Chuyển vào ví lưu trữ - ${platform}`,
      status: 'completed',
    });

    const wallet = this.storageWalletRepository.create({
      userId,
      assetSymbol,
      quantity,
      platform,
      note,
      initialQuantity: quantity,
      status: StorageWalletStatus.ACTIVE,
    });
    return this.storageWalletRepository.save(wallet);
  }

  async withdrawFromStorage(userId: string, storageId: string) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id: storageId, userId },
    });
    if (!wallet) throw new NotFoundException();

    // Add back to main wallet
    await this.createTransaction(userId, {
      assetSymbol: wallet.assetSymbol,
      type: TransactionType.DEPOSIT,
      quantity: wallet.quantity,
      price: 0,
      total: 0,
      source: `Rút từ ví lưu trữ - ${wallet.platform}`,
      status: 'completed',
    });

    await this.storageWalletRepository.remove(wallet);
    return { success: true };
  }

  async adjustStorageWallet(
    userId: string,
    id: string,
    dto: AdjustStorageWalletDto,
  ) {
    const wallet = await this.storageWalletRepository.findOne({
      where: { id, userId },
    });
    if (!wallet) throw new NotFoundException('Ví không tồn tại');

    const amount = Number(dto.amount);
    if (dto.type === StorageAdjustmentType.INCREASE) {
      wallet.quantity = Number(wallet.quantity) + amount;
    } else if (dto.type === StorageAdjustmentType.DECREASE) {
      if (Number(wallet.quantity) < amount) {
        throw new BadRequestException('Số dư ví lưu trữ không đủ');
      }
      wallet.quantity = Number(wallet.quantity) - amount;
    }

    const history = this.storageHistoryRepository.create({
      storageWalletId: id,
      type: dto.type,
      amount: amount,
      balanceAfter: wallet.quantity,
      note: dto.note,
    });

    await this.storageHistoryRepository.save(history);
    return this.storageWalletRepository.save(wallet);
  }

  async getStorageHistory(userId: string, id: string) {
    return this.storageHistoryRepository.find({
      where: { storageWalletId: id },
    });
  }

  async updateInitialQuantity(userId: string, id: string, qty: number) {
    const w = await this.storageWalletRepository.findOne({
      where: { id, userId },
    });
    if (!w) throw new NotFoundException();
    w.initialQuantity = qty;
    return this.storageWalletRepository.save(w);
  }

  async deleteStorageWallet(userId: string, id: string) {
    const w = await this.storageWalletRepository.findOne({
      where: { id, userId },
    });
    if (w) await this.storageWalletRepository.remove(w);
    return { success: true };
  }

  async deleteStorageHistory(userId: string, id: string) {
    const h = await this.storageHistoryRepository.findOne({ where: { id } });
    if (h) await this.storageHistoryRepository.remove(h);
    return { success: true };
  }

  async updateStorageHistory(userId: string, id: string, dto: any) {
    const h = await this.storageHistoryRepository.findOne({ where: { id } });
    if (!h) throw new NotFoundException();
    Object.assign(h, dto);
    return this.storageHistoryRepository.save(h);
  }

  async clearAllWalletData(userId: string) {
    await this.walletTransactionRepository.delete({ userId });
    await this.walletSavingsRepository.delete({ userId });
    await this.storageWalletRepository.delete({ userId });
    await this.walletConfigRepository.delete({ userId });
    return { success: true };
  }

  async importTransactions(userId: string, transactions: WalletTransaction[]) {
    for (const tx of transactions) {
      const data = this.walletTransactionRepository.create({ ...tx, userId });
      (data as any).id = undefined;
      await this.walletTransactionRepository.save(data);
    }
    return { success: true, count: transactions.length };
  }

  async importSavings(userId: string, savings: WalletSavings[]) {
    for (const s of savings) {
      const data = this.walletSavingsRepository.create({ ...s, userId });
      delete (data as any).id;
      await this.walletSavingsRepository.save(data);
    }
    return { success: true, count: savings.length };
  }

  async importStorage(userId: string, storage: StorageWallet[]) {
    for (const w of storage) {
      const data = this.storageWalletRepository.create({ ...w, userId });
      delete (data as any).id;
      await this.storageWalletRepository.save(data);
    }
    return { success: true, count: storage.length };
  }

  async faucet(userId: string, symbol: string) {
    return this.createTransaction(userId, {
      assetSymbol: symbol,
      type: TransactionType.DEPOSIT,
      quantity: 1000,
      price: symbol === 'VND' ? 1 : 25000,
      total: symbol === 'VND' ? 1000 : 25000000,
      source: 'FAUCET',
      status: 'completed',
    });
  }

  private async calculateStatsMap(userId: string, symbol?: string) {
    const query = this.walletTransactionRepository
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId });

    if (symbol) query.andWhere('tx.assetSymbol = :symbol', { symbol });

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
          storageBalance: 0,
          totalBalance: 0,
        };
      }
      const entry = statsMap[tx.assetSymbol];
      if (
        tx.type === TransactionType.DEPOSIT ||
        tx.type === TransactionType.RECEIVE ||
        tx.type === TransactionType.UNSTAKING
      )
        entry.balance += Number(tx.quantity);
      else if (
        tx.type === TransactionType.WITHDRAW ||
        tx.type === TransactionType.STAKING ||
        tx.type === TransactionType.SWAP
      )
        entry.balance -= Number(tx.quantity);
    }

    const savings = await this.getSavings(userId);
    for (const s of savings) {
      if (!statsMap[s.assetSymbol]) {
        statsMap[s.assetSymbol] = {
          balance: 0,
          receivedBalance: 0,
          totalInvested: 0,
          totalInvestedPortfolio: 0,
          savingsBalance: 0,
          storageBalance: 0,
          totalBalance: 0,
        };
      }
      statsMap[s.assetSymbol].savingsBalance += Number(s.quantity);
    }

    const storage = await this.getStorageWallets(userId);
    for (const w of storage) {
      if (!statsMap[w.assetSymbol]) {
        statsMap[w.assetSymbol] = {
          balance: 0,
          receivedBalance: 0,
          totalInvested: 0,
          totalInvestedPortfolio: 0,
          savingsBalance: 0,
          storageBalance: 0,
          totalBalance: 0,
        };
      }
      const entry = statsMap[w.assetSymbol];
      entry.storageBalance = (entry.storageBalance || 0) + Number(w.quantity);
    }

    for (const sym in statsMap) {
      const entry = statsMap[sym];
      entry.totalBalance =
        Number(entry.balance || 0) +
        Number(entry.savingsBalance || 0) +
        Number(entry.storageBalance || 0);
    }

    return statsMap;
  }
}
