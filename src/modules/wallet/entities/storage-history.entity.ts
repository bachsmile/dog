import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { StorageWallet } from './storage-wallet.entity';

export enum StorageAdjustmentType {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
}

@Entity('storage_histories')
export class StorageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storageWalletId: string;

  @ManyToOne(() => StorageWallet, { onDelete: 'CASCADE' })
  storageWallet: StorageWallet;

  @Column({
    type: 'enum',
    enum: StorageAdjustmentType,
  })
  type: StorageAdjustmentType;

  @Column('decimal', { precision: 20, scale: 8 })
  amount: number;

  @Column('decimal', { precision: 20, scale: 8 })
  balanceAfter: number;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
