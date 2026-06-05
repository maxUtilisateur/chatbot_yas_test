import 'dotenv/config';
import { AppDataSource } from '../config/data_source.js';
import { User } from '../entities/User.js';
import { Validation } from '../entities/Validation.js';


export class ValidationService {

    /**
     * Crée et sauvegarde un nouveau code OTP pour l'utilisateur.
     * Retourne l'objet Validation complet (avec la relation user chargée)
     * pour pouvoir envoyer le mail directement sans 2ème requête DB.
     */
    public async createValidation(user: User): Promise<Validation> {
        const code = this.genererOTP();
        const validation = new Validation();
        validation.user = user;
        validation.code = code;
        validation.creation = new Date();
        // 15 minutes — le mail peut prendre du temps (spam, latence)
        validation.expiration = new Date(Date.now() + 15 * 60 * 1000);
        validation.statut = false;

        await AppDataSource.getRepository(Validation).save(validation);

        return validation;
    }

    public async readByCode(code: string): Promise<Validation> {
        const validation = await AppDataSource.getRepository(Validation).findOne({ 
            where: { code }, 
            relations: { user: true }
        });
        if (!validation) {
            throw new Error('Validation non trouvée');
        }
        return validation;
    }

    private genererOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

}
