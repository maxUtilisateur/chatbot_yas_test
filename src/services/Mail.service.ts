import 'dotenv/config';
import nodemailer from 'nodemailer';
import { Validation } from '../entities/Validation.js';

export class MailService {

    private transporter: nodemailer.Transporter;

    constructor() {
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        // On utilise le service 'gmail' intégré de Nodemailer qui gère
        // automatiquement host, port, SSL et force IPv4 — évite ENETUNREACH sur Render
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass },
        });
    }

    public async sendValidationEmail(validation: Validation): Promise<void> {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.SMTP_USER,
            to: validation.user.mail,
            subject: 'Code de validation OTP - Yas Simul',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #1a73e8;">Yas Simul — Validation de compte</h2>
                    <p>Bonjour <strong>${validation.user.firstname} ${validation.user.lastname}</strong>,</p>
                    <p>Votre code de validation OTP est :</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a73e8; text-align: center; padding: 16px; background: #f1f8ff; border-radius: 6px; margin: 16px 0;">
                        ${validation.code}
                    </div>
                    <p style="color: #666; font-size: 13px;">Ce code est valable pendant <strong>5 minutes</strong>. Ne le partagez avec personne.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #999;">Si vous n'avez pas demandé ce code, ignorez cet e-mail.</p>
                </div>
            `,
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[Mail] OTP envoyé à ${validation.user.mail} — MessageId: ${info.messageId}`);
    }
}
