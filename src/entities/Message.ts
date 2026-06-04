import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { Conversation } from './Conversation.js';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  contenu!: string;

  @Column({ type: 'timestamp' })
  dateEnvoi!: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages) // ✅ fonction de rappel
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Relation<Conversation>;
}
