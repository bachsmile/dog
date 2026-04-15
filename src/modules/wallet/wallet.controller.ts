import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Delete,
  Patch,
  Put,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { AuthGuard } from '../../guards/auth.guard';
import { WalletGuard } from '../../guards/wallet.guard';
import { WalletSecurityDto } from './dto/wallet-security.dto';
import { CreateTransactionDto } from './dto/transaction.dto';
import { AdjustStorageWalletDto } from './dto/adjust-storage.dto';
import { SavingsType } from './entities/wallet-savings.entity';

interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
    email: string;
  };
}

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('activate')
  @UseGuards(AuthGuard)
  async activate(@Request() req: AuthenticatedRequest) {
    return this.walletService.activateWallet(req.user.sub);
  }

  @Get('system-config/:key')
  async getSystemConfig(@Param('key') key: string) {
    const value = await this.walletService.getSystemValue(key);
    // Return pure string as requested by useWeb3.ts (data === 'string')
    return value;
  }

  @Post('password')
  @UseGuards(AuthGuard)
  async setPassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: WalletSecurityDto,
  ) {
    return this.walletService.setWalletPassword(
      req.user.sub,
      dto.assetSymbol,
      dto.password,
    );
  }

  @Post('unlock')
  @UseGuards(AuthGuard)
  async unlock(
    @Request() req: AuthenticatedRequest,
    @Body() dto: WalletSecurityDto,
  ) {
    return this.walletService.unlockWallet(
      req.user.sub,
      dto.assetSymbol,
      dto.password,
    );
  }

  @Get('status/:assetSymbol')
  @UseGuards(AuthGuard)
  async getStatus(
    @Request() req: AuthenticatedRequest,
    @Param('assetSymbol') assetSymbol: string,
  ) {
    return this.walletService.getUnlockStatus(req.user.sub, assetSymbol);
  }

  // Transaction History & CRUD
  @Get('transactions/:assetSymbol')
  @UseGuards(WalletGuard)
  async getTransactions(
    @Request() req: AuthenticatedRequest,
    @Param('assetSymbol') assetSymbol: string,
  ) {
    return this.walletService.getTransactions(req.user.sub, assetSymbol);
  }

  @Post('transactions')
  @UseGuards(WalletGuard)
  async createTransaction(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.walletService.createTransaction(req.user.sub, dto);
  }

  @Put('transactions/:assetSymbol/:id')
  @UseGuards(WalletGuard)
  async updateTransaction(
    @Request() req: AuthenticatedRequest,
    @Param('assetSymbol') assetSymbol: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTransactionDto>,
  ) {
    return await this.walletService.updateTransaction(
      req.user.sub,
      assetSymbol,
      id,
      dto,
    );
  }

  @Delete('transactions/:assetSymbol/:id')
  @UseGuards(WalletGuard)
  async deleteTransaction(
    @Request() req: AuthenticatedRequest,
    @Param('assetSymbol') assetSymbol: string,
    @Param('id') id: string,
  ) {
    return this.walletService.deleteTransaction(req.user.sub, assetSymbol, id);
  }

  @Get('stats/:assetSymbol')
  @UseGuards(WalletGuard)
  async getStats(
    @Request() req: AuthenticatedRequest,
    @Param('assetSymbol') assetSymbol: string,
  ) {
    return this.walletService.getStats(req.user.sub, assetSymbol);
  }

  @Get('portfolio/summary')
  @UseGuards(AuthGuard)
  async getPortfolioSummary(@Request() req: AuthenticatedRequest) {
    return this.walletService.getPortfolioSummary(req.user.sub);
  }

  // Savings Endpoints
  @Get('savings')
  @UseGuards(AuthGuard)
  async getSavings(@Request() req: AuthenticatedRequest) {
    return this.walletService.getSavings(req.user.sub);
  }

  @Post('savings')
  @UseGuards(WalletGuard)
  async createSavings(
    @Request() req: AuthenticatedRequest,
    @Body()
    dto: {
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
    return this.walletService.createSavings(req.user.sub, dto);
  }

  @Post('savings/:id/withdraw')
  @UseGuards(WalletGuard)
  async withdrawSavings(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.walletService.withdrawSavings(req.user.sub, id);
  }

  @Get('savings/summary')
  @UseGuards(AuthGuard)
  async getSavingsSummary(@Request() req: AuthenticatedRequest) {
    return this.walletService.getSavingsSummary(req.user.sub);
  }

  @Delete('savings/:id')
  @UseGuards(AuthGuard)
  async deleteSavings(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.walletService.deleteSavings(req.user.sub, id);
  }

  // Cron trigger endpoints (should be called by scheduler)
  @Post('savings/cron/flexible')
  async processFlexible() {
    return this.walletService.processFlexibleInterest();
  }

  @Post('savings/cron/fixed')
  async processFixed() {
    return this.walletService.processFixedMaturity();
  }

  // Storage Wallet Endpoints
  @Get('storage')
  @UseGuards(AuthGuard)
  async getStorage(@Request() req: AuthenticatedRequest) {
    return this.walletService.getStorageWallets(req.user.sub);
  }

  @Post('storage')
  @UseGuards(WalletGuard)
  async createStorage(
    @Request() req: AuthenticatedRequest,
    @Body()
    dto: {
      assetSymbol: string;
      quantity: number;
      platform: string;
      note?: string;
    },
  ) {
    return this.walletService.createStorageWallet(req.user.sub, dto);
  }

  @Post('storage/:id/withdraw')
  @UseGuards(WalletGuard)
  async withdrawFromStorage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.walletService.withdrawFromStorage(req.user.sub, id);
  }

  @Post('storage/:id/adjust')
  @UseGuards(WalletGuard)
  async adjustStorage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AdjustStorageWalletDto,
  ) {
    return this.walletService.adjustStorageWallet(req.user.sub, id, dto);
  }

  @Get('storage/:id/history')
  @UseGuards(AuthGuard)
  async getStorageHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.walletService.getStorageHistory(req.user.sub, id);
  }

  @Post('storage/:id/initial')
  @UseGuards(AuthGuard)
  async patchInitialQuantity(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: { initialQuantity: number },
  ) {
    return this.walletService.updateInitialQuantity(
      req.user.sub,
      id,
      dto.initialQuantity,
    );
  }

  @Delete('storage/:id')
  @UseGuards(AuthGuard)
  async deleteStorage(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.walletService.deleteStorageWallet(req.user.sub, id);
  }

  @Delete('storage/history/:id')
  @UseGuards(AuthGuard)
  async deleteHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.walletService.deleteStorageHistory(req.user.sub, id);
  }

  @Patch('storage/history/:id')
  @UseGuards(AuthGuard)
  async updateHistory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: { note?: string; amount?: number },
  ) {
    return this.walletService.updateStorageHistory(req.user.sub, id, dto);
  }

  @Delete('clear-all')
  @UseGuards(AuthGuard)
  async clearAll(@Request() req: AuthenticatedRequest) {
    return this.walletService.clearAllWalletData(req.user.sub);
  }

  @Post('transactions/import')
  @UseGuards(AuthGuard)
  async importTransactions(
    @Request() req: AuthenticatedRequest,
    @Body() dto: { transactions: any[] },
  ) {
    return this.walletService.importTransactions(
      req.user.sub,
      dto.transactions,
    );
  }

  @Post('savings/import')
  @UseGuards(AuthGuard)
  async importSavings(
    @Request() req: AuthenticatedRequest,
    @Body() dto: { savings: any[] },
  ) {
    return this.walletService.importSavings(req.user.sub, dto.savings);
  }

  @Post('storage/import')
  @UseGuards(AuthGuard)
  async importStorage(
    @Request() req: AuthenticatedRequest,
    @Body() dto: { storage: any[] },
  ) {
    return this.walletService.importStorage(req.user.sub, dto.storage);
  }

  @Post('faucet')
  @UseGuards(AuthGuard)
  async faucet(
    @Request() req: AuthenticatedRequest,
    @Body() dto: { assetSymbol: string },
  ) {
    return this.walletService.faucet(req.user.sub, dto.assetSymbol);
  }

  @Post('deposit')
  @UseGuards(AuthGuard)
  async createDeposit(
    @Request() req: AuthenticatedRequest,
    @Body() dto: { amount: number; proofImage: string; note?: string },
  ) {
    return this.walletService.createDeposit(req.user.sub, dto);
  }

  @Get('deposits/pending')
  @UseGuards(AuthGuard)
  async getPendingDeposits() {
    return this.walletService.getPendingDeposits();
  }

  @Post('deposits/:id/approve')
  @UseGuards(AuthGuard)
  async approveDeposit(
    @Param('id') id: string,
    @Body() dto: { adminNote?: string },
  ) {
    return this.walletService.approveDeposit(id, dto.adminNote);
  }

  @Post('deposits/:id/reject')
  @UseGuards(AuthGuard)
  async rejectDeposit(
    @Param('id') id: string,
    @Body() dto: { adminNote?: string },
  ) {
    return this.walletService.rejectDeposit(id, dto.adminNote);
  }
}
