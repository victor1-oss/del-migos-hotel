# DEL-MIGOS Hotel — Backend API

Full booking management backend for Del-Migos Hotel. Built with **Node.js + Express + SQLite** (sql.js — no native builds needed).

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Start the server
npm start
# API running at http://localhost:3001
```

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/health` | None | Health check |
| POST | `/api/bookings` | None | Create a booking |
| GET | `/api/bookings` | Admin | List all bookings |
| GET | `/api/bookings/:ref` | None | Get single booking |
| PATCH | `/api/bookings/:ref/status` | Admin | Update booking status |
| DELETE | `/api/bookings/:ref` | Admin | Cancel booking |
| GET | `/api/availability` | None | Check room availability |
| POST | `/api/enquiries` | None | Submit contact form |
| GET | `/api/enquiries` | Admin | List enquiries |
| POST | `/api/newsletter` | None | Newsletter signup |
| GET | `/api/stats` | Admin | Dashboard statistics |
| POST | `/api/auth/admin` | None | Admin login |

---

## Admin Authentication

Admin routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer delmigos-admin-secret
```

Change `ADMIN_SECRET` in `.env` before deploying to production.

---

## Example API Calls

### Create a Booking
```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "room": "Grand Suite",
    "room_price": 1450000,
    "checkin": "2025-09-10",
    "checkout": "2025-09-13",
    "nights": 3,
    "guests": "2 Adults",
    "amount": 4350000,
    "currency": "NGN",
    "first_name": "James",
    "last_name": "Okafor",
    "email": "james@email.com",
    "phone": "+234 801 234 5678",
    "country": "Nigeria",
    "payment_method": "card"
  }'
```

### Check Availability
```bash
curl "http://localhost:3001/api/availability?checkin=2025-09-10&checkout=2025-09-13"
```

### Admin — Get All Bookings
```bash
curl http://localhost:3001/api/bookings \
  -H "Authorization: Bearer delmigos-admin-secret"
```

### Admin — Update Booking Status
```bash
curl -X PATCH http://localhost:3001/api/bookings/DM-XXXXXXXX/status \
  -H "Authorization: Bearer delmigos-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"status": "Confirmed", "tx_id": "FLW-123456"}'
```

### Admin — Dashboard Stats
```bash
curl http://localhost:3001/api/stats \
  -H "Authorization: Bearer delmigos-admin-secret"
```

---

## Connecting the Frontend

In `del-migos-full.html`, find the `CONFIG` object and add:

```javascript
const CONFIG = {
  apiUrl: 'http://localhost:3001',  // Your backend URL
  flutterwaveKey: 'FLWPUBK_TEST-...',
  // ...
};
```

---

## Deployment Options

### Option 1 — Railway (Recommended, free tier)
1. Push this folder to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variables from `.env`
4. Your API is live at `https://your-app.railway.app`

### Option 2 — Render
1. Push to GitHub
2. [render.com](https://render.com) → New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `node server.js`

### Option 3 — VPS (DigitalOcean, Hetzner, etc.)
```bash
# On your server:
git clone your-repo
cd delmigos-backend
npm install
# Use PM2 to keep it running:
npm install -g pm2
pm2 start server.js --name delmigos-api
pm2 startup
pm2 save
```

---

## Database

- Stored at `data/delmigos.db` (SQLite file)
- **Back this file up regularly** — it contains all bookings
- For production at scale, consider migrating to PostgreSQL (just replace sql.js with `pg`)

---

## Email Setup (Gmail)

1. Enable 2FA on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate a password for "Mail"
4. Set `SMTP_USER=your@gmail.com` and `SMTP_PASS=your-app-password` in `.env`

---

© 2025 Del-Migos Hotels & Residences Ltd
