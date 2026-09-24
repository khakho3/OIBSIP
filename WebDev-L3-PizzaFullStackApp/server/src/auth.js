import jwt from 'jsonwebtoken';
import { config } from './config.js';

export const tokenFor = user => jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { expiresIn: '7d' });
export function requireAuth(req, res, next) {
  try { const value = req.headers.authorization?.split(' ')[1]; if (!value) throw new Error(); req.auth = jwt.verify(value, config.jwtSecret); next(); }
  catch { res.status(401).json({ message: 'Authentication is required.' }); }
}
export const requireAdmin = (req, res, next) => req.auth?.role === 'admin' ? next() : res.status(403).json({ message: 'Administrator access is required.' });
