import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Validation } from '../entities/Validation.js';

export class MailService {

    private transporter: nodemailer.Transporter;

    constructor() {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
        const secure = port === 465;

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            family: 4, // Force IPv4 pour éviter les erreurs ENETUNREACH sur Render / environnements sans IPv6
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
        } as any);
    }

    public async sendValidationEmail(validation: Validation): Promise<void> {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to: validation.user.mail,
            subject: 'Code de validation OTP - Yas Simul',
            text: `Votre code de validation est : ${validation.code}`
        };
        await this.transporter.sendMail(mailOptions);
    }
}



