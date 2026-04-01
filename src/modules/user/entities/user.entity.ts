import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../decorators/roles.decorator';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Don't return password by default
  password: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Column({
    type: 'varchar',
    default: 'active',
  })
  status: 'active' | 'suspended';

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  modules: string[];

  @Column({
    type: 'varchar',
    default: 'trial',
  })
  subscriptionPlan: string;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  subscriptionExpiresAt: Date;

  @Column({
    type: 'int',
    default: 0,
  })
  loginCount: number;

  @Column({
    type: 'varchar',
    default: 'en',
  })
  language: 'en' | 'vi';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
