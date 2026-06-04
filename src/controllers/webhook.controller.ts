import { Request, Response } from 'express';
import { ChatbotService } from '../services/Chatbot.service.js';

export const verifyWebhook = (req: Request, res: Response): Response => {
  const verify_token = process.env.VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('Webhook vérifié');
      return res.status(200).send(challenge);
    }
  }

  return res.sendStatus(403);
};

export const receiveMessage = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body;

  // On renvoie immédiatement 200 à WhatsApp pour accuser réception
  res.status(200).send('EVENT_RECEIVED');

  // Traitement asynchrone pour ne pas bloquer WhatsApp (qui exige une réponse en < 3 secondes)
  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (message) {
      const from = message.from;
      let text = '';
      let interactiveData: any = undefined;

      if (message.type === 'text') {
        text = message.text?.body || '';
      } else if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          const btn = interactive.button_reply;
          text = btn.title || '';
          interactiveData = {
            id: btn.id,
            title: btn.title,
            type: 'button_reply',
          };
        } else if (interactive.type === 'list_reply') {
          const list = interactive.list_reply;
          text = list.title || '';
          interactiveData = {
            id: list.id,
            title: list.title,
            description: list.description,
            type: 'list_reply',
          };
        }
      }

      if (text || interactiveData) {
        try {
          const chatbotService = new ChatbotService();
          await chatbotService.handleMessage(from, text, interactiveData);
        } catch (error) {
          console.error('Erreur lors du traitement du message par le Chatbot:', error);
        }
      }
    }
  }

  return res;
};
