import { SetMetadata } from '@nestjs/common';

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MANAGER = 'manager',
  GUEST = 'guest',
  LAWYER = 'lawyer',
  SUPER_ADMIN = 'super_admin',
}

export const ROLES_KEY = 'roles';

/**
 * Decorator khai báo các role được phép truy cập route.
 * Sử dụng: @Roles(Role.ADMIN, Role.MODERATOR) trước controller method.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
