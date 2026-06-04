import 'dotenv/config';
import { AppDataSource } from '../config/data_source.js';
import { User } from '../entities/User.js';
import { Validation } from '../entities/Validation.js';


export class ValidationService {

    public async createValidation(user: User): Promise<string> {
        const code = this.genererOTP();
        const validation = new Validation();
        validation.user = user;
        validation.code = code;
        validation.creation = new Date();
        validation.expiration = new Date(Date.now() + 5 * 60 * 1000);
        validation.statut = false;

        await AppDataSource.getRepository(Validation).save(validation);

        return validation.code;
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