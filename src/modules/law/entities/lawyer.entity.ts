import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('lawyers')
export class Lawyer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  specialty: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'float', default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  reviewsCount: number;

  @Column({ default: false })
  isVerified: boolean;

  /**
   * Compact busy schedule storage
   * Format: Array of "YYYY-MM-DD-[hour1,hour2,...]"
   * Example: ["2022-12-12-[8,9,14,15]", "2022-12-13-[10,11]"]
   */
  @Column({ type: 'simple-array', nullable: true })
  busySchedule: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
