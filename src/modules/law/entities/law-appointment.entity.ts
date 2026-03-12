import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Lawyer } from './lawyer.entity';

@Entity('law_appointments')
export class LawAppointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column()
  lawyerId: string;

  @ManyToOne(() => Lawyer)
  @JoinColumn({ name: 'lawyerId' })
  lawyer: Lawyer;

  @Column()
  date: string; // YYYY-MM-DD

  @Column({ type: 'simple-array', nullable: true })
  hours: number[]; // Array of hours [8, 9, 10]

  @Column({ nullable: true })
  specialty: string;

  @Column({ default: 'pending' })
  status: string; // pending, confirmed, completed, cancelled

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
