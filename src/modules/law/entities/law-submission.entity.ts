import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { LawApplication } from './law-application.entity';

@Entity('law_submissions')
export class LawSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  applicationId: string;

  @ManyToOne(() => LawApplication)
  @JoinColumn({ name: 'applicationId' })
  application: LawApplication;

  @Column()
  customerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customerId' })
  customer: User;

  @Column({ type: 'json' })
  formData: any;

  @Column({ default: 'pending' })
  status: string; // pending, reviewed, processed, rejected

  @Column({ type: 'text', nullable: true })
  adminNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
