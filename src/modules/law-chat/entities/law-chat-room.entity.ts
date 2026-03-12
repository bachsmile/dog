import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class LawChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomId: string;

  @Column()
  customerId: string;

  @Column({ nullable: true })
  lawyerId: string;

  @Column({ type: 'json', nullable: true })
  customerInfo: any;

  @Column({ default: 'waiting' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
