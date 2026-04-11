import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  RECEIVE = 'receive',
  LOAN = 'loan',
  STAKING = 'staking',
  UNSTAKING = 'unstaking',
  SWAP = 'swap',
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  assetSymbol: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column('decimal', { precision: 20, scale: 8 })
  quantity: number;

  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  price: number;

  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  total: number;

  @Column({ default: 'completed' })
  status: string;

  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  avgBuyPriceAtTime: number;

  @Column('decimal', { precision: 20, scale: 2, nullable: true })
  profitAmount: number;

  @Column({ nullable: true })
  source: string;

  @Column({ nullable: true })
  contractCode: string;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  remainingQuantity: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  stakedQuantity: number;

  @Column('simple-json', { nullable: true })
  lotWithdrawals: any;

  @CreateDateColumn()
  timestamp: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
