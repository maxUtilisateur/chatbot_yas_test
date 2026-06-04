import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Relation,
} from 'typeorm';
import { AchatForfait } from './AchatForfait.js';

@Entity('forfaits')
export class Forfait {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  prix!: number;

  @Column()
  voix!: number;

  @Column()
  sms!: number;

  @Column()
  internet!: number;

  @Column()
  validite!: number;

  @Column()
  categorie!: string;

  @Column({ default: false })
  actif!: boolean;

  @OneToMany(() => AchatForfait, (achatForfait) => achatForfait.forfait)
  achatForfaits!: Relation<AchatForfait>[];
}
