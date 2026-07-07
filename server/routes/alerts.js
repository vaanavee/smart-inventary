const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// The monitor AI service reports unauthorized/unknown-person events here.
router.post('/', (req, res) => {
  const { type, person, room, time, status } = req.body || {};
  if (!type || !room) {
    return res.status(400).json({ error: 'type and room are required' });
  }
  const ts = time || new Date().toISOString();
  const result = db
    .prepare('INSERT INTO alerts (type, person, room, time, status) VALUES (?, ?, ?, ?, ?)')
    .run(type, person || null, room, ts, status || 'open');

  res.status(201).json({ id: result.lastInsertRowid, type, person: person || null, room, time: ts, status: status || 'open' });
});

router.get('/', requireAdmin, (req, res) => {
  const { limit = 50 } = req.query;
  const rows = db
    .prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ?')
    .all(Number(limit));
  res.json(rows);
});

module.exports = router;
