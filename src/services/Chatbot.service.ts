import { AppDataSource } from "../config/data_source.js";
import { AchatForfait } from "../entities/AchatForfait.js";
import { Conversation } from "../entities/Conversation.js";
import { Forfait } from "../entities/Forfait.js";
import { Message } from "../entities/Message.js";
import { User } from "../entities/User.js";
import { Validation } from "../entities/Validation.js";
import { MailService } from "./Mail.service.js";
import { ValidationService } from "./Validation.service.js";
import { WhatsAppService } from "./WhatsApp.service.js";


export class ChatbotService {
  private validationService: ValidationService;
  private mailService: MailService;
  private whatsAppService: WhatsAppService;

  constructor() {
    this.validationService = new ValidationService();
    this.mailService = new MailService();
    this.whatsAppService = new WhatsAppService();
  }

  /**
   * Normalise un numéro de téléphone pour la comparaison (garde les chiffres et compare les derniers chiffres)
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Enregistre un message dans la base de données
   */
  private async saveMessage(conversation: Conversation, content: string): Promise<Message> {
    const msgRepo = AppDataSource.getRepository(Message);
    const msg = new Message();
    msg.conversation = conversation;
    msg.contenu = content;
    msg.dateEnvoi = new Date();
    return msgRepo.save(msg);
  }

  /**
   * Envoie le menu principal interactif à l'utilisateur
   */
  private async sendMainMenu(to: string, user: User, isFirstTime: boolean = false): Promise<string> {
    const prefix = isFirstTime ? 'Validation réussie ! ' : '';
    const bodyText = `${prefix}Bonjour *${user.firstname} ${user.lastname}*, quelle opération voulez-vous effectuer ?`;

    const sections = [
      {
        title: 'Menu Principal',
        rows: [
          {
            id: 'menu_solde',
            title: 'Consulter solde',
            description: 'Solde crédit et solde forfait',
          },
          {
            id: 'menu_recharge',
            title: 'Recharger crédit',
            description: 'Pour soi ou pour autrui',
          },
          {
            id: 'menu_transfert',
            title: 'Transfert de crédit',
            description: 'Envoyer du crédit à un tiers',
          },
          {
            id: 'menu_forfaits',
            title: 'Acheter forfait',
            description: 'Forfaits internet, voix ou mixte',
          },
          {
            id: 'menu_fibre',
            title: 'Abonnement Fibre',
            description: 'Payer votre abonnement fibre',
          },
        ],
      },
    ];

    await this.whatsAppService.sendListMessage(
      to,
      bodyText,
      'Choisir une option',
      sections,
      'YAS SIMUL BOT',
      'Sélectionnez une option ci-dessus'
    );

    return bodyText;
  }

  /**
   * Envoie une page paginée de forfaits pour une catégorie donnée
   */
  private async sendForfaitPage(
    to: string,
    category: string,
    page: number,
    userBalance: number
  ): Promise<string> {
    const forfaitRepo = AppDataSource.getRepository(Forfait);

    // Récupérer tous les forfaits de la catégorie choisis triés par prix croissant
    const forfaits = await forfaitRepo.find({
      where: { categorie: category, actif: true },
      order: { prix: 'ASC' },
    });

    if (forfaits.length === 0) {
      const errorMsg = `Aucun forfait actif n'est disponible dans la catégorie *${category}* actuellement.`;
      await this.whatsAppService.sendTextMessage(to, errorMsg);
      return errorMsg;
    }

    const PAGE_SIZE = 6;
    const totalItems = forfaits.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);

    // S'assurer que la page demandée est valide
    const currentPage = Math.max(1, Math.min(page, totalPages));

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
    const pageItems = forfaits.slice(startIndex, endIndex);

    const rows = pageItems.map((f) => {
      let desc = `${f.prix} FCFA`;
      const descParts = [];
      if (f.voix > 0) descParts.push(`Voix: ${f.voix}m`);
      if (f.sms > 0) descParts.push(`SMS: ${f.sms}`);
      if (f.internet > 0) descParts.push(`Net: ${f.internet} Mo`);

      if (descParts.length > 0) {
        desc += ` (${descParts.join(', ')})`;
      }
      return {
        id: `buy_forfait_${f.id}`,
        title: f.name,
        description: desc,
      };
    });

    // Option Page Suivante
    if (currentPage < totalPages) {
      rows.push({
        id: 'next_page',
        title: 'Voir plus >>',
        description: `Afficher la page suivante (${currentPage + 1}/${totalPages})`,
      });
    }

    // Option Page Précédente
    if (currentPage > 1) {
      rows.push({
        id: 'prev_page',
        title: '<< Page précédente',
        description: `Afficher la page précédente (${currentPage - 1}/${totalPages})`,
      });
    }

    // Option Retour aux catégories
    rows.push({
      id: 'back_categories',
      title: 'Retour aux catégories',
      description: 'Choisir une autre durée de validité',
    });

    const bodyText = `Sélectionnez le forfait *${category}* (Page ${currentPage}/${totalPages}) :`;

    await this.whatsAppService.sendListMessage(
      to,
      bodyText,
      'Choisir un forfait',
      [
        {
          title: `Forfaits ${category}`,
          rows,
        },
      ],
      'Achat Forfait',
      `Votre solde : ${userBalance} FCFA`
    );

    return bodyText;
  }

  /**
   * Traite les messages entrants
   */
  public async handleMessage(
    from: string,
    text: string,
    interactiveData?: { id: string; title: string; type: 'button_reply' | 'list_reply' }
  ): Promise<void> {
    const normalizedFrom = this.normalizePhone(from);
    const userRepo = AppDataSource.getRepository(User);
    const convoRepo = AppDataSource.getRepository(Conversation);

    // 1. Recherche de l'utilisateur par numéro de téléphone
    const allUsers = await userRepo.find();
    const user = allUsers.find((u) => {
      const uTel = this.normalizePhone(u.tel);
      return uTel === normalizedFrom || uTel.endsWith(normalizedFrom) || normalizedFrom.endsWith(uTel);
    });

    if (!user) {
      console.log(`Utilisateur non trouvé pour le numéro: ${from}`);
      await this.whatsAppService.sendTextMessage(
        from,
        `Désolé, le numéro de téléphone *${from}* n'est pas enregistré dans notre base de données. Veuillez contacter le support pour créer un compte.`
      );
      return;
    }

    // 2. Recherche ou création de la conversation en cours
    let conversation = await convoRepo.findOne({
      where: { user: { id: user.id } },
      order: { dateDebut: 'DESC' },
    });

    const now = new Date();
    let requiresOTP = false;

    // Analyse si une validation OTP est nécessaire
    if (!conversation) {
      requiresOTP = true;
    } else {
      // Recherche du dernier message pour la règle des 24 heures
      const msgRepo = AppDataSource.getRepository(Message);
      const lastMsg = await msgRepo.findOne({
        where: { conversation: { id: conversation.id } },
        order: { dateEnvoi: 'DESC' },
      });

      if (!lastMsg) {
        requiresOTP = true;
      } else {
        const diffMs = now.getTime() - lastMsg.dateEnvoi.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours >= 24) {
          requiresOTP = true;
        } else if (!conversation.statut && conversation.step !== 'AWAITING_OTP') {
          requiresOTP = true;
        }
      }
    }

    // Commande globale "retour" ou "menu" pour réinitialiser
    const cleanText = text.trim().toLowerCase();
    if ((cleanText === 'retour' || cleanText === 'menu') && conversation && conversation.statut) {
      conversation.step = 'MAIN_MENU';
      conversation.tempData = '';
      await convoRepo.save(conversation);
      await this.saveMessage(conversation, text);
      const responseText = await this.sendMainMenu(from, user);
      await this.saveMessage(conversation, `[BOT] ${responseText}`);
      return;
    }

    // Déclenchement de l'envoi d'OTP si nécessaire
    if (requiresOTP) {
      // Création d'une nouvelle conversation en mode attente OTP
      conversation = new Conversation();
      conversation.user = user;
      conversation.dateDebut = now;
      conversation.dateFin = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      conversation.statut = false;
      conversation.step = 'AWAITING_OTP';
      await convoRepo.save(conversation);

      await this.saveMessage(conversation, text);

      // Génération et envoi de l'OTP
      const codeOtp = await this.validationService.createValidation(user);
      const validationRepo = AppDataSource.getRepository(Validation);
      const validation = await validationRepo.findOne({
        where: { code: codeOtp, user: { id: user.id } },
        order: { creation: 'DESC' },
        relations: { user: true },
      });

      if (validation) {
        try {
          await this.mailService.sendValidationEmail(validation);
          console.log(`Email OTP envoyé à ${user.mail}`);
        } catch (mailError) {
          console.error('Erreur lors de l\'envoi de l\'email OTP:', mailError);
        }
      }

      const botMessage = `Bonjour *${user.firstname} ${user.lastname}* !\n\nPour sécuriser votre accès à Yas Simul, un code de validation OTP à 6 chiffres a été envoyé à votre adresse e-mail : *${user.mail}*.\n\nVeuillez saisir le code reçu ici pour continuer.`;
      const buttons = [
        { id: 'resend_otp', title: 'Renvoyer le code' }
      ];
      await this.whatsAppService.sendReplyButtons(from, botMessage, buttons, 'Validation OTP');
      await this.saveMessage(conversation, `[BOT] ${botMessage}`);
      return;
    }

    // Si on a une conversation valide, on enregistre le message de l'utilisateur
    await this.saveMessage(conversation!, text);

    // 3. Machine à états
    switch (conversation!.step) {
      case 'AWAITING_OTP': {
        const codeTrimmed = text.trim();
        const selection = interactiveData?.id || cleanText;

        // Si l'utilisateur demande le renvoi du code
        if (selection === 'resend_otp' || cleanText === 'renvoyer' || cleanText === 'renvoyer le code') {
          // Génération et envoi de l'OTP
          const codeOtp = await this.validationService.createValidation(user);
          const validationRepo = AppDataSource.getRepository(Validation);
          const validation = await validationRepo.findOne({
            where: { code: codeOtp, user: { id: user.id } },
            order: { creation: 'DESC' },
            relations: { user: true },
          });

          if (validation) {
            try {
              await this.mailService.sendValidationEmail(validation);
              console.log(`Email OTP renvoyé à ${user.mail}`);
            } catch (mailError) {
              console.error('Erreur lors du renvoi de l\'email OTP:', mailError);
            }
          }

          const botMessage = `Un nouveau code de validation OTP a été envoyé à votre adresse e-mail : *${user.mail}*.\n\nVeuillez le saisir ci-dessous pour continuer.`;
          const buttons = [
            { id: 'resend_otp', title: 'Renvoyer le code' }
          ];
          await this.whatsAppService.sendReplyButtons(from, botMessage, buttons, 'Validation OTP');
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
          break;
        }

        const validationRepo = AppDataSource.getRepository(Validation);

        // Recherche du code OTP non utilisé pour cet utilisateur
        const validation = await validationRepo.findOne({
          where: { code: codeTrimmed, user: { id: user.id }, statut: false },
          order: { creation: 'DESC' },
        });

        if (validation && validation.expiration.getTime() > now.getTime()) {
          // Marquer l'OTP comme utilisé et valider la session
          validation.statut = true;
          await validationRepo.save(validation);

          conversation!.statut = true;
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);

          const responseText = await this.sendMainMenu(from, user, true);
          await this.saveMessage(conversation!, `[BOT] ${responseText}`);
        } else {
          const botMessage = `Code OTP incorrect, expiré ou déjà utilisé. Si vous ne l'avez pas reçu, vous pouvez cliquer sur "Renvoyer le code" ci-dessous.`;
          const buttons = [
            { id: 'resend_otp', title: 'Renvoyer le code' }
          ];
          await this.whatsAppService.sendReplyButtons(from, botMessage, buttons, 'Code invalide');
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        }
        break;
      }

      case 'MAIN_MENU': {
        const selection = interactiveData?.id || cleanText;

        if (selection === 'menu_solde') {
          conversation!.step = 'SOLDE_MENU';
          await convoRepo.save(conversation!);

          const buttons = [
            { id: 'solde_credit', title: 'Solde Crédit' },
            { id: 'solde_forfait', title: 'Solde Forfait' },
          ];
          const bodyText = 'Quelle solde souhaitez-vous consulter ?';
          await this.whatsAppService.sendReplyButtons(from, bodyText, buttons, 'Consultation Solde');
          await this.saveMessage(conversation!, `[BOT] ${bodyText}`);
        } else if (selection === 'menu_recharge') {
          conversation!.step = 'RECHARGE_MENU';
          await convoRepo.save(conversation!);

          const buttons = [
            { id: 'recharge_soi', title: 'Pour soi' },
            { id: 'recharge_autrui', title: 'Pour autrui' },
          ];
          const bodyText = 'Pour qui souhaitez-vous recharger du crédit ?';
          await this.whatsAppService.sendReplyButtons(from, bodyText, buttons, 'Recharge Crédit');
          await this.saveMessage(conversation!, `[BOT] ${bodyText}`);
        } else if (selection === 'menu_transfert') {
          conversation!.step = 'TRANSFERT_NUMERO';
          await convoRepo.save(conversation!);

          const botMessage = 'Veuillez saisir le numéro de téléphone du destinataire pour le transfert (ex: 22507080910) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else if (selection === 'menu_forfaits') {
          conversation!.step = 'FORFAIT_MENU';
          await convoRepo.save(conversation!);

          const sections = [
            {
              title: 'Durée de validité',
              rows: [
                { id: 'cat_Jour', title: 'Forfaits Jour', description: 'Forfaits valides 1 jour' },
                { id: 'cat_Semaine', title: 'Forfaits Semaine', description: 'Forfaits valides 7 jours' },
                { id: 'cat_Mois', title: 'Forfaits Mois', description: 'Forfaits valides 30 jours' },
                { id: 'cat_Special', title: 'Forfaits Spéciaux', description: 'Offres spéciales' },
              ],
            },
          ];
          const bodyText = 'Choisissez la durée de validité du forfait que vous souhaitez acheter :';
          await this.whatsAppService.sendListMessage(
            from,
            bodyText,
            'Catégories',
            sections,
            'Achat Forfait',
            'Sélectionnez ci-dessus'
          );
          await this.saveMessage(conversation!, `[BOT] ${bodyText}`);
        } else if (selection === 'menu_fibre') {
          conversation!.step = 'FIBRE_REFERENCE';
          await convoRepo.save(conversation!);

          const botMessage = 'Veuillez saisir le numéro de référence de votre abonnement fibre (ex: FIB-102938) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          // Si choix non reconnu, on réaffiche le menu principal
          const responseText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${responseText}`);
        }
        break;
      }

      case 'SOLDE_MENU': {
        const selection = interactiveData?.id || cleanText;

        if (selection.includes('credit')) {
          const botMessage = `Votre solde de crédit est de : *${user.balance} FCFA*.`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          // Retour au menu principal
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        } else if (selection.includes('forfait')) {
          const achatRepo = AppDataSource.getRepository(AchatForfait);

          // Récupère les forfaits achetés actifs
          const achats = await achatRepo.find({
            where: { user: { id: user.id }, statut: true },
            relations: { forfait: true },
          });

          const activeAchats = achats.filter((a) => {
            const dateExpiration = new Date(
              a.dateAchat.getTime() + a.forfait.validite * 24 * 60 * 60 * 1000
            );
            return dateExpiration.getTime() > now.getTime();
          });

          let botMessage = '';
          if (activeAchats.length === 0) {
            botMessage = "Vous n'avez pas de forfait actif pour le moment.";
          } else {
            botMessage = 'Voici vos forfaits actifs :\n';
            activeAchats.forEach((a) => {
              const expDate = new Date(
                a.dateAchat.getTime() + a.forfait.validite * 24 * 60 * 60 * 1000
              );
              botMessage += `\n- *${a.forfait.name}* (Cat: ${a.forfait.categorie})\n  Internet: ${a.forfait.internet} Mo, Voix: ${a.forfait.voix} min, SMS: ${a.forfait.sms}\n  Expire le: ${expDate.toLocaleDateString('fr-FR')}\n`;
            });
          }

          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          // Retour au menu principal
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        } else {
          // Re-proposer l'option ou retour au menu
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        }
        break;
      }

      case 'RECHARGE_MENU': {
        const selection = interactiveData?.id || cleanText;

        if (selection.includes('soi')) {
          conversation!.step = 'RECHARGE_SOI_MONTANT';
          await convoRepo.save(conversation!);

          const botMessage = 'Veuillez entrer le montant de la recharge en FCFA :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else if (selection.includes('autrui')) {
          conversation!.step = 'RECHARGE_AUTRUI_NUMERO';
          await convoRepo.save(conversation!);

          const botMessage = 'Veuillez saisir le numéro de téléphone du bénéficiaire (ex: 22507080910) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          // Annulation et retour
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        }
        break;
      }

      case 'RECHARGE_SOI_MONTANT': {
        const amount = parseInt(text.replace(/\s/g, ''), 10);

        if (isNaN(amount) || amount <= 0) {
          const botMessage = 'Montant invalide. Veuillez entrer un montant numérique valide en FCFA (ex: 1000) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          // Mise à jour du solde
          user.balance += amount;
          await userRepo.save(user);

          const botMessage = `Recharge de *${amount} FCFA* effectuée avec succès ! Votre nouveau solde est de *${user.balance} FCFA*.`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          // Retour au menu principal
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        }
        break;
      }

      case 'RECHARGE_AUTRUI_NUMERO': {
        const destPhone = this.normalizePhone(text);

        if (destPhone.length < 8) {
          const botMessage = 'Numéro de téléphone invalide. Veuillez entrer un numéro valide (ex: 22507080910) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          conversation!.tempData = JSON.stringify({ destPhone });
          conversation!.step = 'RECHARGE_AUTRUI_MONTANT';
          await convoRepo.save(conversation!);

          const botMessage = `Veuillez entrer le montant de la recharge en FCFA pour le numéro *${text}* :`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        }
        break;
      }

      case 'RECHARGE_AUTRUI_MONTANT': {
        const amount = parseInt(text.replace(/\s/g, ''), 10);
        let tempDataObj: any = {};
        try {
          tempDataObj = JSON.parse(conversation!.tempData || '{}');
        } catch (e) {
          console.error(e);
        }

        const destPhone = tempDataObj.destPhone;

        if (isNaN(amount) || amount <= 0) {
          const botMessage = 'Montant invalide. Veuillez entrer un montant numérique valide en FCFA :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else if (!destPhone) {
          const botMessage = "Une erreur s'est produite (bénéficiaire manquant). Retour au menu principal.";
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          conversation!.step = 'MAIN_MENU';
          conversation!.tempData = '';
          await convoRepo.save(conversation!);
          await this.sendMainMenu(from, user);
        } else {
          // Recherche du destinataire dans la base
          const allUsersList = await userRepo.find();
          const destUser = allUsersList.find((u) => {
            const uTel = this.normalizePhone(u.tel);
            return uTel === destPhone || uTel.endsWith(destPhone) || destPhone.endsWith(uTel);
          });

          if (destUser) {
            destUser.balance += amount;
            await userRepo.save(destUser);
          }

          const botMessage = `Recharge de *${amount} FCFA* effectuée avec succès pour le numéro *${destPhone}* !`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          // Retour au menu principal
          conversation!.step = 'MAIN_MENU';
          conversation!.tempData = '';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        }
        break;
      }

      case 'TRANSFERT_NUMERO': {
        const destPhone = this.normalizePhone(text);

        if (destPhone.length < 8) {
          const botMessage = 'Numéro de téléphone invalide. Veuillez entrer un numéro valide (ex: 22507080910) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          // Vérifier si le destinataire existe
          const allUsersList = await userRepo.find();
          const destUser = allUsersList.find((u) => {
            const uTel = this.normalizePhone(u.tel);
            return uTel === destPhone || uTel.endsWith(destPhone) || destPhone.endsWith(uTel);
          });

          if (!destUser) {
            const botMessage = `Désolé, le destinataire avec le numéro *${text}* n'est pas un client enregistré. Transfert impossible. Retour au menu.`;
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

            conversation!.step = 'MAIN_MENU';
            await convoRepo.save(conversation!);
            await this.sendMainMenu(from, user);
          } else {
            conversation!.tempData = JSON.stringify({ destPhone, destUserId: destUser.id });
            conversation!.step = 'TRANSFERT_MONTANT';
            await convoRepo.save(conversation!);

            const botMessage = `Veuillez entrer le montant du transfert en FCFA (votre solde actuel: *${user.balance} FCFA*) :`;
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
          }
        }
        break;
      }

      case 'TRANSFERT_MONTANT': {
        const amount = parseInt(text.replace(/\s/g, ''), 10);
        let tempDataObj: any = {};
        try {
          tempDataObj = JSON.parse(conversation!.tempData || '{}');
        } catch (e) {
          console.error(e);
        }

        const destUserId = tempDataObj.destUserId;
        const destPhone = tempDataObj.destPhone;

        if (isNaN(amount) || amount <= 0) {
          const botMessage = 'Montant invalide. Veuillez entrer un montant numérique valide en FCFA :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else if (amount > user.balance) {
          const botMessage = `Solde insuffisant. Votre solde actuel est de *${user.balance} FCFA*. Veuillez entrer un montant inférieur ou écrivez 'retour' :`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          // Effectuer le transfert
          const destUser = await userRepo.findOne({ where: { id: destUserId } });

          if (!destUser) {
            const botMessage = "Destinataire introuvable. Opération annulée. Retour au menu principal.";
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

            conversation!.step = 'MAIN_MENU';
            conversation!.tempData = '';
            await convoRepo.save(conversation!);
            await this.sendMainMenu(from, user);
          } else {
            // Débit & Crédit
            user.balance -= amount;
            await userRepo.save(user);

            destUser.balance += amount;
            await userRepo.save(destUser);

            const botMessage = `Transfert de *${amount} FCFA* vers le numéro *${destPhone}* effectué avec succès !\nVotre nouveau solde est de *${user.balance} FCFA*.`;
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

            // Retour au menu principal
            conversation!.step = 'MAIN_MENU';
            conversation!.tempData = '';
            await convoRepo.save(conversation!);
            const menuText = await this.sendMainMenu(from, user);
            await this.saveMessage(conversation!, `[BOT] ${menuText}`);
          }
        }
        break;
      }

      case 'FORFAIT_MENU': {
        const selection = interactiveData?.id || cleanText;
        let category = '';

        if (selection.includes('Jour')) {
          category = 'Jour';
        } else if (selection.includes('Semaine')) {
          category = 'Semaine';
        } else if (selection.includes('Mois')) {
          category = 'Mois';
        } else if (selection.includes('Special')) {
          category = 'Special';
        }

        if (!category) {
          // Re-proposer
          conversation!.step = 'MAIN_MENU';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
          return;
        }

        conversation!.tempData = JSON.stringify({ category, page: 1 });
        conversation!.step = 'FORFAIT_BUY_CONFIRM';
        await convoRepo.save(conversation!);

        const responseText = await this.sendForfaitPage(from, category, 1, user.balance);
        await this.saveMessage(conversation!, `[BOT] ${responseText}`);
        break;
      }

      case 'FORFAIT_BUY_CONFIRM': {
        const selection = interactiveData?.id || cleanText;

        let tempDataObj: any = {};
        try {
          tempDataObj = JSON.parse(conversation!.tempData || '{}');
        } catch (e) {
          console.error(e);
        }

        const category = tempDataObj.category;
        const page = tempDataObj.page || 1;

        if (selection === 'next_page') {
          const newPage = page + 1;
          conversation!.tempData = JSON.stringify({ category, page: newPage });
          await convoRepo.save(conversation!);

          const responseText = await this.sendForfaitPage(from, category, newPage, user.balance);
          await this.saveMessage(conversation!, `[BOT] ${responseText}`);
        } else if (selection === 'prev_page') {
          const newPage = Math.max(1, page - 1);
          conversation!.tempData = JSON.stringify({ category, page: newPage });
          await convoRepo.save(conversation!);

          const responseText = await this.sendForfaitPage(from, category, newPage, user.balance);
          await this.saveMessage(conversation!, `[BOT] ${responseText}`);
        } else if (selection === 'back_categories') {
          conversation!.step = 'FORFAIT_MENU';
          conversation!.tempData = '';
          await convoRepo.save(conversation!);

          const sections = [
            {
              title: 'Durée de validité',
              rows: [
                { id: 'cat_Jour', title: 'Forfaits Jour', description: 'Forfaits valides 1 jour' },
                { id: 'cat_Semaine', title: 'Forfaits Semaine', description: 'Forfaits valides 7 jours' },
                { id: 'cat_Mois', title: 'Forfaits Mois', description: 'Forfaits valides 30 jours' },
                { id: 'cat_Special', title: 'Forfaits Spéciaux', description: 'Offres spéciales' },
              ],
            },
          ];
          const bodyText = 'Choisissez la durée de validité du forfait que vous souhaitez acheter :';
          await this.whatsAppService.sendListMessage(
            from,
            bodyText,
            'Catégories',
            sections,
            'Achat Forfait',
            'Sélectionnez ci-dessus'
          );
          await this.saveMessage(conversation!, `[BOT] ${bodyText}`);
        } else if (selection.startsWith('buy_forfait_')) {
          const forfaitId = parseInt(selection.replace('buy_forfait_', ''), 10);
          const forfaitRepo = AppDataSource.getRepository(Forfait);
          const forfait = await forfaitRepo.findOne({ where: { id: forfaitId } });

          if (!forfait) {
            const botMessage = 'Forfait introuvable. Retour au menu principal.';
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

            conversation!.step = 'MAIN_MENU';
            conversation!.tempData = '';
            await convoRepo.save(conversation!);
            await this.sendMainMenu(from, user);
          } else if (user.balance < forfait.prix) {
            const botMessage = `Solde insuffisant pour acheter le forfait *${forfait.name}* (${forfait.prix} FCFA).\nVotre solde actuel est de *${user.balance} FCFA*.\nVeuillez recharger votre compte puis réessayer.`;
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

            conversation!.step = 'MAIN_MENU';
            conversation!.tempData = '';
            await convoRepo.save(conversation!);
            await this.sendMainMenu(from, user);
          } else {
            // Débiter l'utilisateur
            user.balance -= forfait.prix;
            await userRepo.save(user);

            // Enregistrer l'achat
            const achatRepo = AppDataSource.getRepository(AchatForfait);
            const achat = new AchatForfait();
            achat.user = user;
            achat.forfait = forfait;
            achat.dateAchat = new Date();
            achat.montant = forfait.prix;
            achat.statut = true;
            achat.referenceTransaction = `TX-FORF-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
            await achatRepo.save(achat);

            const botMessage = `Achat réussi ! Le forfait *${forfait.name}* a été activé avec succès. *${forfait.prix} FCFA* ont été débités.\nVotre nouveau solde est de *${user.balance} FCFA*.`;
            await this.whatsAppService.sendTextMessage(from, botMessage);
            await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

            // Retour au menu principal
            conversation!.step = 'MAIN_MENU';
            conversation!.tempData = '';
            await convoRepo.save(conversation!);
            const menuText = await this.sendMainMenu(from, user);
            await this.saveMessage(conversation!, `[BOT] ${menuText}`);
          }
        } else {
          // Annulation
          const botMessage = 'Opération d\'achat annulée. Retour au menu principal.';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          conversation!.step = 'MAIN_MENU';
          conversation!.tempData = '';
          await convoRepo.save(conversation!);
          await this.sendMainMenu(from, user);
        }
        break;
      }

      case 'FIBRE_REFERENCE': {
        const ref = text.trim();

        if (ref.length < 3) {
          const botMessage = 'Numéro de référence invalide. Veuillez entrer une référence valide (ex: FIB-102938) :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else {
          conversation!.tempData = JSON.stringify({ fibreRef: ref });
          conversation!.step = 'FIBRE_MONTANT';
          await convoRepo.save(conversation!);

          const botMessage = `Veuillez saisir le montant de l'abonnement à régler pour la référence *${ref}* (ex: 15000) :`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        }
        break;
      }

      case 'FIBRE_MONTANT': {
        const amount = parseInt(text.replace(/\s/g, ''), 10);
        let tempDataObj: any = {};
        try {
          tempDataObj = JSON.parse(conversation!.tempData || '{}');
        } catch (e) {
          console.error(e);
        }

        const fibreRef = tempDataObj.fibreRef;

        if (isNaN(amount) || amount <= 0) {
          const botMessage = 'Montant invalide. Veuillez entrer un montant numérique valide en FCFA :';
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else if (amount > user.balance) {
          const botMessage = `Solde insuffisant. Votre solde actuel est de *${user.balance} FCFA*. Veuillez recharger ou saisir un montant inférieur :`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);
        } else if (!fibreRef) {
          const botMessage = "Une erreur s'est produite (référence manquante). Retour au menu principal.";
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          conversation!.step = 'MAIN_MENU';
          conversation!.tempData = '';
          await convoRepo.save(conversation!);
          await this.sendMainMenu(from, user);
        } else {
          // Effectuer le paiement
          user.balance -= amount;
          await userRepo.save(user);

          const botMessage = `Paiement fibre effectué avec succès !\n\n- Réf Fibre : *${fibreRef}*\n- Montant : *${amount} FCFA*\n- Nouveau solde crédit : *${user.balance} FCFA*.`;
          await this.whatsAppService.sendTextMessage(from, botMessage);
          await this.saveMessage(conversation!, `[BOT] ${botMessage}`);

          // Retour au menu principal
          conversation!.step = 'MAIN_MENU';
          conversation!.tempData = '';
          await convoRepo.save(conversation!);
          const menuText = await this.sendMainMenu(from, user);
          await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        }
        break;
      }

      default: {
        // En cas d'état inconnu, retour au début
        conversation!.step = 'MAIN_MENU';
        await convoRepo.save(conversation!);
        const menuText = await this.sendMainMenu(from, user);
        await this.saveMessage(conversation!, `[BOT] ${menuText}`);
        break;
      }
    }
  }
}
