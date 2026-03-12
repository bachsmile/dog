import { Role } from '../../../decorators/roles.decorator';

export class CreateUserDto {
  email: string;
  password?: string;
  role?: Role;
  displayName?: string;
  status?: 'active' | 'suspended';
}
