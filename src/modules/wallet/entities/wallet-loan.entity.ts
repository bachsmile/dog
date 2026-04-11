import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum LoanStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

@Entity('wallet_loans')
export class WalletLoan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  assetSymbol: string;

  @Column()
  borrower: string;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column({ default: false })
  hasInterest: boolean;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  interestRate: number;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  collected: number;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Column({ nullable: true })
  originalTransactionId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
