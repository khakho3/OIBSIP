import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { Inventory, User } from './models.js';

const items = [
  ['base','Aziz Classic Crust',45,48], ['base','Thin & Crispy',50,42], ['base','Stuffed Crust',70,35], ['base','Whole Wheat',55,25], ['base','Gluten Free',75,18],
  ['sauce','Rich Tomato',0,50], ['sauce','Green Pesto',12,32], ['sauce','Smoky BBQ',10,30], ['sauce','Creamy Garlic',15,25], ['sauce','Shito Spice',10,28],
  ['cheese','Mozzarella',25,60], ['cheese','Cheddar Blend',30,45], ['cheese','Plant-Based Cheese',35,20],
  ['vegetable','Green Pepper',10,55], ['vegetable','Red Onion',8,50], ['vegetable','Mushrooms',12,40], ['vegetable','Black Olives',15,30], ['vegetable','Sweet Corn',10,38], ['vegetable','Fresh Chilli',8,33]
];

try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
  console.log('Connected to MongoDB for seeding');
} catch (err) {
  console.log('Local MongoDB not connected, seeding embedded database store.');
}

for (const [category, name, price, quantity] of items) {
  await Inventory.updateOne(
    { category, name },
    { $setOnInsert: { category, name, price, quantity, lowStockThreshold: 20, active: true } },
    { upsert: true }
  );
}

const passwordHash = await bcrypt.hash(config.adminPassword, 12);
await User.updateOne(
  { email: config.adminEmail.toLowerCase() },
  { $set: { name: 'Azizpiz Admin', passwordHash, role: 'admin', emailVerified: true } },
  { upsert: true }
);

console.log('Seed complete. Admin account ready:');
console.log('  Email   :', config.adminEmail);
console.log('  Password:', config.adminPassword);

if (mongoose.connection.readyState === 1) {
  await mongoose.disconnect();
}
