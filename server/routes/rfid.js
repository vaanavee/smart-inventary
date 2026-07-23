const express = require('express');
const db = require('../db');
const { roomEntryEvents } = require('../events');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');

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

// Rack visits are usually far shorter than a room stay, so rack timestamps keep
// seconds (HH:MM:SS) and their duration is rendered as "45s" / "3m 20s" instead
// of rounding a 40-second pick down to the "0 mins" that HH:MM would produce.
function fmtTimeSec(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function secondsBetween(a, b) {
  // Tolerates legacy HH:MM values (seconds default to 0) alongside HH:MM:SS.
  const [ah = 0, am = 0, as = 0] = a.split(':').map(Number);
  const [bh = 0, bm = 0, bs = 0] = b.split(':').map(Number);
  return bh * 3600 + bm * 60 + bs - (ah * 3600 + am * 60 + as);
}

function humanDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Explicit RFID entry, meant for the ESP32 EntranceUnit's own login tap
// (it already tracks tap-1=login/tap-2=logout itself, so it can call
// checkin/checkout directly instead of the toggle-based /room-entries/scan).
router.post(
  '/checkin',
  asyncHandler(async (req, res) => {
    const { empId, rfidTag, room } = req.body || {};
    if ((!empId && !rfidTag) || !room) {
      return res.status(400).json({ error: 'empId or rfidTag, and room, are required' });
    }

    const employee = empId
      ? await db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(empId)
      : await db.prepare('SELECT * FROM employees WHERE rfid_tag = ?').get(rfidTag);
    if (!employee) return res.status(404).json({ error: 'Unknown employee/RFID tag' });

    const existingOpen = await db
      .prepare('SELECT * FROM room_entries WHERE emp_id = ? AND (exit_time IS NULL OR exit_time = \'\') ORDER BY id DESC LIMIT 1')
      .get(employee.emp_id);
    if (existingOpen) {
      return res.status(409).json({ error: `${employee.name} already has an open session in ${existingOpen.room}` });
    }

    const now = new Date();
    const today = fmt(now);
    const time = fmtTime(now);

    await db.prepare(
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
  })
);

// Explicit RFID exit.
router.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const { empId, rfidTag } = req.body || {};
    if (!empId && !rfidTag) {
      return res.status(400).json({ error: 'empId or rfidTag is required' });
    }

    const employee = empId
      ? await db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(empId)
      : await db.prepare('SELECT * FROM employees WHERE rfid_tag = ?').get(rfidTag);
    if (!employee) return res.status(404).json({ error: 'Unknown employee/RFID tag' });

    const open = await db
      .prepare('SELECT * FROM room_entries WHERE emp_id = ? AND (exit_time IS NULL OR exit_time = \'\') ORDER BY id DESC LIMIT 1')
      .get(employee.emp_id);
    if (!open) return res.status(409).json({ error: `${employee.name} has no open session` });

    const now = new Date();
    const time = fmtTime(now);
    const duration = `${minutesBetween(open.entry_time, time)} mins`;
    await db.prepare('UPDATE room_entries SET exit_time = ?, duration = ?, status = ? WHERE id = ?').run(
      time,
      duration,
      'Completed',
      open.id
    );

    // Leaving the room means you are no longer standing at a rack, so close any
    // rack session this employee left open. Without this a worker who taps a
    // rack and then walks out stays "At Rack" forever, and their next tap at
    // that rack would be read as the logoff of a stale session.
    const rackExit = fmtTimeSec(now);
    const openRacks = await db
      .prepare(
        `SELECT * FROM rack_scans
         WHERE emp_id = ? AND (exit_time IS NULL OR exit_time = '')`
      )
      .all(employee.emp_id);
    for (const rackSession of openRacks) {
      await db
        .prepare('UPDATE rack_scans SET exit_time = ?, duration = ?, status = ? WHERE id = ?')
        .run(
          rackExit,
          humanDuration(secondsBetween(rackSession.time, rackExit)),
          'Closed on exit',
          rackSession.id
        );
    }

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
  })
);

// RackUnit ESP32: RFID tap at a specific rack. Only accepted if the employee
// already has an open entrance session - a tap from someone not checked in
// is rejected (403), not silently recorded, so rack activity always traces
// back to a real entrance scan.
//
// A tap TOGGLES a rack session, mirroring the entrance reader: the first tap
// opens one ("At Rack", HTTP 201) and the employee's next tap at that same
// rack closes it with an exit time + duration ("Completed", HTTP 200). The
// firmware branches on `action` in the response to show login vs logoff.
router.post(
  '/rack-scan',
  asyncHandler(async (req, res) => {
    const { rfidTag, rack, room } = req.body || {};
    if (!rfidTag || !rack || !room) {
      return res.status(400).json({ error: 'rfidTag, rack, and room are required' });
    }

    const employee = await db.prepare('SELECT * FROM employees WHERE rfid_tag = ?').get(rfidTag);
    if (!employee) return res.status(404).json({ error: 'Unknown RFID tag' });

    const openSession = await db
      .prepare('SELECT * FROM room_entries WHERE emp_id = ? AND (exit_time IS NULL OR exit_time = \'\') ORDER BY id DESC LIMIT 1')
      .get(employee.emp_id);
    if (!openSession) {
      return res.status(403).json({ error: `${employee.name} is not checked in - tap the entrance reader first` });
    }

    const now = new Date();
    const today = fmt(now);
    const time = fmtTimeSec(now);

    const employeePayload = {
      name: employee.name,
      emp_id: employee.emp_id,
      department: employee.department,
    };

    // Is this employee already standing at this exact rack?
    const openRack = await db
      .prepare(
        `SELECT * FROM rack_scans
         WHERE emp_id = ? AND room = ? AND rack = ? AND (exit_time IS NULL OR exit_time = '')
         ORDER BY id DESC LIMIT 1`
      )
      .get(employee.emp_id, room, rack);

    if (openRack) {
      const duration = humanDuration(secondsBetween(openRack.time, time));
      await db
        .prepare('UPDATE rack_scans SET exit_time = ?, duration = ?, status = ? WHERE id = ?')
        .run(time, duration, 'Completed', openRack.id);

      return res.json({
        action: 'rack-logout',
        employee: employeePayload,
        room,
        rack,
        entry_time: openRack.time,
        exit_time: time,
        duration,
        status: 'Completed',
      });
    }

    await db.prepare(
      `INSERT INTO rack_scans (date, emp_id, employee_name, rfid_tag, room, rack, time, exit_time, duration, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'At Rack')`
    ).run(today, employee.emp_id, employee.name, employee.rfid_tag, room, rack, time);

    res.status(201).json({
      action: 'rack-login',
      employee: employeePayload,
      room,
      rack,
      time,
      entry_time: time,
      status: 'At Rack',
    });
  })
);

// Admin/dashboard: recent rack sessions, newest first, each paired with the
// products actually stocked on that room+rack so a tap shows "what's here"
// (Stock Monitoring tab polls this to reflect a tap almost immediately).
// Rows carry exit_time/duration/status, so a still-open session reads as
// "At Rack" and a closed one shows how long the worker spent there.
router.get(
  '/rack-scans',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const scans = await db.prepare('SELECT * FROM rack_scans ORDER BY id DESC LIMIT ?').all(limit);

    // Match the rack tolerantly. A reader configured with a human label like
    // "Rack 1" should still resolve products filed under just "1", and casing
    // shouldn't matter - otherwise a cosmetic naming difference silently shows
    // every rack as holding no stock.
    const productsByLocation = db.prepare(
      `SELECT * FROM products
       WHERE room = ? AND (UPPER(rack) = UPPER(?) OR UPPER(rack) = UPPER(?))`
    );
    const withProducts = [];
    for (const scan of scans) {
      const bareRack = String(scan.rack || '').replace(/^rack\s+/i, '');
      withProducts.push({
        ...scan,
        products: await productsByLocation.all(scan.room, scan.rack, bareRack),
      });
    }

    res.json(withProducts);
  })
);

const devices = {};

// A device is considered offline once it misses ~4 heartbeats (units beat
// every 30s). Kept as a named constant because both the status sweep below
// and the `staleFor` field reported to the dashboard depend on it.
const DEVICE_OFFLINE_AFTER_MS = 120000;

// Register or update device connection status & IP. Both the EntranceUnit and
// the RackUnit call this; `rack` and `deviceType` let the dashboard tell them
// apart and label a rack reader with the rack it actually guards.
router.post('/heartbeat', (req, res) => {
  const { deviceName, room, ip, rack, deviceType } = req.body || {};
  if (!deviceName) {
    return res.status(400).json({ error: 'deviceName is required' });
  }

  let clientIp = ip || req.ip || req.socket.remoteAddress || '';
  if (clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  devices[deviceName] = {
    name: deviceName,
    ip: clientIp,
    room: room || 'Unknown',
    rack: rack || null,
    // Fall back to inferring the type from the name so an older EntranceUnit
    // build that doesn't send deviceType yet still lands in the right bucket.
    deviceType: deviceType || (/rack/i.test(deviceName) ? 'rack' : 'entrance'),
    lastSeen: Date.now(),
    status: 'Online',
  };

  res.json({ ok: true, registeredIp: clientIp });
});

// Retrieve status and IP address of all devices
router.get('/device-status', (req, res) => {
  const now = Date.now();
  for (const name in devices) {
    const device = devices[name];
    device.status = now - device.lastSeen > DEVICE_OFFLINE_AFTER_MS ? 'Offline' : 'Online';
    // Seconds since the last beat, so the dashboard can show "3s ago" without
    // depending on the browser clock agreeing with the server's.
    device.staleFor = Math.round((now - device.lastSeen) / 1000);
  }
  res.json({ devices });
});

module.exports = router;
