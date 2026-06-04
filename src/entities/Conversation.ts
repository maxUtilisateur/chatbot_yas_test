import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Relation,
} from 'typeorm';
import { User } from './User.js';
import { Message } from './Message.js';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'timestamp' })
  dateDebut!: Date;

  @Column({ type: 'timestamp' })
  dateFin!: Date;

  @Column({ default: false })
  statut!: boolean;

  @Column({ nullable: true, default: 'START' })
  step!: string;

  @Column({ type: 'text', nullable: true })
  tempData!: string;

  @ManyToOne(() => User, (user) => user.conversations) 
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @OneToMany(() => Message, (message) => message.conversation) 
  messages!: Relation<Message>[];
}
