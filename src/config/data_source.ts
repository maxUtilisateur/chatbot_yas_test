// import 'reflect-metadata';
// import { DataSource } from 'typeorm';

// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
//   username: process.env.DB_USER,
//   password: process.env.DB_PASS,
//   database: process.env.DB_NAME,
//   synchronize: true,
//   logging: false,
//   entities: [__dirname + '/../entities/*.ts'],
// });


// import 'reflect-metadata';
// import { DataSource } from 'typeorm';

// export const AppDataSource = new DataSource({
//   type: 'postgres',
//   url: process.env.DATABASE_URL, // ← Supabase URL
//   synchronize: true,
//   logging: false,
//   entities: [__dirname + '/../entities/*.ts'],
// });


import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/User.js';
import { Forfait } from '../entities/Forfait.js';
import { Validation } from '../entities/Validation.js';
import { Message } from '../entities/Message.js';
import { Conversation } from '../entities/Conversation.js';
import { AchatForfait } from '../entities/AchatForfait.js';



export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL, // Supabase ou Postgres local
  synchronize: true,
  logging: false,
  entities: [User, Forfait, Message, Validation, Conversation, AchatForfait],
});
