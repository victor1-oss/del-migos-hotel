// db/database.js
// JSON-based persistent database using lowdb
// For production scale, swap with PostgreSQL or MongoDB

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'data', 'delmigos.json');

// Default database schema
const defaultData = {
  bookings: [],
  guests: [],
  rooms: [
    { id: 'presidential', name: 'Presidential Suite', category: 'presidential', priceNGN: 4200000, capacity: 6, status: 'available', floor: '40th', size: '420m²' },
    { id: 'penthouse-1', name: 'Sky Penthouse (1)', category: 'penthouse', priceNGN: 2100000, capacity: 4, status: 'available', floor: '39th', size: '280m²' },
    { id: 'penthouse-2', name: 'Sky Penthouse (2)', category: 'penthouse', priceNGN: 2100000, capacity: 4, status: 'available', floor: '38th', size: '280m²' },
    { id: 'grand-101', name: 'Grand Suite 101', category: 'suite', priceNGN: 1450000, capacity: 3, status: 'available', floor: '10th', size: '190m²' },
    { id: 'grand-201', name: 'Grand Suite 201', category: 'suite', priceNGN: 1450000, capacity: 3, status: 'available', floor: '20th', size: '190m²' },
    { id: 'grand-301', name: 'Grand Suite 301', category: 'suite', priceNGN: 1450000, capacity: 3, status: 'available', floor: '30th', size: '190m²' },
    { id: 'junior-12a', name: 'Junior Suite 12A', category: 'suite', priceNGN: 780000, capacity: 2, status: 'available', floor: '12th', size: '90m²' },
    { id: 'junior-12b', name: 'Junior Suite 12B', category: 'suite', priceNGN: 780000, capacity: 2, status: 'available', floor: '12th', size: '90m²' },
    { id: 'junior-22a', name: 'Junior Suite 22A', category: 'suite', priceNGN: 780000, capacity: 2, status: 'available', floor: '22nd', size: '90m²' },
    { id: 'deluxe-401', name: 'Deluxe King 401', category: 'deluxe', priceNGN: 420000, capacity: 2, status: 'available', floor: '4th', size: '55m²' },
    { id: 'deluxe-402', name: 'Deluxe King 402', category: 'deluxe', priceNGN: 420000, capacity: 2, status: 'available', floor: '4th', size: '55m²' },
    { id: 'deluxe-501', name: 'Deluxe King 501', category: 'deluxe', priceNGN: 420000, capacity: 2, status: 'available', floor: '5th', size: '55m²' },
  ],
  payments: [],
  enquiries: [],
  newsletter: [],
  settings: {
    hotelName: 'Del-Migos Hotels & Residences',
    currency: 'NGN',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    cancellationHours: 48,
    taxRate: 0.075, // 7.5% VAT
  }
};

let db;

export async function initDB() {
  const { mkdirSync } = await import('fs');
  mkdirSync(join(__dirname, '..', 'data'), { recursive: true });

  const adapter = new JSONFile(dbPath);
  db = new Low(adapter, defaultData);
  await db.read();

  // Merge any missing default keys
  db.data = { ...defaultData, ...db.data };
  await db.write();

  console.log('✅ Database initialized:', dbPath);
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}
