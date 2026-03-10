import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class WalletSecurityDto {
  @IsString()
  @IsNotEmpty()
  assetSymbol: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d+$/, { message: 'Mật mã phải có 6 chữ số' })
  password: string;
}
