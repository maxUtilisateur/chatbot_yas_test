import 'dotenv/config';
import 'reflect-metadata';
import express from 'express';
import { AppDataSource } from './config/data_source';
import webhookRoutes from './routes/webhook.routes';
import { User } from './entities/User';
import { Forfait } from './entities/Forfait';

const app = express();
app.use(express.json());
app.use('/', webhookRoutes);

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
    });
  })
  .catch((err) => {
    console.error('Erreur connexion base :', err);
  });
