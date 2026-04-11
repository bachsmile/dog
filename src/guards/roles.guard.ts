import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy danh sách roles yêu cầu từ @Roles() decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Nếu route không khai báo @Roles() → cho phép truy cập
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    const hasRole = user.role === Role.SUPER_ADMIN || requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Yêu cầu quyền: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
