const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===================== SECURITY: Load credentials from env =====================
// JWT_SECRET: read from env, or auto-generate and save to .env
let JWT_SECRET = process.env.JWT_SECRET;
const ENV_PATH = path.join(__dirname, '.env');

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  // Append or create .env file
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  }
  if (!envContent.includes('JWT_SECRET=')) {
    fs.appendFileSync(ENV_PATH, `\nJWT_SECRET=${JWT_SECRET}\n`);
    console.warn('[SECURITY] JWT_SECRET was auto-generated and saved to .env — please keep this file safe!');
  } else {
    console.warn('[SECURITY] JWT_SECRET found in .env but too short, using auto-generated value. Please update manually.');
  }
}

// Admin password: read from env, fallback to bcrypt hash of 'admin123' for backward compat
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const DATA_DIR = path.join(__dirname, 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

// 初始化数据文件
const defaultAdminPwd = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const dataDefaults = {
  'products.json': [],
  'users.json': [{ id: 1, username: 'admin', password: defaultAdminPwd, role: 'admin', created: new Date().toISOString() }],
  'settings.json': {
    site_title: 'WaterbearIntl', site_description: 'Global Industrial B2B Trade Partner',
    contact_email: 'info@waterbearintl.com', contact_phone: '+86 574 8888 8888', contact_address: 'Ningbo, Zhejiang, China',
    seo_keywords: 'industrial B2B, machinery, hardware, bearings, CNC parts',
    seo_description: 'WaterbearIntl - Your trusted B2B partner for industrial machinery, hardware, electronics and materials.',
    social_facebook: '', social_linkedin: '', social_youtube: '', social_twitter: '',
    footer_text: '© 2026 WaterbearIntl. All rights reserved.',
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_from: ''
  },
  'messages.json': [],
  'images.json': [],
  'logs.json': []
};

Object.entries(dataDefaults).forEach(([file, data]) => {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
});

// Middleware
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer config with MIME type whitelist
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Only images (JPEG, PNG, GIF, WebP, SVG) are accepted.`));
    }
  }
});

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// 读/写辅助
function readData(file) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); }
function writeData(file, data) { fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8'); }
function log(action, detail) {
  const logs = readData('logs.json');
  logs.unshift({ id: Date.now(), action, detail, time: new Date().toISOString() });
  if (logs.length > 500) logs.length = 500;
  writeData('logs.json', logs);
}

// ===================== AUTH =====================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readData('users.json');
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    log('login_failed', { username });
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  log('login', { username });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard', auth, (req, res) => {
  const products = readData('products.json');
  const messages = readData('messages.json');
  const images = readData('images.json');
  const users = readData('users.json');
  res.json({
    products: products.length,
    categories: new Set(products.map(p => p.category)).size,
    messages: messages.length,
    images: images.length,
    users: users.length
  });
});

// ===================== PRODUCTS =====================
app.get('/api/products', (req, res) => res.json(readData('products.json').filter(p => !p.deletedAt)));
app.post('/api/products', auth, (req, res) => {
  const products = readData('products.json');
  const item = { id: Date.now(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  products.push(item);
  writeData('products.json', products);
  log('product_create', { id: item.id, name: item.name });
  res.json(item);
});
app.put('/api/products/:id', auth, (req, res) => {
  const products = readData('products.json');
  const idx = products.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  products[idx] = { ...products[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeData('products.json', products);
  log('product_update', { id: req.params.id, name: products[idx].name || products[idx].title });
  res.json(products[idx]);
});
app.delete('/api/products/:id', auth, (req, res) => {
  const products = readData('products.json');
  const item = products.find(p => p.id == req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.deletedAt = new Date().toISOString();
  writeData('products.json', products);
  log('product_delete', { id: req.params.id, name: item.name || item.title });
  res.json({ success: true });
});
// Batch product operations
app.post('/api/products/batch', auth, (req, res) => {
  const { action, ids, data } = req.body;
  if (!action || !ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '参数错误' });
  const products = readData('products.json');
  let count = 0;
  if (action === 'delete') {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    let deleted = [];
    products.forEach(p => { if (idSet.has(p.id)) { p.deletedAt = now; deleted.push(p); } });
    count = deleted.length;
    writeData('products.json', products);
    log('product_batch_delete', { count, names: deleted.map(p => p.title || p.name).join(', ') });
  } else if (action === 'update' && data) {
    products.forEach(p => {
      if (ids.includes(p.id)) {
        Object.assign(p, data, { updatedAt: new Date().toISOString() });
        count++;
      }
    });
    writeData('products.json', products);
    log('product_batch_update', { count, action: action });
  } else if (action === 'featured') {
    products.forEach(p => {
      if (ids.includes(p.id)) { p.featured = !p.featured; p.updatedAt = new Date().toISOString(); count++; }
    });
    writeData('products.json', products);
    log('product_batch_featured', { count });
  }
  res.json({ success: true, count });
});
// Product search
app.get('/api/products/search', (req, res) => {
  const { q, category, status, tag, minPrice, maxPrice } = req.query;
  let products = readData('products.json').filter(p => !p.deletedAt);
  if (q) { const kw = q.toLowerCase(); products = products.filter(p => (p.title||'').toLowerCase().includes(kw) || (p.name||'').toLowerCase().includes(kw) || (p.sku||'').toLowerCase().includes(kw)); }
  if (category) products = products.filter(p => p.category === category);
  if (status) products = products.filter(p => p.status === status);
  if (tag) products = products.filter(p => p.tag === tag);
  res.json(products);
});

// ===================== CONTACT FORM (public) =====================
app.post('/api/contact', (req, res) => {
  const { name, email, company, phone, country, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  const messages = readData('messages.json');
  const msg = {
    id: Date.now(),
    name, email, company: company || '', phone: phone || '',
    country: country || '', subject: subject || '', message,
    createdAt: new Date().toISOString(), read: false
  };
  messages.unshift(msg);
  writeData('messages.json', messages);
  log('contact_form', { name, email, subject });
  sendNewMessageEmail(msg);
  res.json({ success: true, message: 'Thank you for your inquiry. We will get back to you within 24 hours.' });
});

// ===================== MESSAGES (Contact form submissions) =====================
app.get('/api/messages', auth, (req, res) => res.json(readData('messages.json').filter(m => !m.deletedAt)));
app.post('/api/messages', (req, res) => {
  const messages = readData('messages.json');
  const msg = { id: Date.now(), ...req.body, createdAt: new Date().toISOString(), read: false };
  messages.unshift(msg);
  writeData('messages.json', messages);
  res.json({ success: true, message: 'Thank you for your inquiry. We will get back to you soon.' });
});
app.put('/api/messages/:id', auth, (req, res) => {
  const messages = readData('messages.json');
  const idx = messages.findIndex(m => m.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  messages[idx] = { ...messages[idx], ...req.body };
  writeData('messages.json', messages);
  res.json(messages[idx]);
});
app.delete('/api/messages/:id', auth, (req, res) => {
  const messages = readData('messages.json');
  const msg = messages.find(m => m.id == req.params.id);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  msg.deletedAt = new Date().toISOString();
  writeData('messages.json', messages);
  log('message_delete', { id: req.params.id });
  res.json({ success: true });
});

// ===================== IMAGES =====================
app.get('/api/images', auth, (req, res) => res.json(readData('images.json')));
app.post('/api/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const images = readData('images.json');
  const img = {
    id: Date.now(),
    filename: req.file.filename,
    originalname: req.file.originalname,
    path: '/uploads/' + req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
    uploadedAt: new Date().toISOString()
  };
  images.unshift(img);
  writeData('images.json', images);
  log('image_upload', { filename: req.file.filename });
  res.json(img);
});
app.delete('/api/images/:id', auth, (req, res) => {
  let images = readData('images.json');
  const img = images.find(i => i.id == req.params.id);
  if (!img) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(__dirname, 'uploads', img.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  images = images.filter(i => i.id != req.params.id);
  writeData('images.json', images);
  log('image_delete', { filename: img.filename });
  res.json({ success: true });
});

// ===================== SETTINGS =====================
app.get('/api/settings', auth, (req, res) => res.json(readData('settings.json')));
app.put('/api/settings', auth, (req, res) => {
  writeData('settings.json', req.body);
  log('settings_update', {});
  res.json({ success: true });
});

// ===================== USERS =====================
app.get('/api/users', auth, (req, res) => {
  res.json(readData('users.json').map(({ password, ...u }) => u));
});
app.post('/api/users', auth, (req, res) => {
  const users = readData('users.json');
  if (users.find(u => u.username === req.body.username)) return res.status(400).json({ error: '用户名已存在' });
  const user = { id: Date.now(), username: req.body.username, password: bcrypt.hashSync(req.body.password, 10), role: req.body.role || 'editor', created: new Date().toISOString() };
  users.push(user);
  writeData('users.json', users);
  log('user_create', { username: user.username });
  const { password, ...safe } = user;
  res.json(safe);
});
app.put('/api/users/:id', auth, (req, res) => {
  const users = readData('users.json');
  const idx = users.findIndex(u => u.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (req.body.username) users[idx].username = req.body.username;
  if (req.body.role) users[idx].role = req.body.role;
  if (req.body.password) users[idx].password = bcrypt.hashSync(req.body.password, 10);
  writeData('users.json', users);
  log('user_update', { id: req.params.id });
  const { password, ...safe } = users[idx];
  res.json(safe);
});
app.delete('/api/users/:id', auth, (req, res) => {
  let users = readData('users.json');
  const user = users.find(u => u.id == req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.username === 'admin') return res.status(400).json({ error: '无法删除admin账户' });
  users = users.filter(u => u.id != req.params.id);
  writeData('users.json', users);
  log('user_delete', { id: req.params.id });
  res.json({ success: true });
});

// ===================== LOGS =====================
app.get('/api/logs', auth, (req, res) => {
  const logs = readData('logs.json');
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 30;
  res.json({ data: logs.slice((page - 1) * limit, page * limit), total: logs.length, page, totalPages: Math.ceil(logs.length / limit) });
});

// ===================== BACKUP & RESTORE =====================
app.get('/api/backup', auth, (req, res) => {
  const backup = {};
  const files = ['products.json', 'users.json', 'settings.json', 'messages.json', 'images.json', 'logs.json'];
  files.forEach(f => { backup[f] = readData(f); });
  backup._meta = { exportedAt: new Date().toISOString(), version: '1.0', exportedBy: req.user.username };
  log('backup_create', { size: JSON.stringify(backup).length });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="waterbearintl_backup_'+Date.now()+'.json"');
  res.json(backup);
});

app.post('/api/restore', auth, (req, res) => {
  try {
    const backup = req.body;
    const files = ['products.json', 'users.json', 'settings.json', 'messages.json', 'images.json', 'logs.json'];
    const existingFiles = files.filter(f => backup[f]);
    if (existingFiles.length === 0) return res.status(400).json({ error: '备份文件无效' });
    // Save current as safety backup
    const safetyDir = path.join(DATA_DIR, 'pre_restore_' + Date.now());
    fs.mkdirSync(safetyDir, { recursive: true });
    existingFiles.forEach(f => {
      const src = path.join(DATA_DIR, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(safetyDir, f));
      writeData(f, backup[f]);
    });
    log('restore', { restoredFiles: existingFiles, safetyDir });
    res.json({ success: true, restored: existingFiles, safetyBackup: safetyDir });
  } catch (e) {
    res.status(500).json({ error: '恢复失败：' + e.message });
  }
});

// ===================== SYSTEM INFO =====================
app.get('/api/system', auth, (req, res) => {
  const dataFiles = ['products.json', 'users.json', 'settings.json', 'messages.json', 'images.json', 'logs.json'];
  const sizes = {};
  dataFiles.forEach(f => {
    const fp = path.join(DATA_DIR, f);
    sizes[f] = fs.existsSync(fp) ? fs.statSync(fp).size : 0;
  });
  const uploadDir = path.join(__dirname, 'uploads');
  let uploadCount = 0, uploadSize = 0;
  if (fs.existsSync(uploadDir)) {
    fs.readdirSync(uploadDir).forEach(f => {
      const s = fs.statSync(path.join(uploadDir, f));
      uploadCount++;
      uploadSize += s.size;
    });
  }
  res.json({
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dataFiles: sizes,
    dataTotal: Object.values(sizes).reduce((a, b) => a + b, 0),
    uploads: { count: uploadCount, totalSize: uploadSize },
    serverTime: new Date().toISOString()
  });
});

// ===================== STATS (for charts) =====================
app.get('/api/stats/trends', auth, (req, res) => {
  const logs = readData('logs.json');
  const messages = readData('messages.json');
  const days = 7;
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const dayLogs = logs.filter(l => l.time.startsWith(ds));
    const dayMsgs = messages.filter(m => m.createdAt && m.createdAt.startsWith(ds));
    result.push({
      date: d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      productOps: dayLogs.filter(l => l.action.startsWith('product_')).length,
      messages: dayMsgs.length,
      uploads: dayLogs.filter(l => l.action === 'image_upload').length,
      logins: dayLogs.filter(l => l.action === 'login' || l.action === 'login_success').length
    });
  }
  res.json(result);
});

// ===================== GEO DETECTION PROXY =====================
app.get('/api/geo', async (req, res) => {
  try {
    const response = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('ipapi.co returned ' + response.status);
    const data = await response.json();
    res.json({
      country_code: data.country_code,
      country_name: data.country_name,
      region: data.region,
      city: data.city,
      ip: data.ip
    });
  } catch (err) {
    res.status(502).json({ error: 'Geo detection failed', detail: err.message });
  }
});

// ===================== PAYMENT - PayPal =====================
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API = process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const auth = Buffer.from(PAYPAL_CLIENT_ID + ':' + PAYPAL_CLIENT_SECRET).toString('base64');
  const res = await fetch(PAYPAL_API + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error('PayPal auth failed');
  const data = await res.json();
  return data.access_token;
}

app.post('/api/create-paypal-order', async (req, res) => {
  const { amount, purpose } = req.body;
  const value = parseFloat(amount);
  if (!value || value < 50 || value > 2000) {
    return res.status(400).json({ error: 'Amount must be between $50 and $2000' });
  }
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return res.status(503).json({ error: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env' });
  }
  try {
    const token = await getPayPalAccessToken();
    const orderRes = await fetch(PAYPAL_API + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: value.toFixed(2) },
          description: 'Sample Fee - ' + (purpose || 'General')
        }],
        application_context: {
          brand_name: 'WaterbearIntl',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: req.headers.origin + '/payment.html?status=success',
          cancel_url: req.headers.origin + '/payment.html?status=cancel'
        }
      })
    });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.message || 'PayPal order creation failed');
    log('paypal_order_created', { orderId: order.id, amount: value.toFixed(2), purpose });
    res.json({ id: order.id, status: order.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/capture-paypal-order', async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    return res.status(503).json({ error: 'PayPal is not configured' });
  }
  try {
    const token = await getPayPalAccessToken();
    const captureRes = await fetch(PAYPAL_API + '/v2/checkout/orders/' + orderId + '/capture', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    const capture = await captureRes.json();
    if (!captureRes.ok) throw new Error(capture.message || 'PayPal capture failed');
    log('paypal_payment_captured', { orderId, status: capture.status });
    res.json({ status: capture.status, id: capture.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== TRASH =====================
app.get('/api/trash', auth, (req, res) => {
  const products = readData('products.json').filter(p => p.deletedAt);
  const messages = readData('messages.json').filter(m => m.deletedAt);
  const items = [
    ...products.map(p => ({ ...p, _type: 'product' })),
    ...messages.map(m => ({ ...m, _type: 'message' }))
  ];
  items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  res.json(items);
});

app.put('/api/trash/restore/:type/:id', auth, (req, res) => {
  const { type, id } = req.params;
  const file = type === 'product' ? 'products.json' : 'messages.json';
  const data = readData(file);
  const item = data.find(d => d.id == id && d.deletedAt);
  if (!item) return res.status(404).json({ error: 'Not found in trash' });
  delete item.deletedAt;
  writeData(file, data);
  log('trash_restore', { type, id });
  res.json({ success: true });
});

app.delete('/api/trash/:type/:id', auth, (req, res) => {
  const { type, id } = req.params;
  const file = type === 'product' ? 'products.json' : 'messages.json';
  let data = readData(file);
  const item = data.find(d => d.id == id && d.deletedAt);
  if (!item) return res.status(404).json({ error: 'Not found in trash' });
  data = data.filter(d => d.id != id);
  writeData(file, data);
  log('trash_permanent_delete', { type, id, name: item.name || item.title || item.subject || '' });
  res.json({ success: true });
});

// ===================== EMAIL NOTIFICATION (P3-2) =====================
async function sendNewMessageEmail(msg) {
  try {
    const settings = readData('settings.json');
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) return;
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: parseInt(settings.smtp_port) === 465,
      auth: { user: settings.smtp_user, pass: settings.smtp_pass }
    });
    await transporter.sendMail({
      from: `"${settings.smtp_from || 'WaterbearIntl'}" <${settings.smtp_user}>`,
      to: settings.contact_email || settings.smtp_user,
      subject: `[新消息] ${msg.subject || '客户询盘'} - ${msg.name}`,
      html: `<h3>新客户消息</h3>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">姓名</td><td><strong>${msg.name}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">邮箱</td><td>${msg.email}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">公司</td><td>${msg.company || '-'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">电话</td><td>${msg.phone || '-'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">国家</td><td>${msg.country || '-'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">主题</td><td>${msg.subject || '-'}</td></tr>
        </table>
        <hr><p style="white-space:pre-wrap">${msg.message}</p>
        <p style="color:#999;font-size:12px">发送时间: ${new Date().toLocaleString('zh-CN')}</p>`
    });
    console.log('[EMAIL] Notification sent for message from', msg.email);
  } catch (err) {
    console.error('[EMAIL] Failed to send notification:', err.message);
  }
}

// ===================== PAYMENT CONFIG (public) =====================
app.get('/api/payment-config', (req, res) => {
  res.json({
    paypalClientId: PAYPAL_CLIENT_ID,
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY || ''
  });
});

// Start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin.html`);
  console.log(`Default admin password is set via ADMIN_PASSWORD env variable (or 'admin123' if not set). Change it immediately in production.`);
});