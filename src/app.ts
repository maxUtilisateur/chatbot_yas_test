import 'dotenv/config';
import 'reflect-metadata';
import express from 'express';
import webhookRoutes from './routes/webhook.routes.js';
import { AppDataSource } from './config/data_source.js';
import { User } from './entities/User.js';

const app = express();
app.use(express.json());
app.use('/', webhookRoutes);

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

const port = parseInt(process.env.PORT ?? '3000', 10);

async function seedDatabase() {
  const userRepo = AppDataSource.getRepository(User);

  // Vérifier et insérer l'utilisateur de test
  const userCount = await userRepo.count();
  if (userCount === 0) {
    const testUser = new User();
    testUser.user_id = 10001;
    testUser.firstname = 'Maxime';
    testUser.lastname = 'Herve';
    testUser.tel = '91219131'; // Numéro par défaut
    testUser.mail = process.env.SMTP_USER || 'b5597866@gmail.com';
    testUser.balance = 50000;
    await userRepo.save(testUser);
    console.log('Utilisateur de test inséré avec succès.');
  }
 
}

AppDataSource.initialize()
  .then(async () => {
    console.log('Base de données connectée');
    await seedDatabase();

    app.listen(port, () => {
      console.log(`Serveur lancé sur le port ${port}`);

      // Log d'activité toutes les 30 secondes (demandé par l'utilisateur)
      setInterval(() => {
        console.log(`[Keep-Alive] Serveur actif - ${new Date().toISOString()}`);
      }, 30000);

      // Auto-ping intelligent de l'URL externe Render toutes les 10 minutes pour empêcher la mise en veille
      const externalUrl = process.env.RENDER_EXTERNAL_URL;
      if (externalUrl) {
        console.log(`Auto-ping configuré pour : ${externalUrl}`);
        setInterval(async () => {
          try {
            const axios = (await import('axios')).default;
            await axios.get(`${externalUrl}/ping`);
            console.log(`[Keep-Alive] Ping réussi vers ${externalUrl}/ping`);
          } catch (err: any) {
            console.error(`[Keep-Alive] Échec du ping :`, err.message);
          }
        }, 10 * 60 * 1000);
      }
    });
  })
  .catch((err) => {
    console.error('Erreur connexion base :', err);
  });
