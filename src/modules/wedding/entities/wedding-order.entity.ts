import {
  Entity,
  Column,
  PrimaryColumn,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ulid } from 'ulid';
import { User } from '../../user/entities/user.entity';

@Entity('wedding_orders')
export class WeddingOrder {
  @PrimaryColumn({ length: 255 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = ulid();
    }
  }

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  parentAdminId: string; 

  @Column({ nullable: true })
  templateId: string; 

  @Column({ type: 'text', nullable: true })
  customTemplateDesc: string; 

  @Column({ nullable: true })
  planId: string;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  serviceFee: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  // 'auto' | 'static'
  @Column({ nullable: true })
  deliveryType: string;

  @Column({ type: 'json', nullable: true })
  weddingData: any; 

  @Column({ type: 'json', nullable: true })
  guestList: any[]; 

  // Payment receipt image URL
  @Column({ type: 'text', nullable: true })
  paymentReceipt: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
