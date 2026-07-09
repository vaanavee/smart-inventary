const express = require('express');
const db = require('../db');
const { roomEntryEvents } = require('../events');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function minutesBetween(a, b) {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

// Explicit RFID entry, meant for the ESP32 EntranceUnit's own login tap
// (it already tracks tap-1=login/tap-2=logout itself, so it can call
// checkin/checkout directly instead of the toggle-based /room-entries/scan).
router.post('/checkin', (req, res) => {
  const { empId, rfidTag, room } = req.body || {};
  if ((!empId && !rfidTag) || !room) {
    return res.status(400).json({ error: 'empId or rfidTag, and room, are required' });
  }

  const employee = empId
    ? db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(empId)
    : db.prepare('SELECT * FROM employees WHERE rfid_tag = ?').get(rfidTag);
  if (!employee) return res.status(404).json({ error: 'Unknown employee/RFID tag' });

  const existingOpen = db
    .prepare('SELECT * FROM room_entries WHERE emp_id = ? AND exit_time IS NULL ORDER BY id DESC LIMIT 1')
    .get(employee.emp_id);
  if (existingOpen) {
    return res.status(409).json({ error: `${employee.name} already has an open session in ${existingOpen.room}` });
  }

  const now = new Date();
  const today = fmt(now);
  const time = fmtTime(now);

  db.prepare(
    `INSERT INTO room_entries (date, emp_id, employee_name, rfid_tag, room, entry_time, exit_time, duration, status)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'In Room')`
  ).run(today, employee.emp_id, employee.name, employee.rfid_tag, room, time);

  const payload = {
    action: 'entry',
    employee: { name: employee.name, emp_id: employee.emp_id, department: employee.department },
    room,
    entry_time: time,
  };
  roomEntryEvents.emit('entry', payload);
  res.json(payload);
});

// Explicit RFID exit.
router.post('/checkout', (req, res) => {
  const { empId, rfidTag } = req.body || {};
  if (!empId && !rfidTag) {
    return res.status(400).json({ error: 'empId or rfidTag is required' });
  }

  const employee = empId
    ? db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(empId)
    : db.prepare('SELECT * FROM employees WHERE rfid_tag = ?').get(rfidTag);
  if (!employee) return res.status(404).json({ error: 'Unknown employee/RFID tag' });

  const open = db
    .prepare('SELECT * FROM room_entries WHERE emp_id = ? AND exit_time IS NULL ORDER BY id DESC LIMIT 1')
    .get(employee.emp_id);
  if (!open) return res.status(409).json({ error: `${employee.name} has no open session` });

  const time = fmtTime(new Date());
  const duration = `${minutesBetween(open.entry_time, time)} mins`;
  db.prepare('UPDATE room_entries SET exit_time = ?, duration = ?, status = ? WHERE id = ?').run(
    time,
    duration,
    'Completed',
    open.id
  );

  const payload = {
    action: 'exit',
    employee: { name: employee.name, emp_id: employee.emp_id, department: employee.department },
    room: open.room,
    entry_time: open.entry_time,
    exit_time: time,
    duration,
  };
  roomEntryEvents.emit('entry', payload);
  res.json(payload);
});

// RackUnit ESP32: RFID tap at a specific rack. Only accepted if the employee
// already has an open entrance session - a tap from someone not checked in
// is rejected (403), not silently recorded, so rack activity always traces
// back to a real entrance scan.
router.post('/rack-scan', (req, res) => {
  const { rfidTag, rack, room } = req.body || {};
  if (!rfidTag || !rack || !room) {
    return res.status(400).json({ error: 'rfidTag, rack, and room are required' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE rfid_tag = ?').get(rfidTag);
  if (!employee) return res.status(404).json({ error: 'Unknown RFID tag' });

  const openSession = db
    .prepare('SELECT * FROM room_entries WHERE emp_id = ? AND exit_time IS NULL ORDER BY id DESC LIMIT 1')
    .get(employee.emp_id);
  if (!openSession) {
    return res.status(403).json({ error: `${employee.name} is not checked in - tap the entrance reader first` });
  }

  const now = new Date();
  const today = fmt(now);
  const time = fmtTime(now);

  db.prepare(
    `INSERT INTO rack_scans (date, emp_id, employee_name, rfid_tag, room, rack, time)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(today, employee.emp_id, employee.name, employee.rfid_tag, room, rack, time);

  res.status(201).json({
    employee: { name: employee.name, emp_id: employee.emp_id, department: employee.department },
    room,
    rack,
    time,
  });
});

// Admin/dashboard: recent rack taps, newest first, each paired with the
// products actually stocked on that room+rack so a tap shows "what's here"
// (Stock Monitoring tab polls this to reflect a tap almost immediately).
router.get('/rack-scans', requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const scans = db
    .prepare('SELECT * FROM rack_scans ORDER BY id DESC LIMIT ?')
    .all(limit);

  const productsByLocation = db.prepare('SELECT * FROM products WHERE room = ? AND rack = ?');
  const withProducts = scans.map((scan) => ({
    ...scan,
    products: productsByLocation.all(scan.room, scan.rack),
  }));

  res.json(withProducts);
});

const devices = {};

// Register or update device connection status & IP
router.post('/heartbeat', (req, res) => {
  const { deviceName, room, ip } = req.body || {};
  if (!deviceName) {
    return res.status(400).json({ error: 'deviceName is required' });
  }

  let clientIp = ip || req.ip || req.socket.remoteAddress;
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  devices[deviceName] = {
    ip: clientIp,
    room: room || 'Unknown',
    lastSeen: Date.now(),
    status: 'Online'
  };

  res.json({ ok: true, registeredIp: clientIp });
});

// Retrieve status and IP address of all devices
router.get('/device-status', (req, res) => {
  const now = Date.now();
  for (const name in devices) {
    if (now - devices[name].lastSeen > 120000) {
      devices[name].status = 'Offline';
    }
  }
  res.json({ devices });
});

module.exports = router;
