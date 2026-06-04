import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Relation,
} from 'typeorm';
import { AchatForfait } from './AchatForfait.js';
import { Validation } from './Validation.js';
import { Conversation } from './Conversation.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  user_id!: number;

  @Column()
  lastname!: string;

  @Column()
  firstname!: string;

  @Column()
  tel!: string;

  @Column()
  mail!: string;

  @Column({ default: 0 })
  balance!: number;

  @OneToMany(() => AchatForfait, (achatForfait) => achatForfait.user) 
  achatForfaits!: Relation<AchatForfait>[];

  @OneToMany(() => Validation, (validation) => validation.user) 
  validations!: Relation<Validation>[];

  @OneToMany(() => Conversation, (conversation) => conversation.user) 
  conversations!: Relation<Conversation>[];
}
