import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.js';
import { Forfait } from './Forfait.js';

@Entity('achat_forfaits')
export class AchatForfait {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'timestamp' })
  dateAchat!: Date;

  @Column()
  montant!: number;

  @Column({ default: false })
  statut!: boolean;

  @Column({ nullable: true })
  referenceTransaction!: string;

  @ManyToOne(() => User, (user) => user.achatForfaits) 
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Forfait, (forfait) => forfait.achatForfaits) 
  @JoinColumn({ name: 'forfait_id' })
  forfait!: Forfait;

  confirmerAchat(): void {
    this.statut = true;
  }

  annulerAchat(): void {
    this.statut = false;
  }
}
