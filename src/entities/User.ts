import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { AchatForfait } from './AchatForfait';
import { Validation } from './Validation';
import { Conversation } from './Conversation';


@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  lastname: string;

  @Column()
  firstname: string;

  @Column()
  tel: string;

  @Column()
  mail: string;

  @Column({ default: 0 })
  balance: number;

  @OneToMany(() => AchatForfait, (achatForfait) => achatForfait.user)
  achatForfaits: AchatForfait[];

  @OneToMany(() => Validation, (validation) => validation.user)
  validations: Validation[];

  @OneToMany(() => Conversation, (conversation) => conversation.user)
  conversations: Conversation[];
}