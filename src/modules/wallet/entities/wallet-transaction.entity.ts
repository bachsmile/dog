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
}

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  walletId: string;

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

  @CreateDateColumn()
  timestamp: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
