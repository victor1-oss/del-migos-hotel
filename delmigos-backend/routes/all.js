// routes/rooms.js
import { Router } from 'express';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/rooms — All rooms (public)
router.get('/', (req, res, next) => {
  try {
    const db = getDB();
    const { category } = req.query;
    let rooms = db.data.rooms;
    if (category) rooms = rooms.filter(r => r.category === category);
    res.json({ rooms });
  } catch (err) { next(err); }
});

// GET /api/rooms/availability — Available rooms for date range
router.get('/availability', (req, res, next) => {
  try {
    const { checkIn, checkOut, category } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'checkIn and checkOut required' });
    }
    const db = getDB();
    const bookedRoomIds = db.data.bookings
      .filter(b => b.status !== 'cancelled' &&
        new Date(checkIn) < new Date(b.checkOut) &&
        new Date(checkOut) > new Date(b.checkIn))
      .map(b => b.roomId);

    let rooms = db.data.rooms.filter(r => !bookedRoomIds.includes(r.id));
    if (category) rooms = rooms.filter(r => r.category === category);

    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
    res.json({
      rooms: rooms.map(r => ({ ...r, nights, totalNGN: r.priceNGN * nights })),
      nights
    });
  } catch (err) { next(err); }
});

// PATCH /api/rooms/:id — Update room status (admin)
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const room = db.data.rooms.find(r => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const allowed = ['status', 'priceNGN', 'notes'];
    allowed.forEach(f => { if (req.body[f] !== undefined) room[f] = req.body[f]; });
    await db.write();
    res.json({ success: true, room });
  } catch (err) { next(err); }
});

export default router;


// ─────────────────────────────────────────────────────────────────
// routes/payments.js — Flutterwave webhook + payment verification
// ─────────────────────────────────────────────────────────────────
import crypto from 'crypto';

const paymentsRouter = Router();

// POST /api/payments/verify — Verify a Flutterwave transaction
paymentsRouter.post('/verify', async (req, res, next) => {
  try {
    const { transactionId, expectedRef, expectedAmount } = req.body;
    if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

    if (!process.env.FLW_SECRET_KEY || process.env.FLW_SECRET_KEY.includes('your-')) {
      // Demo mode: approve all transactions
      return res.json({ verified: true, demo: true, transactionId });
    }

    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
    });
    const data = await response.json();

    if (data.status !== 'success') {
      return res.status(400).json({ verified: false, error: 'Transaction not found' });
    }

    const tx = data.data;
    const amountMatch = Math.abs(tx.amount - expectedAmount) < 100;
    const statusOk = tx.status === 'successful';

    if (!statusOk || !amountMatch) {
      return res.status(400).json({ verified: false, error: 'Amount or status mismatch' });
    }

    // Log payment
    const db = getDB();
    db.data.payments.push({
      transactionId: String(transactionId),
      flwRef: tx.flw_ref,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      customerEmail: tx.customer?.email,
      bookingRef: expectedRef,
      verifiedAt: new Date().toISOString(),
    });
    await db.write();

    res.json({ verified: true, transactionId: String(transactionId), amount: tx.amount, currency: tx.currency });
  } catch (err) { next(err); }
});

// POST /api/payments/webhook — Flutterwave webhook (auto-confirm bookings)
paymentsRouter.post('/webhook', async (req, res, next) => {
  try {
    const hash = req.headers['verif-hash'];
    if (process.env.FLW_WEBHOOK_HASH && hash !== process.env.FLW_WEBHOOK_HASH) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body;
    if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
      const txRef = payload.data.tx_ref; // e.g. DM-XXXXXXXX
      const db = getDB();
      const booking = db.data.bookings.find(b => b.ref === txRef || b.id === txRef);
      if (booking) {
        booking.status = 'confirmed';
        booking.transactionId = String(payload.data.id);
        booking.flwRef = payload.data.flw_ref;
        booking.paidAt = new Date().toISOString();
        booking.updatedAt = new Date().toISOString();
        await db.write();
        console.log(`✅ Booking ${booking.ref} confirmed via webhook`);
      }
    }
    res.json({ received: true });
  } catch (err) { next(err); }
});

export { paymentsRouter };


// ─────────────────────────────────────────────────────────────────
// routes/admin.js — Admin auth + analytics endpoints
// ─────────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';

const adminRouter = Router();

// POST /api/admin/login
adminRouter.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ success: true, token, expiresIn: '12h' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET /api/admin/analytics — Revenue + occupancy dashboard data
adminRouter.get('/analytics', requireAuth, (req, res, next) => {
  try {
    const db = getDB();
    const bookings = db.data.bookings;
    const confirmed = bookings.filter(b => ['confirmed', 'checked-in', 'checked-out'].includes(b.status));

    // Revenue by month (last 12 months)
    const now = new Date();
    const revenueByMonth = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = 0;
    }
    confirmed.forEach(b => {
      const key = b.checkIn.slice(0, 7);
      if (revenueByMonth[key] !== undefined) revenueByMonth[key] += b.totalAmount;
    });

    // Room type breakdown
    const byRoomType = {};
    confirmed.forEach(b => {
      byRoomType[b.roomCategory] = (byRoomType[b.roomCategory] || 0) + 1;
    });

    // Occupancy
    const totalRooms = db.data.rooms.length;
    const todayStr = now.toISOString().split('T')[0];
    const occupiedToday = bookings.filter(b =>
      b.status !== 'cancelled' &&
      b.checkIn <= todayStr && b.checkOut > todayStr
    ).length;

    // Today check-ins
    const todayCheckIns = bookings.filter(b => b.checkIn === todayStr && b.status !== 'cancelled').length;

    // Revenue stats
    const totalRevenue = confirmed.reduce((s, b) => s + b.totalAmount, 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = confirmed.filter(b => b.checkIn.startsWith(thisMonth)).reduce((s, b) => s + b.totalAmount, 0);
    const avgNightlyRate = confirmed.length > 0 ? Math.round(confirmed.reduce((s, b) => s + b.totalAmount / b.nights, 0) / confirmed.length) : 0;

    res.json({
      stats: {
        totalBookings: bookings.length,
        confirmedBookings: confirmed.length,
        pendingBookings: bookings.filter(b => b.status === 'pending').length,
        cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
        todayCheckIns,
        occupiedRooms: occupiedToday,
        totalRooms,
        occupancyRate: Math.round((occupiedToday / totalRooms) * 100),
        totalRevenue,
        monthlyRevenue,
        avgNightlyRate,
        totalGuests: db.data.guests.length,
      },
      revenueByMonth: Object.entries(revenueByMonth).map(([month, amount]) => ({ month, amount })),
      byRoomType: Object.entries(byRoomType).map(([type, count]) => ({ type, count })),
    });
  } catch (err) { next(err); }
});

// GET /api/admin/guests — Guest list (admin)
adminRouter.get('/guests', requireAuth, (req, res, next) => {
  try {
    const db = getDB();
    const { page = 1, limit = 50 } = req.query;
    const guests = [...db.data.guests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = guests.length;
    const paginated = guests.slice((page - 1) * limit, page * limit);
    res.json({ guests: paginated, total });
  } catch (err) { next(err); }
});

// PATCH /api/admin/guests/:id — Update guest (e.g. set VIP)
adminRouter.patch('/guests/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const guest = db.data.guests.find(g => g.id === req.params.id);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    ['isVip', 'notes', 'loyaltyTier'].forEach(f => { if (req.body[f] !== undefined) guest[f] = req.body[f]; });
    guest.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, guest });
  } catch (err) { next(err); }
});

// GET /api/admin/settings — Get settings
adminRouter.get('/settings', requireAuth, (req, res, next) => {
  try {
    res.json({ settings: getDB().data.settings });
  } catch (err) { next(err); }
});

// PATCH /api/admin/settings — Update settings
adminRouter.patch('/settings', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    db.data.settings = { ...db.data.settings, ...req.body };
    await db.write();
    res.json({ success: true, settings: db.data.settings });
  } catch (err) { next(err); }
});

export { adminRouter };


// ─────────────────────────────────────────────────────────────────
// routes/misc.js — Enquiries, newsletter, health check
// ─────────────────────────────────────────────────────────────────
const miscRouter = Router();

// POST /api/enquiries
miscRouter.post('/enquiries', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, enquiryType, preferredDate, message } = req.body;
    if (!email || !message) return res.status(400).json({ error: 'Email and message required' });

    const db = getDB();
    const enquiry = {
      id: uuidv4(),
      firstName, lastName, email, phone,
      enquiryType: enquiryType || 'General',
      preferredDate: preferredDate || null,
      message,
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    db.data.enquiries = db.data.enquiries || [];
    db.data.enquiries.push(enquiry);
    await db.write();
    res.status(201).json({ success: true, message: 'Enquiry received. Our team will respond within 2 hours.' });
  } catch (err) { next(err); }
});

// POST /api/newsletter
miscRouter.post('/newsletter', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

    const db = getDB();
    db.data.newsletter = db.data.newsletter || [];
    if (db.data.newsletter.find(n => n.email === email)) {
      return res.json({ success: true, message: 'Already subscribed' });
    }
    db.data.newsletter.push({ email, subscribedAt: new Date().toISOString() });
    await db.write();
    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (err) { next(err); }
});

// GET /api/health
miscRouter.get('/health', (req, res) => {
  const db = getDB();
  res.json({
    status: 'ok',
    service: 'Del-Migos API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: { bookings: db.data.bookings.length, guests: db.data.guests.length },
  });
});

export { miscRouter };
