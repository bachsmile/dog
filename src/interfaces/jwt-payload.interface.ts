import { Role } from '../decorators/roles.decorator';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: Role;
  iat?: number; // Issued at
  exp?: number; // Expiration
}
