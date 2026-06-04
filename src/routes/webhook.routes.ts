import express from 'express';
import { receiveMessage, verifyWebhook } from '../controllers/webhook.controller.js';


const router = express.Router();

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveMessage);

export default router;
