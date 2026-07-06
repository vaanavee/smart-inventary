const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];
const RACKS = ['A', 'B', 'C', 'D', 'E'];

// Deliberately mismatched rack, standing in for a camera that flagged a discrepancy
// against the recorded quantity (no real YOLO/CNN pipeline is wired up).
const SIMULATED_MISMATCH = { room: 'Room 2', rack: 'D', delta: -3 };

router.get('/overview', requireAdmin, (req, res) => {
  const cameras = [];

  ROOMS.forEach((room) => {
    RACKS.forEach((rack) => {
      const { count: recordedCount, qty: recordedQty } = db
        .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(qty), 0) AS qty FROM products WHERE room = ? AND rack = ?')
        .get(room, rack);

      const isMismatch = SIMULATED_MISMATCH.room === room && SIMULATED_MISMATCH.rack === rack;
      const aiCount = isMismatch ? recordedQty + SIMULATED_MISMATCH.delta : recordedQty;

      const lastActivity = db
        .prepare(
          `SELECT date, entry_time, employee_name, action, product_name FROM movements
           WHERE room = ? AND rack = ? ORDER BY date DESC, entry_time DESC LIMIT 1`
        )
        .get(room, rack);

      cameras.push({
        room,
        rack,
        productTypes: recordedCount,
        recordedQty,
        aiCount,
        status: aiCount === recordedQty ? 'match' : 'mismatch',
        lastActivity: lastActivity || null,
      });
    });
  });

  res.json({ simulated: true, cameras });
});

module.exports = router;
