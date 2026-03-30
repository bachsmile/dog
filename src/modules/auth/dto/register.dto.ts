import { Role } from '../../../decorators/roles.decorator';

export class RegisterDto {
  email: string;
  password: string;
  displayName?: string;
  role?: Role;
  status?: 'active' | 'suspended';
  modules?: string[];
}
