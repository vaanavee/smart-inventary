const express = require('express');
const db = require('../db');

const router = express.Router();

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];
const RACKS = ['A', 'B', 'C', 'D', 'E'];

// Public: overview of rooms with rack + product counts (used by both admin & employee stock pages).
router.get('/overview', (req, res) => {
  const overview = ROOMS.map((room) => {
    const racks = RACKS.map((rack) => {
      const { count, qty } = db
        .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(qty), 0) AS qty FROM products WHERE room = ? AND rack = ?')
        .get(room, rack);
      return { rack, productCount: count, totalQty: qty };
    });
    return { room, racks };
  });
  res.json(overview);
});

// Public: products in a given room + rack.
router.get('/', (req, res) => {
  const { room, rack } = req.query;
  if (!room || !rack) {
    return res.status(400).json({ error: 'room and rack query params are required' });
  }
  const products = db
    .prepare('SELECT product_id, name, room, rack, unit, qty, expiry_date FROM products WHERE room = ? AND rack = ? ORDER BY product_id')
    .all(room, rack);
  res.json(products);
});

module.exports = router;
