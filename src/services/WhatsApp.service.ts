import axios from 'axios';
import 'dotenv/config';

export class WhatsAppService {
  private token: string;
  private phoneNumberId: string;
  private apiUrl: string;

  constructor() {
    this.token = process.env.TOKEN ?? '';
    this.phoneNumberId = process.env.PHONE_NUMBER_ID ?? '';
    this.apiUrl = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
  }

  private async postRequest(data: any): Promise<any> {
    console.log('\n--- MESSAGE ENVOYÉ SUR WHATSAPP ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('-----------------------------------\n');

    if (!this.token || !this.phoneNumberId) {
      console.error('WhatsApp Credentials manquants dans le fichier .env');
      return;
    }

    try {
      const response = await axios.post(this.apiUrl, data, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error(
        'Erreur lors de l\'envoi du message WhatsApp:',
        error.response ? JSON.stringify(error.response.data) : error.message
      );
      throw error;
    }
  }

  /**
   * Envoie un message texte simple
   */
  public async sendTextMessage(to: string, text: string): Promise<any> {
    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };
    return this.postRequest(data);
  }

  /**
   * Envoie un message interactif avec des boutons de réponse rapide (max 3 boutons)
   */
  public async sendReplyButtons(
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    headerText?: string,
    footerText?: string
  ): Promise<any> {
    const formattedButtons = buttons.map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title.substring(0, 20), // Limite imposée par WhatsApp (20 caractères)
      },
    }));

    const data: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: formattedButtons,
        },
      },
    };

    if (headerText) {
      data.interactive.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      data.interactive.footer = {
        text: footerText,
      };
    }

    return this.postRequest(data);
  }

  /**
   * Envoie un message de liste déroulante interactive (max 10 éléments)
   */
  public async sendListMessage(
    to: string,
    bodyText: string,
    buttonLabel: string,
    sections: {
      title: string;
      rows: { id: string; title: string; description?: string }[];
    }[],
    headerText?: string,
    footerText?: string
  ): Promise<any> {
    const formattedSections = sections.map((sec) => ({
      title: sec.title.substring(0, 24), // Limite WhatsApp (24 caractères)
      rows: sec.rows.map((row) => ({
        id: row.id,
        title: row.title.substring(0, 24), // Limite WhatsApp (24 caractères)
        description: row.description ? row.description.substring(0, 72) : undefined, // Limite WhatsApp (72 caractères)
      })),
    }));

    const data: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText,
        },
        action: {
          button: buttonLabel.substring(0, 20), // Limite WhatsApp (20 caractères)
          sections: formattedSections,
        },
      },
    };

    if (headerText) {
      data.interactive.header = {
        type: 'text',
        text: headerText,
      };
    }

    if (footerText) {
      data.interactive.footer = {
        text: footerText,
      };
    }

    return this.postRequest(data);
  }
}
