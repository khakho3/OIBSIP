import 'dotenv/config';

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/azizpiz',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  smtp: process.env.SMTP_HOST ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } : null,
  smtpFrom: process.env.SMTP_FROM || 'Azizpiz <no-reply@azizpiz.local>',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@azizpiz.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  lowStockEmail: process.env.LOW_STOCK_EMAIL || process.env.ADMIN_EMAIL
};
