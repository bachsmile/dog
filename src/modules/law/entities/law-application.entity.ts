import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('law_applications')
export class LawApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ nullable: true })
  type: string; // e.g., 'Complaint', 'Petition', 'Contract'

  @Column({ type: 'json', nullable: true })
  config: any; // Store fields to be filled

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
