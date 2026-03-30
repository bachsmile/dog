import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_configs')
export class SystemConfig {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
