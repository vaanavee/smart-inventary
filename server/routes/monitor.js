const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MONITOR_SERVICE_URL = process.env.MONITOR_SERVICE_URL || 'http://127.0.0.1:5001';

router.get('/live', requireAdmin, async (req, res) => {
  const current = db
    .prepare(
      `SELECT date, entry_time, employee_name, emp_id, rfid_tag, room
       FROM room_entries WHERE exit_time IS NULL ORDER BY entry_time`
    )
    .all();

  const employees = current.map((session) => {
    const latestDetection = db
      .prepare('SELECT tracking_id, confidence, time FROM detections WHERE emp_id = ? ORDER BY id DESC LIMIT 1')
      .get(session.emp_id);
    return {
      ...session,
      status: 'Present',
      tracking_id: latestDetection ? latestDetection.tracking_id : null,
      confidence: latestDetection ? latestDetection.confidence : null,
    };
  });

  let cameraStatus = 'offline';
  try {
    const health = await fetch(`${MONITOR_SERVICE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    cameraStatus = health.ok ? 'online' : 'offline';
  } catch {
    cameraStatus = 'offline';
  }

  res.json({
    employees,
    cameraStatus,
    detectionCount: employees.length,
  });
});

// The monitor AI service reports each tracking-to-employee assignment here
// (not every frame - only on meaningful changes) so /live can show tracking
// ID + confidence per employee.
router.post('/detections', (req, res) => {
  const { tracking_id, emp_id, confidence, room } = req.body || {};
  if (tracking_id === undefined || !room) {
    return res.status(400).json({ error: 'tracking_id and room are required' });
  }
  const time = new Date().toISOString();
  db.prepare('INSERT INTO detections (tracking_id, emp_id, confidence, room, time) VALUES (?, ?, ?, ?, ?)').run(
    tracking_id,
    emp_id || null,
    confidence ?? null,
    room,
    time
  );
  res.status(201).json({ ok: true });
});

module.exports = router;
