import { Role } from '../../../decorators/roles.decorator';

export class CreateUserDto {
  email: string;
  password?: string;
  role?: Role;
  username?: string;
  status?: 'active' | 'suspended';
  modules?: string[];
  subscriptionPlan?: string;
  subscriptionExpiresAt?: Date;
  language?: 'en' | 'vi';
}
