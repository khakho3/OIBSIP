import mongoose from 'mongoose';
import { MockUser, MockInventory, MockOrder, MockCheckoutIntent } from './db-store.js';

const { Schema, model } = mongoose;
const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }, role: { type: String, enum: ['user', 'admin'], default: 'user' },
  emailVerified: { type: Boolean, default: false }, verificationToken: String, verificationExpires: Date,
  resetToken: String, resetExpires: Date
}, { timestamps: true });

const inventorySchema = new Schema({
  category: { type: String, enum: ['base', 'sauce', 'cheese', 'vegetable'], required: true },
  name: { type: String, required: true, trim: true }, price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0, default: 0 }, lowStockThreshold: { type: Number, min: 0, default: 20 },
  active: { type: Boolean, default: true }, lastLowStockAlertAt: Date
}, { timestamps: true });
inventorySchema.index({ category: 1, name: 1 }, { unique: true });

const orderSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ inventory: { type: Schema.Types.ObjectId, ref: 'Inventory' }, name: String, category: String, quantity: { type: Number, min: 1 }, unitPrice: Number }],
  amount: { type: Number, min: 0, required: true }, currency: { type: String, default: 'GHS' },
  status: { type: String, enum: ['Order Received', 'In Kitchen', 'Sent to Delivery'], default: 'Order Received' },
  payment: { provider: { type: String, enum: ['razorpay', 'test'], required: true }, orderId: String, paymentId: String, signature: String, paidAt: Date },
  address: { type: String, trim: true, maxlength: 300 }, statusHistory: [{ status: String, changedAt: { type: Date, default: Date.now } }]
}, { timestamps: true });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ 'payment.paymentId': 1 }, { unique: true, sparse: true });

const checkoutIntentSchema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true }, selections: { base: String, sauce: String, cheese: String, vegetables: [String] },
  amount: { type: Number, required: true }, providerOrderId: { type: String, unique: true, sparse: true }, expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

const MongooseUser = model('User', userSchema);
const MongooseInventory = model('Inventory', inventorySchema);
const MongooseOrder = model('Order', orderSchema);
const MongooseCheckoutIntent = model('CheckoutIntent', checkoutIntentSchema);

function createModelProxy(mongooseModel, mockModel) {
  return new Proxy(mongooseModel, {
    get(target, prop, receiver) {
      if (mongoose.connection.readyState === 1) {
        return Reflect.get(target, prop, receiver);
      }
      if (prop in mockModel) {
        return mockModel[prop];
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

export const User = createModelProxy(MongooseUser, MockUser);
export const Inventory = createModelProxy(MongooseInventory, MockInventory);
export const Order = createModelProxy(MongooseOrder, MockOrder);
export const CheckoutIntent = createModelProxy(MongooseCheckoutIntent, MockCheckoutIntent);
