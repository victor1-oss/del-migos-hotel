const express = require("express");
const router = express.Router();
const { getDB } = require("../db/database");
const { requireAuth } = require("../middleware/auth");

// GET /api/rooms
router.get("/", (req, res, next) => {
  try {
    const db = getDB();
    const { category } = req.query;

    let rooms = db.data.rooms;
    if (category) rooms = rooms.filter(r => r.category === category);

    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

module.exports = router;