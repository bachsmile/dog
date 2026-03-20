import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { StorageHistory } from './storage-history.entity';

export enum StorageWalletStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Entity('storage_wallets')
export class StorageWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  assetSymbol: string;

  @Column('decimal', { precision: 20, scale: 8, default: 0 })
  initialQuantity: number;

  @Column('decimal', { precision: 20, scale: 8 })
  quantity: number;

  @Column()
  platform: string;

  @Column({
    type: 'enum',
    enum: StorageWalletStatus,
    default: StorageWalletStatus.ACTIVE,
  })
  status: StorageWalletStatus;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => StorageHistory, (history) => history.storageWallet)
  history: StorageHistory[];
}
