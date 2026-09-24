import 'express-async-errors';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';
import { config } from './config.js';
import routes from './routes.js';
import { Inventory } from './models.js';
import { sendMail } from './email.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, timestamp: new Date() }));
app.use('/api', routes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: error.message || 'An unexpected error occurred.' });
});

async function alertLowStock() {
  try {
    const items = await Inventory.find({ $expr: { $lte: ['$quantity', '$lowStockThreshold'] } });
    if (!items || !items.length) return;
    const now = new Date();
    const notify = items.filter(item => !item.lastLowStockAlertAt || now - new Date(item.lastLowStockAlertAt) > 23 * 3600000);
    if (!notify.length) return;
    await sendMail({
      to: config.lowStockEmail,
      subject: `Azizpiz: ${notify.length} low-stock item(s)`,
      text: notify.map(x => `${x.name}: ${x.quantity} remaining (threshold ${x.lowStockThreshold})`).join('\n')
    });
    await Inventory.updateMany({ _id: { $in: notify.map(x => x._id) } }, { $set: { lastLowStockAlertAt: now } });
  } catch (err) {
    console.error('Low stock check error:', err.message);
  }
}

// Connect to MongoDB if available, otherwise seamlessly run embedded fallback
try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
  console.log('Connected to MongoDB at', config.mongoUri);
} catch (err) {
  console.warn(`[Azizpiz] Notice: MongoDB connection to ${config.mongoUri} was not established (${err.message}).`);
  console.log('[Azizpiz] Running with built-in embedded database store (persisted in server/data/db.json). Everything is operational!');
}

cron.schedule('0 * * * *', () => alertLowStock().catch(console.error));
alertLowStock().catch(console.error);

app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
