import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TransactionType } from '../entities/wallet-transaction.entity';

export class CreateTransactionDto {
  @IsString()
  assetSymbol: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  total?: number;

  @IsNumber()
  @IsOptional()
  avgBuyPriceAtTime?: number;

  @IsNumber()
  @IsOptional()
  profitAmount?: number;

  @IsString()
  @IsOptional()
  source?: string;
}

export class UpdateTransactionDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  quantity?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  total?: number;
}
