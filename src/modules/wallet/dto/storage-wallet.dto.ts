import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStorageWalletDto {
  @IsString()
  assetSymbol: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  platform: string;

  @IsString()
  @IsOptional()
  note?: string;
}
