import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('validations')
export class Validation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  creation: Date;

  @Column({ type: 'timestamp' })
  expiration: Date;

  @Column()
  code: string;

  @Column({ default: false })
  statut: boolean;

  @ManyToOne(() => User, (user) => user.validations)
  @JoinColumn({ name: 'user_id' })
  user: User;
}