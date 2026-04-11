import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private readonly PLAN_LEVELS: Record<string, number> = {
    '1_month': 1,
    '1_year': 2,
    permanent: 3,
  };

  async create(createUserDto: CreateUserDto) {
    // 1. Hash password if present
    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    }

    // 2. Validate against Manager (if applicable)
    if (createUserDto.managedById) {
      const manager = await this.userRepository.findOneBy({
        id: createUserDto.managedById,
      });

      if (!manager) {
        throw new NotFoundException('Quản lý của tài khoản này không tồn tại.');
      }

      // Check Plan Rank
      const managerPlanKey = (manager.subscriptionPlan || '1_month').toLowerCase();
      const subUserPlanKey = (createUserDto.subscriptionPlan || '1_month').toLowerCase();
      
      const managerPlanLevel = this.PLAN_LEVELS[managerPlanKey] || 1;
      const subUserPlanLevel = this.PLAN_LEVELS[subUserPlanKey] || 1;

      if (subUserPlanLevel > managerPlanLevel) {
        throw new Error(
          `Gói dịch vụ của tài khoản con (${createUserDto.subscriptionPlan}) không được cao hơn Admin quản lý (${manager.subscriptionPlan}).`,
        );
      }

      // Check Expiry Date
      if (
        manager.subscriptionExpiresAt &&
        createUserDto.subscriptionExpiresAt
      ) {
        const managerExpiry = new Date(manager.subscriptionExpiresAt).getTime();
        const subUserExpiry = new Date(
          createUserDto.subscriptionExpiresAt,
        ).getTime();

        if (subUserExpiry > managerExpiry) {
          throw new Error(
            `Thời hạn tài khoản con không được vượt quá thời hạn của Admin (${new Date(manager.subscriptionExpiresAt).toLocaleDateString()}).`,
          );
        }
      }

      // Check Quota
      const currentSubUsersCount = await this.userRepository.countBy({
        managedById: manager.id,
      });
      if (currentSubUsersCount >= (manager.userQuota || 0)) {
        throw new Error(
          `Tổ chức này đã đạt giới hạn số lượng tài khoản (${manager.userQuota}).`,
        );
      }
    }

    const newUser = this.userRepository.create(createUserDto);
    return await this.userRepository.save(newUser);
  }

  async findAll() {
    return await this.userRepository.find();
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = Object.assign(user, updateUserDto);
    return await this.userRepository.save(updatedUser);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return await this.userRepository.remove(user);
  }
}
