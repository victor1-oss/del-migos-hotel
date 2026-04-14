// routes/bookings.js
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { getDB } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { sendEmail } from '../services/mailer.js';
import { bookingConfirmationEmail, adminNewBookingAlert, cancellationEmail } from '../emails/templates.js';

const router = Router();

// ─── Validation rules ─────────────────────────────
const bookingValidation = [
  body('roomId').notEmpty().withMessage('Room ID is required'),
  body('checkIn').isDate().withMessage('Valid check-in date required'),
  body('checkOut').isDate().withMessage('Valid check-out date required'),
  body('guestFirstName').trim().notEmpty().withMessage('First name required'),
  body('guestLastName').trim().notEmpty().withMessage('Last name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('phone').notEmpty().withMessage('Phone number required'),
  body('guests').isInt({ min: 1, max: 10 }).withMessage('Guests must be 1–10'),
];

// ─────────────────────────────────────────────────
// POST /api/bookings
// Create a new booking (after successful payment)
// ─────────────────────────────────────────────────
router.post('/', bookingValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const db = getDB();
    const {
      roomId, checkIn, checkOut, guests,
      guestFirstName, guestLastName, email, phone, country,
      specialRequests, currency, transactionId, paymentMethod,
      totalAmount, nights
    } = req.body;

    // Check room exists
    const room = db.data.rooms.find(r => r.id === roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check for date conflicts
    const conflict = db.data.bookings.find(b =>
      b.roomId === roomId &&
      b.status !== 'cancelled' &&
      new Date(checkIn) < new Date(b.checkOut) &&
      new Date(checkOut) > new Date(b.checkIn)
    );
    if (conflict) {
      return res.status(409).json({ error: 'Room is not available for selected dates' });
    }

    // Generate reference: DM-XXXXXX
    const ref = 'DM-' + uuidv4().slice(0, 8).toUpperCase();

    const booking = {
      id: uuidv4(),
      ref,
      roomId,
      roomName: room.name,
      roomCategory: room.category,
      checkIn,
      checkOut,
      nights: nights || Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000),
      guests: Number(guests),
      guestFirstName,
      guestLastName,
      guestName: `${guestFirstName} ${guestLastName}`,
      email,
      phone,
      country: country || 'Nigeria',
      specialRequests: specialRequests || '',
      currency: currency || 'NGN',
      totalAmount: Number(totalAmount) || room.priceNGN * (nights || 1),
      transactionId: transactionId || null,
      paymentMethod: paymentMethod || 'card',
      status: transactionId ? 'confirmed' : 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.data.bookings.push(booking);

    // Upsert guest record
    const existingGuest = db.data.guests.find(g => g.email === email);
    if (existingGuest) {
      existingGuest.totalBookings = (existingGuest.totalBookings || 0) + 1;
      existingGuest.totalSpent = (existingGuest.totalSpent || 0) + booking.totalAmount;
      existingGuest.updatedAt = new Date().toISOString();
    } else {
      db.data.guests.push({
        id: uuidv4(),
        name: booking.guestName,
        firstName: guestFirstName,
        lastName: guestLastName,
        email,
        phone,
        country: country || 'Nigeria',
        totalBookings: 1,
        totalSpent: booking.totalAmount,
        isVip: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await db.write();

    // Send confirmation emails (non-blocking)
    const emailData = { ...booking };
    sendEmail(email, bookingConfirmationEmail(emailData)).catch(console.error);
    if (process.env.SMTP_USER) {
      sendEmail(process.env.SMTP_USER, adminNewBookingAlert(emailData)).catch(console.error);
    }

    res.status(201).json({
      success: true,
      booking: {
        id: booking.id,
        ref: booking.ref,
        status: booking.status,
        roomName: booking.roomName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
      }
    });

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────
// GET /api/bookings/check-availability
// Check if room is available for dates
// ─────────────────────────────────────────────────
router.get('/check-availability', (req, res, next) => {
  try {
    const { roomId, checkIn, checkOut } = req.query;
    if (!roomId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'roomId, checkIn and checkOut are required' });
    }

    const db = getDB();
    const room = db.data.rooms.find(r => r.id === roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const conflict = db.data.bookings.find(b =>
      b.roomId === roomId &&
      b.status !== 'cancelled' &&
      new Date(checkIn) < new Date(b.checkOut) &&
      new Date(checkOut) > new Date(b.checkIn)
    );

    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
    const totalNGN = room.priceNGN * nights;

    res.json({
      available: !conflict,
      room: {
        id: room.id,
        name: room.name,
        priceNGN: room.priceNGN,
        category: room.category,
      },
      nights,
      totalNGN,
      conflict: conflict ? {
        checkIn: conflict.checkIn,
        checkOut: conflict.checkOut
      } : null
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────
// GET /api/bookings/my/:ref — Guest looks up booking
// ─────────────────────────────────────────────────
router.get('/my/:ref', (req, res, next) => {
  try {
    const db = getDB();
    const booking = db.data.bookings.find(b => b.ref === req.params.ref.toUpperCase());
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // Strip sensitive fields for guest-facing response
    const { email, phone, ...safe } = booking;
    res.json({ booking: safe });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────
// POST /api/bookings/:ref/cancel — Guest cancels
// ─────────────────────────────────────────────────
router.post('/:ref/cancel', async (req, res, next) => {
  try {
    const db = getDB();
    const booking = db.data.bookings.find(b => b.ref === req.params.ref.toUpperCase());
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // Check cancellation policy (48 hours before check-in)
    const hoursUntilCheckIn = (new Date(booking.checkIn) - new Date()) / 3600000;
    const cancellationHours = db.data.settings.cancellationHours || 48;
    if (hoursUntilCheckIn < cancellationHours) {
      return res.status(400).json({
        error: `Cannot cancel within ${cancellationHours} hours of check-in`,
        hoursUntilCheckIn: Math.round(hoursUntilCheckIn)
      });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    await db.write();

    sendEmail(booking.email, cancellationEmail(booking)).catch(console.error);

    res.json({ success: true, message: 'Booking cancelled successfully', ref: booking.ref });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────
// ADMIN ROUTES (require JWT)
// ─────────────────────────────────────────────────

// GET /api/bookings — All bookings (admin)
router.get('/', requireAuth, (req, res, next) => {
  try {
    const db = getDB();
    const { status, roomId, from, to, page = 1, limit = 50 } = req.query;

    let bookings = [...db.data.bookings].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (status) bookings = bookings.filter(b => b.status === status);
    if (roomId) bookings = bookings.filter(b => b.roomId === roomId);
    if (from) bookings = bookings.filter(b => new Date(b.checkIn) >= new Date(from));
    if (to) bookings = bookings.filter(b => new Date(b.checkIn) <= new Date(to));

    const total = bookings.length;
    const offset = (page - 1) * limit;
    const paginated = bookings.slice(offset, offset + Number(limit));

    res.json({ bookings: paginated, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/:id — Single booking (admin)
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const db = getDB();
    const booking = db.data.bookings.find(b => b.id === req.params.id || b.ref === req.params.id.toUpperCase());
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bookings/:id — Update booking status (admin)
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const booking = db.data.bookings.find(b => b.id === req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const allowed = ['status', 'specialRequests', 'transactionId', 'notes'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) booking[field] = req.body[field];
    });
    booking.updatedAt = new Date().toISOString();
    await db.write();

    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/bookings/:id — Hard delete (admin only)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const db = getDB();
    const idx = db.data.bookings.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Booking not found' });
    db.data.bookings.splice(idx, 1);
    await db.write();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
