import { IsNumber, IsEnum, IsOptional, IsString } from 'class-validator';
import { StorageAdjustmentType } from '../entities/storage-history.entity';

export class AdjustStorageWalletDto {
  @IsEnum(StorageAdjustmentType)
  type: StorageAdjustmentType;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
