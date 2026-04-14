// routes/rooms.js
import { Router } from 'express';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/rooms — All rooms with optional category filter (public)
router.get('/', (req, res, next) => {
  try {
    const db = getDB();
    const { category } = req.query;
    let rooms = db.data.rooms;
    if (category) rooms = rooms.filter(r => r.category === category);
    res.json({ rooms });
  } catch (err) { next(err); }
});

// GET /api/rooms/availability — Available rooms for date range (public)
router.get('/availability', (req, res, next) => {
  try {
    const { checkIn, checkOut, category } = req.query;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'checkIn and checkOut are required' });
    }

    const db = getDB();
    const bookedRoomIds = db.data.bookings
      .filter(b =>
        b.status !== 'cancelled' &&
        new Date(checkIn) < new Date(b.checkOut) &&
        new Date(checkOut) > new Date(b.checkIn)
      )
      .map(b => b.roomId);

    let rooms = db.data.rooms.filter(r => !bookedRoomIds.includes(r.id));
    if (category) rooms = rooms.filter(r => r.category === category);

    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);

    res.json({
      rooms: rooms.map(r => ({ ...r, nights, totalNGN: r.priceNGN * nights })),
      nights,
      checkIn,
      checkOut,
    });
  } catch (err) { next(err); }
});

// GET /api/rooms/:id — Single room details (public)
router.get('/:id', (req, res, next) => {
  try {
    const db = getDB();
    const room = db.data.rooms.find(r => r.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
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
