const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ROOMS = ['Room 1', 'Room 2', 'Room 3'];
const RACKS = ['A', 'B', 'C', 'D', 'E'];

// Deliberately mismatched rack, standing in for a camera that flagged a discrepancy
// against the recorded quantity (no real YOLO/CNN pipeline is wired up).
const SIMULATED_MISMATCH = { room: 'Room 2', rack: 'D', delta: -3 };

router.get('/overview', requireAdmin, async (req, res) => {
  const cameras = [];
  
  // Fetch actual detections from Python microservice
  let aiDetections = {};
  let peopleCounts = {};
  try {
    const aiResponse = await fetch('http://127.0.0.1:5000/api/detect');
    if (aiResponse.ok) {
      const data = await aiResponse.json();
      data.detections.forEach(d => {
        if (d.count !== null) {
          aiDetections[`${d.room}-${d.rack}`] = d.count;
        }
      });
      peopleCounts = data.people_counts || {};
    }
  } catch (err) {
    console.error("Could not reach Python CV service. Make sure it's running on port 5000.");
  }

  ROOMS.forEach((room) => {
    // YOLO Person Detection logic
    const personCount = peopleCounts[room] || 0;
    let identifiedEmployee = null;

    if (personCount > 0) {
      // Find the last person to scan into this room who hasn't exited (or just the most recent entry)
      const lastEntry = db.prepare(
        `SELECT employee_name FROM room_entries WHERE room = ? ORDER BY date DESC, entry_time DESC LIMIT 1`
      ).get(room);
      
      if (lastEntry) {
        identifiedEmployee = lastEntry.employee_name;
      }
    }

    RACKS.forEach((rack) => {
      const { count: recordedCount, qty: recordedQty } = db
        .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(qty), 0) AS qty FROM products WHERE room = ? AND rack = ?')
        .get(room, rack);

      // Use AI count if available, otherwise fallback to recorded quantity
      const aiCount = aiDetections[`${room}-${rack}`] !== undefined ? aiDetections[`${room}-${rack}`] : recordedQty;

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
        personDetected: personCount > 0,
        identifiedEmployee: identifiedEmployee
      });
    });
  });

  res.json({ simulated: false, cameras });
});

module.exports = router;
