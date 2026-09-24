import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Razorpay from 'razorpay';
import { CheckoutIntent, Inventory, Order, User } from './models.js';
import { requireAdmin, requireAuth, tokenFor } from './auth.js';
import { config } from './config.js';
import { sendMail } from './email.js';

const router = Router();
const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
const safeUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified });
const issueToken = () => crypto.randomBytes(32).toString('hex');
const bad = (res, message) => res.status(400).json({ message });

router.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !password || password.length < 8) return bad(res, 'Provide a name, valid email, and password of at least 8 characters.');
  if (await User.exists({ email: email.toLowerCase() })) return bad(res, 'An account already exists for that email.');
  const token = issueToken();
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), verificationToken: hashToken(token), verificationExpires: new Date(Date.now() + 86400000) });
  const link = `${config.clientUrl}/verify-email?token=${token}`;
  await sendMail({ to: user.email, subject: 'Verify your Azizpiz account', text: `Welcome to Azizpiz! Verify your account: ${link}` });
  res.status(201).json({ message: 'Account created. Please check your email to verify it.', verificationUrl: !config.smtp ? link : undefined });
});
router.get('/auth/verify-email/:token', async (req, res) => {
  const user = await User.findOne({ verificationToken: hashToken(req.params.token), verificationExpires: { $gt: new Date() } });
  if (!user) return bad(res, 'This verification link is invalid or expired.');
  user.emailVerified = true; user.verificationToken = undefined; user.verificationExpires = undefined; await user.save();
  res.json({ message: 'Email verified. You can now sign in.' });
});
router.post('/auth/login', async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
  if (user.role === 'user' && !user.emailVerified) return res.status(403).json({ message: 'Verify your email before signing in.' });
  res.json({ token: tokenFor(user), user: safeUser(user) });
});
router.post('/auth/forgot-password', async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() });
  let resetUrl;
  if (user) {
    const token = issueToken();
    user.resetToken = hashToken(token);
    user.resetExpires = new Date(Date.now() + 3600000);
    await user.save();
    const link = `${config.clientUrl}/reset-password?token=${token}`;
    await sendMail({ to: user.email, subject: 'Reset your Azizpiz password', text: `Reset your password: ${link}` });
    if (!config.smtp) resetUrl = link;
  }
  res.json({ message: 'If an account exists, a password-reset link has been sent.', resetUrl });
});
router.post('/auth/reset-password', async (req, res) => {
  if (!req.body.password || req.body.password.length < 8) return bad(res, 'Password must be at least 8 characters.');
  const user = await User.findOne({ resetToken: hashToken(req.body.token || ''), resetExpires: { $gt: new Date() } });
  if (!user) return bad(res, 'This reset link is invalid or expired.');
  user.passwordHash = await bcrypt.hash(req.body.password, 12); user.resetToken = undefined; user.resetExpires = undefined; await user.save();
  res.json({ message: 'Password updated. You can sign in now.' });
});

router.get('/catalog', async (_req, res) => res.json(await Inventory.find({ active: true }).sort({ category: 1, name: 1 }).lean()));

async function validatePizza(selections) {
  const uniqueIds = [...new Set([selections?.base, selections?.sauce, selections?.cheese, ...(selections?.vegetables || [])].filter(Boolean))];
  if (!selections?.base || !selections?.sauce || !selections?.cheese || uniqueIds.length < 3) throw new Error('Choose one base, sauce, cheese, and optional vegetables.');
  const found = await Inventory.find({ _id: { $in: uniqueIds }, active: true }); const byId = new Map(found.map(x => [x.id, x]));
  const mustMatch = [[selections.base,'base'], [selections.sauce,'sauce'], [selections.cheese,'cheese']];
  if (mustMatch.some(([id, category]) => !byId.get(id) || byId.get(id).category !== category) || (selections.vegetables || []).some(id => !byId.get(id) || byId.get(id).category !== 'vegetable')) throw new Error('One or more selections are no longer available.');
  const depleted = [...byId.values()].find(x => x.quantity < 1); if (depleted) throw new Error(`${depleted.name} is out of stock.`);
  const items = uniqueIds.map(id => { const item = byId.get(id); return { inventory: item._id, name: item.name, category: item.category, quantity: 1, unitPrice: item.price }; });
  return { items, amount: items.reduce((sum, x) => sum + x.unitPrice, 0) };
}
async function persistPaidOrder({ customer, selections, payment }) {
  const { items, amount } = await validatePizza(selections);
  // Conditional decrements prevent overselling if two checkouts race for the last unit.
  const decremented = [];
  try {
    for (const item of items) { const changed = await Inventory.findOneAndUpdate({ _id: item.inventory, quantity: { $gte: item.quantity } }, { $inc: { quantity: -item.quantity } }, { new: true }); if (!changed) throw new Error(`${item.name} just sold out.`); decremented.push(item); }
    return await Order.create({ customer, items, amount, payment: { ...payment, paidAt: new Date() }, statusHistory: [{ status: 'Order Received' }] });
  } catch (error) { await Promise.all(decremented.map(item => Inventory.updateOne({ _id: item.inventory }, { $inc: { quantity: item.quantity } }))); throw error; }
}

router.post('/orders/checkout', requireAuth, async (req, res) => {
  const pizza = await validatePizza(req.body.selections);
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    const intent = await CheckoutIntent.create({ customer: req.auth.sub, selections: req.body.selections, amount: pizza.amount, expiresAt: new Date(Date.now() + 15 * 60000) });
    return res.json({ mode: 'test', intentId: intent.id, amount: pizza.amount, currency: 'GHS' });
  }
  const razorpay = new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret });
  const order = await razorpay.orders.create({ amount: Math.round(pizza.amount * 100), currency: 'GHS', receipt: `azizpiz_${Date.now()}` });
  await CheckoutIntent.create({ customer: req.auth.sub, selections: req.body.selections, amount: pizza.amount, providerOrderId: order.id, expiresAt: new Date(Date.now() + 15 * 60000) });
  res.json({ mode: 'razorpay', key: config.razorpayKeyId, orderId: order.id, amount: order.amount, currency: order.currency });
});
router.post('/orders/verify', requireAuth, async (req, res) => {
  const { provider, intentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  let intent;
  if (provider === 'razorpay') {
    if (!config.razorpayKeySecret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return bad(res, 'Incomplete Razorpay payment response.');
    const expected = crypto.createHmac('sha256', config.razorpayKeySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected.length !== razorpay_signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) return res.status(400).json({ message: 'Payment signature verification failed.' });
    intent = await CheckoutIntent.findOne({ customer: req.auth.sub, providerOrderId: razorpay_order_id, expiresAt: { $gt: new Date() } });
  } else if (provider === 'test' && process.env.NODE_ENV !== 'production') intent = await CheckoutIntent.findOne({ _id: intentId, customer: req.auth.sub, expiresAt: { $gt: new Date() } });
  else return bad(res, 'Unsupported payment method.');
  if (!intent) return bad(res, 'Checkout has expired or is invalid. Please start again.');
  const order = await persistPaidOrder({ customer: req.auth.sub, selections: intent.selections, payment: provider === 'razorpay' ? { provider, orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature } : { provider: 'test', paymentId: `test_${crypto.randomUUID()}` } });
  await CheckoutIntent.findByIdAndDelete(intent._id);
  res.status(201).json({ order });
});
router.get('/orders/my', requireAuth, async (req, res) => res.json(await Order.find({ customer: req.auth.sub }).sort({ createdAt: -1 }).lean()));

router.get('/admin/inventory', requireAuth, requireAdmin, async (_req, res) => res.json(await Inventory.find().sort({ category: 1, name: 1 }).lean()));
router.patch('/admin/inventory/:id', requireAuth, requireAdmin, async (req, res) => {
  const allowed = ['quantity', 'lowStockThreshold', 'price', 'active']; const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const item = await Inventory.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: 'Inventory item not found.' }); res.json(item);
});
router.get('/admin/orders', requireAuth, requireAdmin, async (_req, res) => res.json(await Order.find().populate('customer', 'name email').sort({ createdAt: -1 }).lean()));
router.patch('/admin/orders/:id/status', requireAuth, requireAdmin, async (req, res) => {
  const valid = ['Order Received', 'In Kitchen', 'Sent to Delivery']; if (!valid.includes(req.body.status)) return bad(res, 'Invalid status.');
  const order = await Order.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status }, $push: { statusHistory: { status: req.body.status } } }, { new: true }); if (!order) return res.status(404).json({ message: 'Order not found.' }); res.json(order);
});

export default router;
