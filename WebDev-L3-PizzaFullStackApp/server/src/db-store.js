import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_INVENTORY = [
  ['base', 'Classic Hand Tossed', 129, 48],
  ['base', 'Thin Crust', 139, 42],
  ['base', 'Cheese Burst', 169, 35],
  ['base', 'Whole Wheat', 149, 25],
  ['base', 'Gluten Free', 179, 18],
  ['sauce', 'Classic Tomato', 0, 50],
  ['sauce', 'Pesto Verde', 20, 32],
  ['sauce', 'Smoky BBQ', 15, 30],
  ['sauce', 'Creamy Alfredo', 25, 25],
  ['sauce', 'Spicy Arrabbiata', 10, 28],
  ['cheese', 'Mozzarella', 55, 60],
  ['cheese', 'Cheddar Blend', 60, 45],
  ['cheese', 'Vegan Cheese', 75, 20],
  ['vegetable', 'Bell Peppers', 20, 55],
  ['vegetable', 'Red Onions', 15, 50],
  ['vegetable', 'Mushrooms', 25, 40],
  ['vegetable', 'Black Olives', 25, 30],
  ['vegetable', 'Sweet Corn', 20, 38],
  ['vegetable', 'Jalapeños', 15, 33]
];

const AZIZ_INVENTORY = [
  ['base', 'Aziz Classic Crust', 45, 48], ['base', 'Thin & Crispy', 50, 42], ['base', 'Stuffed Crust', 70, 35], ['base', 'Whole Wheat', 55, 25], ['base', 'Gluten Free', 75, 18],
  ['sauce', 'Rich Tomato', 0, 50], ['sauce', 'Green Pesto', 12, 32], ['sauce', 'Smoky BBQ', 10, 30], ['sauce', 'Creamy Garlic', 15, 25], ['sauce', 'Shito Spice', 10, 28],
  ['cheese', 'Mozzarella', 25, 60], ['cheese', 'Cheddar Blend', 30, 45], ['cheese', 'Plant-Based Cheese', 35, 20],
  ['vegetable', 'Green Pepper', 10, 55], ['vegetable', 'Red Onion', 8, 50], ['vegetable', 'Mushrooms', 12, 40], ['vegetable', 'Black Olives', 15, 30], ['vegetable', 'Sweet Corn', 10, 38], ['vegetable', 'Fresh Chilli', 8, 33]
];

function genId() {
  return crypto.randomBytes(12).toString('hex');
}

class EmbeddedStore {
  constructor() {
    this.data = { users: [], inventory: [], orders: [], intents: [] };
    this.load();
    this.ensureSeeded();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = [];
        if (!this.data.inventory) this.data.inventory = [];
        if (!this.data.orders) this.data.orders = [];
        if (!this.data.intents) this.data.intents = [];
      }
    } catch (err) {
      console.error('[EmbeddedDB] Failed to read db.json, starting fresh:', err);
    }
  }

  save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[EmbeddedDB] Failed to save db.json:', err);
    }
  }

  ensureSeeded() {
    let changed = false;
    if (!this.data.inventory || this.data.inventory.length === 0) {
      for (const [category, name, price, quantity] of AZIZ_INVENTORY) {
        this.data.inventory.push({
          _id: genId(),
          category,
          name,
          price,
          quantity,
          lowStockThreshold: 20,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      changed = true;
    }

    // Migrate the original sample catalogue to the Azizpiz Tema menu without touching users or orders.
    if (this.data.inventory.some(item => item.name === 'Classic Hand Tossed')) {
      const originalByCategory = new Map(this.data.inventory.map(item => [item.category, item]));
      this.data.inventory = AZIZ_INVENTORY.map(([category, name, price, quantity]) => {
        const prior = originalByCategory.get(category);
        return {
          _id: genId(), category, name, price,
          quantity: prior?.quantity ?? quantity,
          lowStockThreshold: prior?.lowStockThreshold ?? 20,
          active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
      });
      changed = true;
    }

    const adminEmail = (config.adminEmail || 'admin@azizpiz.local').toLowerCase();
    const existingAdmin = this.data.users.find(u => u.email === adminEmail);
    if (!existingAdmin) {
      const passwordHash = bcrypt.hashSync(config.adminPassword || 'ChangeMe123!', 12);
      this.data.users.push({
        _id: genId(),
        name: 'Azizpiz Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      changed = true;
    }

    if (changed) this.save();
  }

  match(doc, query) {
    if (!query || Object.keys(query).length === 0) return true;
    for (const key of Object.keys(query)) {
      if (key === '$expr') {
        const expr = query.$expr;
        if (expr.$lte) {
          const [left, right] = expr.$lte;
          const leftKey = left.replace(/^\$/, '');
          const rightKey = right.replace(/^\$/, '');
          if (doc[leftKey] > doc[rightKey]) return false;
        }
        continue;
      }
      const val = query[key];
      const docVal = doc[key];
      const docIdStr = doc._id ? String(doc._id) : '';

      if (key === '_id') {
        if (val && typeof val === 'object' && val.$in) {
          const inStrs = val.$in.map(x => String(x?._id || x));
          if (!inStrs.includes(docIdStr)) return false;
          continue;
        }
        const targetStr = String(val?._id || val);
        if (docIdStr !== targetStr) return false;
        continue;
      }

      if (val && typeof val === 'object' && !(val instanceof Date)) {
        if (val.$in) {
          if (!val.$in.includes(docVal)) return false;
        }
        if (val.$gt !== undefined) {
          const d1 = new Date(docVal).getTime();
          const d2 = new Date(val.$gt).getTime();
          if (isNaN(d1) || d1 <= d2) return false;
        }
        if (val.$gte !== undefined) {
          if (docVal < val.$gte) return false;
        }
        if (val.$lte !== undefined) {
          if (docVal > val.$lte) return false;
        }
      } else if (val instanceof Date) {
        if (new Date(docVal).getTime() !== val.getTime()) return false;
      } else {
        if (docVal !== val) return false;
      }
    }
    return true;
  }

  wrapDoc(table, doc) {
    if (!doc) return null;
    const store = this;
    const wrapped = { ...doc };
    wrapped.id = String(doc._id);
    wrapped._id = String(doc._id);
    wrapped.save = async function() {
      const idx = store.data[table].findIndex(x => String(x._id) === String(doc._id));
      if (idx !== -1) {
        store.data[table][idx] = { ...wrapped, updatedAt: new Date().toISOString() };
        delete store.data[table][idx].save;
        delete store.data[table][idx].id;
        store.save();
      }
      return wrapped;
    };
    return wrapped;
  }

  applyUpdates(doc, update) {
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = (doc[k] || 0) + v;
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(doc[k])) doc[k] = [];
        doc[k].push(v);
      }
    }
    if (!update.$set && !update.$inc && !update.$push) {
      Object.assign(doc, update);
    }
    doc.updatedAt = new Date().toISOString();
  }
}

export const store = new EmbeddedStore();

class MockQuery {
  constructor(table, docs, storeRef) {
    this.table = table;
    this.docs = docs;
    this.storeRef = storeRef;
  }

  sort(sortObj) {
    const [field, dir] = Object.entries(sortObj)[0] || [];
    if (field) {
      this.docs.sort((a, b) => {
        if (a[field] < b[field]) return dir === 1 ? -1 : 1;
        if (a[field] > b[field]) return dir === 1 ? 1 : -1;
        return 0;
      });
    }
    return this;
  }

  populate(field, select) {
    if (field === 'customer') {
      const fields = select ? select.split(' ') : ['name', 'email'];
      this.docs = this.docs.map(doc => {
        const customerDoc = store.data.users.find(u => String(u._id) === String(doc.customer?._id || doc.customer));
        if (customerDoc) {
          const custObj = {};
          fields.forEach(f => { custObj[f] = customerDoc[f]; });
          return { ...doc, customer: custObj };
        }
        return doc;
      });
    }
    return this;
  }

  lean() {
    return Promise.resolve(JSON.parse(JSON.stringify(this.docs)));
  }

  then(resolve, reject) {
    return Promise.resolve(this.docs.map(d => store.wrapDoc(this.table, d))).then(resolve, reject);
  }
}

export const MockUser = {
  async exists(query) {
    return store.data.users.some(u => store.match(u, query));
  },
  async create(data) {
    const doc = {
      _id: genId(),
      ...data,
      role: data.role || 'user',
      emailVerified: data.emailVerified ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    store.data.users.push(doc);
    store.save();
    return store.wrapDoc('users', doc);
  },
  async findOne(query) {
    const doc = store.data.users.find(u => store.match(u, query));
    return store.wrapDoc('users', doc);
  },
  async updateOne(query, update, options = {}) {
    let doc = store.data.users.find(u => store.match(u, query));
    if (!doc && options.upsert) {
      doc = { _id: genId(), ...query, createdAt: new Date().toISOString() };
      store.data.users.push(doc);
    }
    if (doc) {
      store.applyUpdates(doc, update);
      store.save();
    }
    return { acknowledged: true, modifiedCount: doc ? 1 : 0 };
  }
};

export const MockInventory = {
  find(query = {}) {
    const docs = store.data.inventory.filter(i => store.match(i, query));
    return new MockQuery('inventory', docs, store);
  },
  async findOneAndUpdate(query, update, options = {}) {
    const doc = store.data.inventory.find(i => store.match(i, query));
    if (!doc) return null;
    store.applyUpdates(doc, update);
    store.save();
    return store.wrapDoc('inventory', doc);
  },
  async findByIdAndUpdate(id, update, options = {}) {
    const doc = store.data.inventory.find(i => String(i._id) === String(id));
    if (!doc) return null;
    store.applyUpdates(doc, update);
    store.save();
    return store.wrapDoc('inventory', doc);
  },
  async updateOne(query, update, options = {}) {
    let doc = store.data.inventory.find(i => store.match(i, query));
    if (!doc && options.upsert) {
      doc = { _id: genId(), ...query, createdAt: new Date().toISOString() };
      if (update.$setOnInsert) Object.assign(doc, update.$setOnInsert);
      store.data.inventory.push(doc);
    }
    if (doc) {
      store.applyUpdates(doc, update);
      store.save();
    }
    return { acknowledged: true, modifiedCount: doc ? 1 : 0 };
  },
  async updateMany(query, update) {
    const matches = store.data.inventory.filter(i => store.match(i, query));
    for (const doc of matches) {
      store.applyUpdates(doc, update);
    }
    if (matches.length) store.save();
    return { acknowledged: true, modifiedCount: matches.length };
  }
};

export const MockOrder = {
  async create(data) {
    const doc = {
      _id: genId(),
      status: 'Order Received',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statusHistory: [{ status: 'Order Received', changedAt: new Date().toISOString() }],
      ...data
    };
    store.data.orders.push(doc);
    store.save();
    return store.wrapDoc('orders', doc);
  },
  find(query = {}) {
    const docs = store.data.orders.filter(o => store.match(o, query));
    return new MockQuery('orders', docs, store);
  },
  async findByIdAndUpdate(id, update, options = {}) {
    const doc = store.data.orders.find(o => String(o._id) === String(id));
    if (!doc) return null;
    store.applyUpdates(doc, update);
    store.save();
    return store.wrapDoc('orders', doc);
  }
};

export const MockCheckoutIntent = {
  async create(data) {
    const doc = {
      _id: genId(),
      createdAt: new Date().toISOString(),
      ...data
    };
    store.data.intents.push(doc);
    store.save();
    return store.wrapDoc('intents', doc);
  },
  async findOne(query) {
    const doc = store.data.intents.find(i => store.match(i, query));
    return store.wrapDoc('intents', doc);
  },
  async findByIdAndDelete(id) {
    const idx = store.data.intents.findIndex(i => String(i._id) === String(id));
    if (idx !== -1) {
      const removed = store.data.intents.splice(idx, 1)[0];
      store.save();
      return store.wrapDoc('intents', removed);
    }
    return null;
  }
};
