import express from 'express';
import { verifyWebhook, receiveMessage } from '../controllers/webhook.controller';

const router = express.Router();

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveMessage);

export default router;
