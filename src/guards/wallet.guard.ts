import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class WalletGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const walletToken = request.headers['x-wallet-token'] as string;

    if (!walletToken) {
      throw new UnauthorizedException('Thiếu mã bảo mật ví (Wallet Token)');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        userId: string;
        assetSymbol: string;
        type: string;
      }>(walletToken);

      // Kiểm tra loại token
      if (payload.type !== 'wallet_unlock') {
        throw new UnauthorizedException('Mã bảo mật ví không đúng loại');
      }

      // Kiểm tra xem token này có dành cho tài khoản hiện đang đăng nhập không
      const user = request['user'] as { sub: string } | undefined;
      if (user && payload.userId !== user.sub) {
        throw new UnauthorizedException('Mã bảo mật ví không thuộc về bạn');
      }

      const body = request.body as Record<string, any>;
      const assetSymbol = (request.params.assetSymbol || body?.assetSymbol) as
        | string
        | undefined;

      if (assetSymbol && payload.assetSymbol !== assetSymbol) {
        throw new UnauthorizedException(
          `Mã bảo mật này dành cho ${payload.assetSymbol}, không phải ${assetSymbol}`,
        );
      }

      // Gắn payload ví vào request
      request['wallet_info'] = payload;

      return true;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const jwtError = err as { name?: string };
      if (jwtError.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Mã bảo mật ví đã hết hạn');
      }
      throw new UnauthorizedException('Mã bảo mật ví không hợp lệ');
    }
  }
}
