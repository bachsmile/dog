import { Role } from '../../../decorators/roles.decorator';

export class RegisterDto {
  email: string;
  password: string;
  username?: string;
  role?: Role;
  status?: 'active' | 'suspended';
  modules?: string[];
  adminCode?: string;
}
