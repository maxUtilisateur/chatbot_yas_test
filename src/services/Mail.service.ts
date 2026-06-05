import 'dotenv/config';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { Validation } from '../entities/Validation.js';

// Force l'utilisation d'IPv4
dns.setDefaultResultOrder('ipv4first');

export class MailService {

    private transporter: nodemailer.Transporter;

    constructor() {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = process.env.SMTP_PORT
            ? parseInt(process.env.SMTP_PORT, 10)
            : 465;

        const secure = port === 465;

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
        });

        // Test de connexion SMTP
        this.transporter.verify()
            .then(() => {
                console.log('Connexion SMTP Gmail réussie');
            })
            .catch((error) => {
                console.error('Erreur connexion SMTP :', error);
            });
    }

    public async sendValidationEmail(validation: Validation): Promise<void> {

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to: validation.user.mail,
            subject: 'Code de validation OTP - Yas Simul',
            text: `Votre code de validation est : ${validation.code}`
        };

        try {

            const info = await this.transporter.sendMail(mailOptions);

            console.log('Email OTP envoyé');
            console.log('Message ID :', info.messageId);

        } catch (error) {

            console.error('Erreur lors de l’envoi de l’email OTP :', error);
            throw error;

        }
    }
}