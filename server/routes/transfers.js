const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Admin/dashboard: box transfers for a given date (defaults to today).
router.get('/', requireAdmin, (req, res) => {
  const date = req.query.date || fmt(new Date());
  const rows = db
    .prepare(
      `SELECT id, date, emp_id, employee_name, from_room, to_room, product_id, product_name,
              start_time, end_time, source, status
       FROM box_transfers WHERE date = ? ORDER BY start_time DESC, id DESC`
    )
    .all(date);
  res.json(rows);
});

// Monitor AI service: record a detected box transfer (room A -> room B while an
// employee was carrying a box). Left unauthenticated to match /monitor/detections,
// which the same service posts to without a token.
router.post('/', (req, res) => {
  const {
    emp_id,
    employee_name,
    from_room,
    to_room,
    product_id,
    product_name,
    start_time,
    end_time,
    source,
    status,
  } = req.body || {};

  if (!from_room || !to_room) {
    return res.status(400).json({ error: 'from_room and to_room are required' });
  }

  const now = new Date();
  db.prepare(
    `INSERT INTO box_transfers (date, emp_id, employee_name, from_room, to_room, product_id, product_name, start_time, end_time, source, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fmt(now),
    emp_id || null,
    employee_name || null,
    from_room,
    to_room,
    product_id || null,
    product_name || null,
    start_time || null,
    end_time || null,
    source || 'vision',
    status || 'Completed'
  );

  res.status(201).json({ ok: true });
});

module.exports = router;
