import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum SavingsStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SavingsType {
  FLEXIBLE = 'flexible',
  FIXED = 'fixed',
}

@Entity('wallet_savings')
export class WalletSavings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  assetSymbol: string;

  @Column('decimal', { precision: 20, scale: 8 })
  quantity: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  accruedInterest: number; // Tổng lãi đã cộng dồn

  @Column()
  platform: string;

  @Column('decimal', { precision: 5, scale: 2 })
  annualRate: number;

  @Column({
    type: 'enum',
    enum: SavingsType,
    default: SavingsType.FLEXIBLE,
  })
  savingsType: SavingsType;

  @Column({ nullable: true })
  durationDays: number; // Chỉ dùng cho Fixed

  @Column({
    type: 'enum',
    enum: SavingsStatus,
    default: SavingsStatus.ACTIVE,
  })
  status: SavingsStatus;

  @Column({ nullable: true })
  note: string;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  lastDailyInterest: number; // Lãi nhận được gần nhất

  @Column({ nullable: true, type: 'timestamp' })
  lastInterestDate: Date; // Lần cuối cộng lãi

  @CreateDateColumn()
  startDate: Date;

  @Column({ nullable: true, type: 'timestamp' })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
