import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('law_questions')
export class LawQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: 'Pending' }) // Pending, Answered, Rejected
  status: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: false })
  customer: User;

  @ManyToOne(() => User, { nullable: true })
  answeredBy: User;

  @Column({ nullable: true })
  answeredAt: Date;
}
