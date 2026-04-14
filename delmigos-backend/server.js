/**
 * DEL-MIGOS HOTEL — Backend API
 * Node.js + Express + SQLite (sql.js pure JS)
 *
 * Routes:
 *   GET    /api/health
 *   POST   /api/bookings           Create booking
 *   GET    /api/bookings           List all (admin)
 *   GET    /api/bookings/:ref      Get single
 *   PATCH  /api/bookings/:ref/status  Update status (admin)
 *   DELETE /api/bookings/:ref      Cancel (admin)
 *   GET    /api/availability       Check room dates
 *   POST   /api/enquiries          Contact form
 *   GET    /api/enquiries          List enquiries (admin)
 *   POST   /api/newsletter         Subscribe
 *   GET    /api/stats              Dashboard stats (admin)
 *   POST   /api/auth/admin         Admin login
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer= require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const fs        = require('fs');
const path      = require('path');
const initSqlJs = require('sql.js');

const app  = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH  = path.join(DATA_DIR, 'delmigos.db');

// ── Middleware ─────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter     = rateLimit({ windowMs: 15*60*1000, max: 200 });
const bookingLimiter = rateLimit({ windowMs: 60*60*1000, max: 15 });
app.use('/api/', apiLimiter);

// ── Database ───────────────────────────────────────────────────
let db;

async function initDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('✓ Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('✓ Created new database');
  }
  createTables();
  seedDemo();
}

function save() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT UNIQUE NOT NULL,
    room TEXT NOT NULL,
    room_price INTEGER DEFAULT 0,
    checkin TEXT NOT NULL,
    checkout TEXT NOT NULL,
    nights INTEGER DEFAULT 1,
    guests TEXT DEFAULT '2 Adults',
    amount INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'Pending',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    country TEXT DEFAULT '',
    requests TEXT DEFAULT '',
    tx_id TEXT DEFAULT '',
    payment_method TEXT DEFAULT 'card',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT, last_name TEXT,
    email TEXT NOT NULL, phone TEXT,
    type TEXT, message TEXT, date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT
  )`);

  const exists = qOne("SELECT id FROM admins WHERE username='admin'");
  if (!exists) db.run("INSERT INTO admins(username,password,name) VALUES('admin','delmigos2025','Hotel Manager')");
  save();
  console.log('✓ Tables ready');
}

function seedDemo() {
  const count = qOne("SELECT COUNT(*) as c FROM bookings");
  if (count && count.c > 0) return;

  const rows = [
    ['DM-A1B2C3','Presidential Suite',4200000,'2025-08-05','2025-08-08',3,'2 Adults',12600000,'NGN','Confirmed','Adaeze','Okonkwo','adaeze@example.com','+234 801 234 5678','Nigeria','Anniversary setup','FLW-100001','card'],
    ['DM-D4E5F6','Sky Penthouse',2100000,'2025-08-06','2025-08-09',3,'2 Adults',6300000,'GBP','Confirmed','James','Whitfield','james@example.com','+44 7700 900001','United Kingdom','','FLW-100002','card'],
    ['DM-G7H8I9','Grand Suite',1450000,'2025-08-07','2025-08-10',3,'2 Adults, 1 Child',4350000,'NGN','Checked In','Fatima','Al-Rashidi','fatima@example.com','+971 50 123 4567','UAE','Late checkout','FLW-100003','bank'],
    ['DM-J1K2L3','Junior Suite',780000,'2025-08-08','2025-08-11',3,'1 Adult',2340000,'USD','Pending','Chen','Wei','chen@example.com','+86 138 0013 8000','China','','','card'],
    ['DM-M4N5O6','Deluxe King',420000,'2025-08-09','2025-08-12',3,'2 Adults',1260000,'NGN','Confirmed','Amara','Osei','amara@example.com','+233 24 123 4567','Ghana','Early arrival','FLW-100005','ussd'],
    ['DM-P7Q8R9','Grand Suite',1450000,'2025-08-10','2025-08-14',4,'2 Adults',5800000,'EUR','Confirmed','Sophie','Laurent','sophie@example.com','+33 6 12 34 56','France','Champagne on arrival','FLW-100006','card'],
    ['DM-S1T2U3','Deluxe King',420000,'2025-08-11','2025-08-13',2,'1 Adult',840000,'NGN','Pending','Emmanuel','Eze','emmy@example.com','+234 803 456 7890','Nigeria','','','card'],
    ['DM-V4W5X6','Junior Suite',780000,'2025-08-12','2025-08-15',3,'2 Adults',2340000,'INR','Cancelled','Priya','Sharma','priya@example.com','+91 98765 43210','India','','','card'],
  ];

  const stmt = db.prepare(`INSERT INTO bookings
    (ref,room,room_price,checkin,checkout,nights,guests,amount,currency,status,first_name,last_name,email,phone,country,requests,tx_id,payment_method)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  rows.forEach(r => stmt.run(r));
  stmt.free();
  save();
  console.log('✓ Demo data seeded (8 bookings)');
}

// ── Query helpers ──────────────────────────────────────────────
function qAll(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function qOne(sql, params=[]) {
  return qAll(sql, params)[0] || null;
}

function run(sql, params=[]) {
  db.run(sql, params);
  save();
}

// ── Admin auth middleware ───────────────────────────────────────
function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== (process.env.ADMIN_SECRET || 'delmigos-admin-secret')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ══════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hotel: 'Del-Migos', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── POST /api/bookings ─────────────────────────────────────────
app.post('/api/bookings', bookingLimiter, (req, res) => {
  try {
    const { room, room_price, checkin, checkout, nights, guests,
            amount, currency='NGN', first_name, last_name,
            email, phone, country, requests='', tx_id='', payment_method='card' } = req.body;

    if (!room || !checkin || !checkout || !first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email' });

    // Availability check
    const conflict = qOne(
      `SELECT ref FROM bookings WHERE room=? AND status NOT IN ('Cancelled')
       AND NOT (checkout<=? OR checkin>=?)`,
      [room, checkin, checkout]
    );
    if (conflict) {
      return res.status(409).json({ error: 'Room not available for selected dates', conflict: conflict.ref });
    }

    const ref = 'DM-' + uuidv4().replace(/-/g,'').toUpperCase().slice(0,8);

    run(`INSERT INTO bookings
      (ref,room,room_price,checkin,checkout,nights,guests,amount,currency,
       first_name,last_name,email,phone,country,requests,tx_id,payment_method,status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Pending')`,
      [ref, room, room_price||0, checkin, checkout, nights||1, guests||'2 Adults',
       amount||0, currency, first_name, last_name, email,
       phone||'', country||'', requests, tx_id, payment_method]);

    const booking = qOne('SELECT * FROM bookings WHERE ref=?', [ref]);
    sendConfirmationEmail(booking).catch(()=>{});
    res.status(201).json({ success: true, ref, booking });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings ──────────────────────────────────────────
app.get('/api/bookings', adminAuth, (req, res) => {
  try {
    const { status, search, limit=100, offset=0 } = req.query;
    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (search) {
      sql += ' AND (ref LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR room LIKE ?)';
      const s = '%'+search+'%';
      params.push(s,s,s,s,s);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const bookings = qAll(sql, params);
    const total = qOne('SELECT COUNT(*) as c FROM bookings')?.c || 0;
    res.json({ bookings, total });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/bookings/:ref ─────────────────────────────────────
app.get('/api/bookings/:ref', (req, res) => {
  try {
    const booking = qOne('SELECT * FROM bookings WHERE ref=?', [req.params.ref]);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/bookings/:ref/status ───────────────────────────
app.patch('/api/bookings/:ref/status', adminAuth, (req, res) => {
  try {
    const { status, tx_id } = req.body;
    const allowed = ['Pending','Confirmed','Checked In','Checked Out','Cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status', allowed });
    if (!qOne('SELECT id FROM bookings WHERE ref=?', [req.params.ref])) {
      return res.status(404).json({ error: 'Not found' });
    }
    run("UPDATE bookings SET status=?, tx_id=COALESCE(?,tx_id), updated_at=datetime('now') WHERE ref=?",
      [status, tx_id||null, req.params.ref]);
    res.json({ success: true, booking: qOne('SELECT * FROM bookings WHERE ref=?', [req.params.ref]) });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/bookings/:ref ──────────────────────────────────
app.delete('/api/bookings/:ref', adminAuth, (req, res) => {
  try {
    if (!qOne('SELECT id FROM bookings WHERE ref=?', [req.params.ref])) {
      return res.status(404).json({ error: 'Not found' });
    }
    run("UPDATE bookings SET status='Cancelled', updated_at=datetime('now') WHERE ref=?", [req.params.ref]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/availability ──────────────────────────────────────
app.get('/api/availability', (req, res) => {
  try {
    const { checkin, checkout } = req.query;
    if (!checkin || !checkout) return res.status(400).json({ error: 'Dates required' });

    const ROOMS = [
      { name: 'Deluxe King',        price: 420000,  capacity: 40 },
      { name: 'Junior Suite',       price: 780000,  capacity: 30 },
      { name: 'Grand Suite',        price: 1450000, capacity: 20 },
      { name: 'Sky Penthouse',      price: 2100000, capacity: 5  },
      { name: 'Presidential Suite', price: 4200000, capacity: 1  },
    ];

    const availability = ROOMS.map(r => {
      const booked = qOne(
        `SELECT COUNT(*) as c FROM bookings
         WHERE room=? AND status NOT IN ('Cancelled')
         AND NOT (checkout<=? OR checkin>=?)`,
        [r.name, checkin, checkout]
      )?.c || 0;
      return { ...r, booked, available: r.capacity - booked, isAvailable: r.capacity - booked > 0 };
    });

    res.json({ checkin, checkout, availability });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/enquiries ────────────────────────────────────────
app.post('/api/enquiries', (req, res) => {
  try {
    const { first_name, last_name, email, phone, type, message, date } = req.body;
    if (!email || !message) return res.status(400).json({ error: 'Email and message required' });
    run('INSERT INTO enquiries(first_name,last_name,email,phone,type,message,date) VALUES(?,?,?,?,?,?,?)',
      [first_name||'', last_name||'', email, phone||'', type||'General', message, date||'']);
    sendEnquiryNotification({ first_name, last_name, email, type, message }).catch(()=>{});
    res.json({ success: true, message: 'Enquiry received. We will respond within 4 hours.' });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/enquiries ─────────────────────────────────────────
app.get('/api/enquiries', adminAuth, (req, res) => {
  try {
    res.json({ enquiries: qAll('SELECT * FROM enquiries ORDER BY created_at DESC') });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/newsletter ───────────────────────────────────────
app.post('/api/newsletter', (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    try {
      run('INSERT INTO newsletter(email) VALUES(?)', [email]);
      res.json({ success: true });
    } catch(e) {
      if (e.message.includes('UNIQUE')) return res.json({ success: true, message: 'Already subscribed' });
      throw e;
    }
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/stats ─────────────────────────────────────────────
app.get('/api/stats', adminAuth, (req, res) => {
  try {
    const today     = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0,7);
    const lastMonth = new Date(Date.now()-31*864e5).toISOString().slice(0,7);

    const totalBookings  = qOne("SELECT COUNT(*) as c FROM bookings WHERE status!='Cancelled'")?.c || 0;
    const todayCheckins  = qOne("SELECT COUNT(*) as c FROM bookings WHERE checkin=? AND status!='Cancelled'", [today])?.c || 0;
    const occupied       = qOne("SELECT COUNT(*) as c FROM bookings WHERE status='Checked In'")?.c || 0;
    const monthRevenue   = qOne("SELECT SUM(amount) as s FROM bookings WHERE checkin LIKE ? AND status NOT IN ('Cancelled','Pending')", [thisMonth+'%'])?.s || 0;
    const lastMonthRev   = qOne("SELECT SUM(amount) as s FROM bookings WHERE checkin LIKE ? AND status NOT IN ('Cancelled','Pending')", [lastMonth+'%'])?.s || 0;
    const newThisWeek    = qOne("SELECT COUNT(*) as c FROM bookings WHERE created_at>=datetime('now','-7 days')")?.c || 0;
    const pendingCount   = qOne("SELECT COUNT(*) as c FROM bookings WHERE status='Pending'")?.c || 0;
    const subscribers    = qOne('SELECT COUNT(*) as c FROM newsletter')?.c || 0;
    const enquiryCount   = qOne('SELECT COUNT(*) as c FROM enquiries')?.c || 0;
    const byRoom         = qAll("SELECT room, COUNT(*) as count, SUM(amount) as revenue FROM bookings WHERE status!='Cancelled' GROUP BY room ORDER BY count DESC");
    const recentBookings = qAll('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 15');
    const monthlyRevenue = [];
    for (let i=11; i>=0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i);
      const m = d.toISOString().slice(0,7);
      const rev = qOne("SELECT SUM(amount) as s FROM bookings WHERE checkin LIKE ? AND status NOT IN ('Cancelled','Pending')", [m+'%'])?.s || 0;
      monthlyRevenue.push({ month: m, revenue: rev });
    }

    res.json({
      totalBookings, todayCheckins, occupied,
      occupancyRate: Math.round((occupied/148)*100),
      monthRevenue, lastMonthRev,
      revGrowth: lastMonthRev > 0 ? Math.round(((monthRevenue-lastMonthRev)/lastMonthRev)*100) : 0,
      newThisWeek, pendingCount, subscribers, enquiryCount,
      byRoom, recentBookings, monthlyRevenue
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/admin ───────────────────────────────────────
app.post('/api/auth/admin', (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = qOne('SELECT * FROM admins WHERE username=? AND password=?', [username, password]);
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, token: process.env.ADMIN_SECRET || 'delmigos-admin-secret', name: admin.name });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Internal server error' }));

// ── Email helpers ──────────────────────────────────────────────
function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: process.env.SMTP_PORT||587, secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendConfirmationEmail(b) {
  const m = getMailer(); if (!m) return;
  await m.sendMail({
    from: `"Del-Migos Reservations" <${process.env.SMTP_USER}>`,
    to: b.email,
    subject: `Booking Confirmed — ${b.ref} | Del-Migos Hotels`,
    html: `<div style="font-family:Georgia,serif;background:#0f0f0f;color:#f2ede4;padding:40px;max-width:600px;margin:0 auto">
      <h1 style="color:#bfa16a;letter-spacing:.3em">DEL·MIGOS</h1>
      <h2 style="color:#d9c08a">Booking Confirmed ✦</h2>
      <p>Dear ${b.first_name},<br>Thank you for choosing Del-Migos. Your reservation is confirmed.</p>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#a89880">Reference</td><td style="color:#bfa16a;font-weight:bold">${b.ref}</td></tr>
        <tr><td style="padding:8px 0;color:#a89880">Room</td><td>${b.room}</td></tr>
        <tr><td style="padding:8px 0;color:#a89880">Check In</td><td>${b.checkin}</td></tr>
        <tr><td style="padding:8px 0;color:#a89880">Check Out</td><td>${b.checkout}</td></tr>
        <tr><td style="padding:8px 0;color:#a89880">Total</td><td style="color:#bfa16a">NGN ${Number(b.amount).toLocaleString()}</td></tr>
      </table>
      <p style="color:#a89880;margin-top:24px">Questions? Call <a href="tel:+23417006446" style="color:#bfa16a">+234 1 700 64467</a></p>
    </div>`
  });
}

async function sendEnquiryNotification(e) {
  const m = getMailer(); if (!m || !process.env.HOTEL_EMAIL) return;
  await m.sendMail({
    from: `"Del-Migos Website" <${process.env.SMTP_USER}>`,
    to: process.env.HOTEL_EMAIL,
    subject: `New Enquiry [${e.type}] from ${e.first_name} ${e.last_name}`,
    text: `From: ${e.first_name} ${e.last_name} (${e.email})\nType: ${e.type}\n\n${e.message}`
  });
}

// ── Start ──────────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  DEL-MIGOS API  →  http://localhost:${PORT}`);
    console.log(`  Health check   →  http://localhost:${PORT}/api/health\n`);
  });
});
