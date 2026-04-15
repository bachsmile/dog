import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ulid } from 'ulid';
import { Role } from '../../../decorators/roles.decorator';

@Entity('users')
export class User {
  @PrimaryColumn({ length: 255 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = ulid();
    }
  }

  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // Don't return password by default
  password: string;

  @Column({ unique: true, nullable: true })
  username: string;

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

  @Column({
    type: 'varchar',
    nullable: true,
  })
  createdBy: string; // The ID of the admin/superadmin who created this user

  @Column({
    type: 'varchar',
    nullable: true,
  })
  managedById: string; // The ID of the admin managing this specific user

  @Column({
    type: 'varchar',
    nullable: true,
  })
  walletAddress: string;

  @Column({
    type: 'boolean',
    default: false,
  })
  walletActivated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
