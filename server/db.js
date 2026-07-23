const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smart_inventary',
});

// Route files were written against a SQLite-style `?` placeholder API
// (db.prepare(sql).get/all/run(...params)). Rather than rewrite every query
// string to Postgres's $1/$2 syntax, this shim converts `?` -> $n internally
// so only the route handlers need to become async/await - the SQL text stays
// identical to before.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function prepare(sql) {
  const pgSql = toPgSql(sql);
  return {
    async get(...params) {
      const { rows } = await pool.query(pgSql, params);
      return rows[0];
    },
    async all(...params) {
      const { rows } = await pool.query(pgSql, params);
      return rows;
    },
    async run(...params) {
      const result = await pool.query(pgSql, params);
      return { changes: result.rowCount, rows: result.rows };
    },
  };
}

async function exec(sql) {
  await pool.query(sql);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  emp_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  rfid_tag TEXT UNIQUE NOT NULL,
  department TEXT,
  shift TEXT,
  password_hash TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  product_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  rack TEXT NOT NULL,
  unit TEXT,
  qty INTEGER NOT NULL,
  expiry_date TEXT
);

CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  room TEXT NOT NULL,
  rack TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entry_time TEXT,
  exit_time TEXT,
  duration TEXT,
  status TEXT NOT NULL
);

-- Added for manually-logged stock placements (Verification page "Manual Entry"
-- tab) alongside the RFID/vision-tracked rows already in this table.
ALTER TABLE movements ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE movements ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS room_entries (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  rfid_tag TEXT NOT NULL,
  room TEXT NOT NULL,
  entry_time TEXT NOT NULL,
  exit_time TEXT,
  duration TEXT,
  status TEXT NOT NULL
);

-- Latest AI-tracked identity assignment per employee (Phase 2: live monitoring).
CREATE TABLE IF NOT EXISTS detections (
  id SERIAL PRIMARY KEY,
  tracking_id INTEGER NOT NULL,
  emp_id TEXT,
  confidence REAL,
  room TEXT NOT NULL,
  time TEXT NOT NULL
);

-- Unauthorized/unknown-person events reported by the monitor AI service.
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  person TEXT,
  room TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

-- Box moved between rooms by an employee, detected by the monitor AI service
-- (vision "carrying a box" + RFID room transition). product_* stays null until
-- resolved (e.g. by pairing with a scanned product QR).
CREATE TABLE IF NOT EXISTS box_transfers (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  emp_id TEXT,
  employee_name TEXT,
  from_room TEXT NOT NULL,
  to_room TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  start_time TEXT,
  end_time TEXT,
  source TEXT NOT NULL DEFAULT 'vision',
  status TEXT NOT NULL DEFAULT 'Completed'
);

-- RFID tap logged at a rack reader (RackUnit ESP32). Requires the employee to
-- already have an open room_entries session (they must be checked in via the
-- EntranceUnit first) - a tap from someone not checked in is rejected, not
-- silently logged.
CREATE TABLE IF NOT EXISTS rack_scans (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  emp_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  rfid_tag TEXT NOT NULL,
  room TEXT NOT NULL,
  rack TEXT NOT NULL,
  time TEXT NOT NULL
);

-- A rack tap is now a SESSION, not a one-shot event: the first tap at a rack
-- opens a row (status 'At Rack'), the next tap by the same employee at the
-- same rack closes it with an exit_time + duration (status 'Completed').
-- The time column keeps its original meaning as the login/arrival time, so
-- existing rows stay valid and simply read as still-open sessions until closed.
ALTER TABLE rack_scans ADD COLUMN IF NOT EXISTS exit_time TEXT;
ALTER TABLE rack_scans ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE rack_scans ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'At Rack';
`;

// Demo-only default password for every seeded employee (EMP001-EMP005), so
// Phase 1's employee login has something to authenticate against. This is
// NOT a production credential scheme - real deployments should require each
// employee to set their own password.
const DEFAULT_EMPLOYEE_PASSWORD = process.env.DEFAULT_EMPLOYEE_PASSWORD || 'employee123';

async function seedIfEmpty() {
  const { rows: [{ c: adminCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM admins');
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(password, 10);
    await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1, $2)', [username, hash]);
  }

  const { rows: [{ c: empCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM employees');
  if (empCount === 0) {
    const defaultHash = bcrypt.hashSync(DEFAULT_EMPLOYEE_PASSWORD, 10);
    const employees = [
      ['EMP001', 'Akash', 'RFID1001', 'Inventory', '09:00-03:00'],
      ['EMP002', 'Rahul', 'RFID1002', 'Warehouse', '09:00-03:00'],
      ['EMP003', 'Arjun', 'RFID1003', 'Stock Control', '09:00-03:00'],
      ['EMP004', 'Priya', 'RFID1004', 'Packing', '09:00-03:00'],
      ['EMP005', 'Karthik', 'RFID1005', 'Logistics', '09:00-03:00'],
    ];
    for (const r of employees) {
      await pool.query(
        'INSERT INTO employees (emp_id, name, rfid_tag, department, shift, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
        [...r, defaultHash]
      );
    }
  } else {
    // Backfill password_hash for employees seeded before this column existed.
    const { rows: missingPassword } = await pool.query('SELECT emp_id FROM employees WHERE password_hash IS NULL');
    if (missingPassword.length > 0) {
      const defaultHash = bcrypt.hashSync(DEFAULT_EMPLOYEE_PASSWORD, 10);
      for (const row of missingPassword) {
        await pool.query('UPDATE employees SET password_hash = $1 WHERE emp_id = $2', [defaultHash, row.emp_id]);
      }
    }
  }

  // Real physical RFID cards (from the RFID_Attendance_Standalone sketch) mapped
  // to actual employees, so EntranceUnit.ino's checkin/checkout taps resolve to a
  // known employee instead of 404ing. Upserted by rfid_tag every startup (not
  // gated on empCount===0) so it still runs after the initial EMP001-005 seed.
  const realCardHolders = [
    ['EMP101', 'Vishali', '4E500E06', 'Inventory', '09:00-03:00'],
    ['EMP102', 'Suraj', 'CC392B1F', 'Warehouse', '09:00-03:00'],
    ['EMP103', 'Vishal', 'B3122A22', 'Stock Control', '09:00-03:00'],
    ['EMP104', 'Vaanavee', '0EB46F06', 'Packing', '09:00-03:00'],
  ];
  const realEmployeeHash = bcrypt.hashSync(DEFAULT_EMPLOYEE_PASSWORD, 10);
  for (const r of realCardHolders) {
    await pool.query(
      `INSERT INTO employees (emp_id, name, rfid_tag, department, shift, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rfid_tag) DO NOTHING`,
      [...r, realEmployeeHash]
    );
  }

  const { rows: [{ c: productCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM products');
  if (productCount === 0) {
    const products = [
      // Room 1 - Stationery
      ['ST001', 'A4 Paper Bundle', 'Room 1', 'A', 'Pack', 120, null],
      ['ST002', 'Ball Pen (Blue)', 'Room 1', 'A', 'Box', 250, null],
      ['ST003', 'Pencil HB', 'Room 1', 'A', 'Box', 180, null],
      ['ST004', 'Permanent Marker', 'Room 1', 'B', 'Box', 75, null],
      ['ST005', 'Highlighter Set', 'Room 1', 'B', 'Pack', 60, null],
      ['ST006', 'Sticky Notes', 'Room 1', 'B', 'Pack', 90, null],
      ['ST007', 'Notebook A5', 'Room 1', 'C', 'Piece', 150, null],
      ['ST008', 'File Folder', 'Room 1', 'C', 'Piece', 95, null],
      ['ST009', 'Stapler', 'Room 1', 'D', 'Piece', 40, null],
      ['ST010', 'Staple Pins', 'Room 1', 'D', 'Box', 140, null],
      ['ST011', 'Glue Stick', 'Room 1', 'E', 'Piece', 85, '2026-12-15'],
      ['ST012', 'White Glue', 'Room 1', 'E', 'Bottle', 55, '2027-01-20'],
      // Room 2 - Craft Materials
      ['CR001', 'Color Paper Pack', 'Room 2', 'A', 'Pack', 110, null],
      ['CR002', 'Foam Sheets', 'Room 2', 'A', 'Pack', 95, null],
      ['CR003', 'Glitter Paper', 'Room 2', 'A', 'Pack', 80, null],
      ['CR004', 'Craft Scissors', 'Room 2', 'B', 'Piece', 45, null],
      ['CR005', 'Decorative Tape', 'Room 2', 'B', 'Roll', 125, null],
      ['CR006', 'Satin Ribbon', 'Room 2', 'C', 'Roll', 180, null],
      ['CR007', 'Jute Rope', 'Room 2', 'C', 'Roll', 70, null],
      ['CR008', 'Artificial Flowers', 'Room 2', 'D', 'Bundle', 90, null],
      ['CR009', 'Hot Glue Gun', 'Room 2', 'D', 'Piece', 20, null],
      ['CR010', 'Glue Sticks (Hot Melt)', 'Room 2', 'E', 'Pack', 150, '2027-03-05'],
      ['CR011', 'Wooden Ice Cream Sticks', 'Room 2', 'E', 'Pack', 130, null],
      ['CR012', 'Colored Beads', 'Room 2', 'E', 'Box', 75, null],
      // Room 3 - Decoration Products
      ['DC001', 'LED Fairy Lights', 'Room 3', 'A', 'Box', 65, null],
      ['DC002', 'Balloon Pack', 'Room 3', 'A', 'Pack', 220, '2026-12-10'],
      ['DC003', 'Birthday Banner', 'Room 3', 'A', 'Piece', 80, null],
      ['DC004', 'Party Streamers', 'Room 3', 'B', 'Roll', 160, null],
      ['DC005', 'Gift Wrapping Paper', 'Room 3', 'B', 'Roll', 130, null],
      ['DC006', 'Gift Boxes', 'Room 3', 'C', 'Piece', 95, null],
      ['DC007', 'Decorative Candles', 'Room 3', 'C', 'Box', 70, '2027-01-15'],
      ['DC008', 'Artificial Garland', 'Room 3', 'D', 'Piece', 45, null],
      ['DC009', 'Thermocol Letters', 'Room 3', 'D', 'Set', 55, null],
      ['DC010', 'Acrylic Paint Set', 'Room 3', 'E', 'Box', 60, '2027-05-18'],
      ['DC011', 'Paint Brushes Set', 'Room 3', 'E', 'Set', 90, null],
      ['DC012', 'Decorative Stickers', 'Room 3', 'E', 'Pack', 175, null],
    ];
    for (const r of products) {
      await pool.query(
        'INSERT INTO products (product_id, name, room, rack, unit, qty, expiry_date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        r
      );
    }
  }

  const { rows: [{ c: movementCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM movements');
  if (movementCount === 0) {
    // Each employee patrols every rack (A-E) of their home room across the 9:00-3:00 shift,
    // so a full shift produces 5 RFID in/out events per employee per day.
    const RACK_PRODUCT = {
      'Room 1': { A: ['ST001', 'A4 Paper Bundle'], B: ['ST004', 'Permanent Marker'], C: ['ST007', 'Notebook A5'], D: ['ST009', 'Stapler'], E: ['ST011', 'Glue Stick'] },
      'Room 2': { A: ['CR001', 'Color Paper Pack'], B: ['CR004', 'Craft Scissors'], C: ['CR006', 'Satin Ribbon'], D: ['CR008', 'Artificial Flowers'], E: ['CR010', 'Glue Sticks (Hot Melt)'] },
      'Room 3': { A: ['DC002', 'Balloon Pack'], B: ['DC004', 'Party Streamers'], C: ['DC006', 'Gift Boxes'], D: ['DC008', 'Artificial Garland'], E: ['DC010', 'Acrylic Paint Set'] },
    };

    const employeeSchedule = [
      { emp: 'EMP001', name: 'Akash', room: 'Room 1', rackOrder: ['A', 'B', 'C', 'D', 'E'], times: ['09:05', '10:10', '11:20', '12:40', '14:10'] },
      { emp: 'EMP002', name: 'Rahul', room: 'Room 1', rackOrder: ['C', 'D', 'E', 'A', 'B'], times: ['09:15', '10:25', '11:40', '12:55', '14:20'] },
      { emp: 'EMP003', name: 'Arjun', room: 'Room 2', rackOrder: ['B', 'C', 'D', 'E', 'A'], times: ['09:10', '10:30', '11:45', '13:00', '14:15'] },
      { emp: 'EMP004', name: 'Priya', room: 'Room 3', rackOrder: ['A', 'C', 'E', 'B', 'D'], times: ['09:20', '10:35', '11:50', '13:10', '14:25'] },
      { emp: 'EMP005', name: 'Karthik', room: 'Room 3', rackOrder: ['D', 'E', 'A', 'C', 'B'], times: ['09:25', '10:40', '12:00', '13:20', '14:30'] },
    ];
    const durations = [5, 7, 4, 6, 8]; // minutes, one per slot

    function addMinutes(hhmm, mins) {
      const [h, m] = hhmm.split(':').map(Number);
      const total = h * 60 + m + mins;
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    // Source log spans 30-06-2026 through today - RFID events only exist once an
    // employee has actually scanned in, so future dates get no rows at all.
    const today = '2026-07-05';
    const logDates = ['2026-06-30', ...Array.from({ length: 10 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)].filter(
      (date) => date <= today
    );

    for (const date of logDates) {
      for (const employee of employeeSchedule) {
        for (let slot = 0; slot < employee.rackOrder.length; slot++) {
          const rack = employee.rackOrder[slot];
          const [productId, productName] = RACK_PRODUCT[employee.room][rack];
          const entry = employee.times[slot];
          const duration = durations[slot];
          const isLastSlot = slot === employee.rackOrder.length - 1;

          let exit = addMinutes(entry, duration);
          let durationLabel = `${duration} mins`;
          let status = 'Completed';

          if (date === today && employee.emp === 'EMP003' && isLastSlot) {
            // Arjun's most recent scan today hasn't been checked out yet.
            exit = null;
            durationLabel = null;
            status = 'In Progress';
          }

          await pool.query(
            `INSERT INTO movements (date, emp_id, employee_name, room, rack, product_id, product_name, action, entry_time, exit_time, duration, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              date,
              employee.emp,
              employee.name,
              employee.room,
              rack,
              productId,
              productName,
              slot % 2 === 0 ? 'Taken' : 'Placed',
              entry,
              exit,
              durationLabel,
              status,
            ]
          );
        }
      }
    }
  }

  const { rows: [{ c: roomEntryCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM room_entries');
  if (roomEntryCount === 0) {
    // Each employee's door-scan brackets their rack tour for the day (a few minutes
    // before their first rack visit to a few minutes after their last).
    const roster = [
      { emp: 'EMP001', name: 'Akash', rfid: 'RFID1001', room: 'Room 1', in: '08:58', out: '14:18' },
      { emp: 'EMP002', name: 'Rahul', rfid: 'RFID1002', room: 'Room 1', in: '09:08', out: '14:28' },
      { emp: 'EMP003', name: 'Arjun', rfid: 'RFID1003', room: 'Room 2', in: '09:03', out: '14:22' },
      { emp: 'EMP004', name: 'Priya', rfid: 'RFID1004', room: 'Room 3', in: '09:13', out: '14:38' },
      { emp: 'EMP005', name: 'Karthik', rfid: 'RFID1005', room: 'Room 3', in: '09:18', out: '14:43' },
    ];

    const today = '2026-07-05';
    const logDates = ['2026-06-30', ...Array.from({ length: 10 }, (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`)].filter(
      (date) => date <= today
    );

    function minutesBetween(a, b) {
      const [ah, am] = a.split(':').map(Number);
      const [bh, bm] = b.split(':').map(Number);
      return bh * 60 + bm - (ah * 60 + am);
    }

    for (const date of logDates) {
      for (const person of roster) {
        let exit = person.out;
        let duration = `${minutesBetween(person.in, person.out)} mins`;
        let status = 'Completed';

        if (date === today && person.emp === 'EMP003') {
          // Arjun is still inside Room 2 (matches his open rack scan today).
          exit = null;
          duration = null;
          status = 'In Room';
        }

        await pool.query(
          `INSERT INTO room_entries (date, emp_id, employee_name, rfid_tag, room, entry_time, exit_time, duration, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [date, person.emp, person.name, person.rfid, person.room, person.in, exit, duration, status]
        );
      }
    }
  }

  // A few demo box transfers so the dashboard's Box Transfers view has data
  // before the vision model is trained. Real transfers are inserted live by the
  // monitor AI service via POST /api/transfers.
  const { rows: [{ c: transferCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM box_transfers');
  if (transferCount === 0) {
    const today = '2026-07-05';
    const demo = [
      [today, 'EMP001', 'Akash', 'Room 1', 'Room 2', 'ST001', 'A4 Paper Bundle', '10:12', '10:15', 'vision+qr', 'Completed'],
      [today, 'EMP003', 'Arjun', 'Room 2', 'Room 3', null, null, '11:48', '11:52', 'vision', 'Completed'],
      [today, 'EMP004', 'Priya', 'Room 3', 'Room 1', 'DC006', 'Gift Boxes', '13:05', '13:09', 'vision+qr', 'Completed'],
    ];
    for (const r of demo) {
      await pool.query(
        `INSERT INTO box_transfers (date, emp_id, employee_name, from_room, to_room, product_id, product_name, start_time, end_time, source, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        r
      );
    }
  }

  // Dummy alerts so the alerts feed has data before the monitor AI service
  // starts posting real unauthorized-person events via POST /api/alerts.
  const { rows: [{ c: alertCount }] } = await pool.query('SELECT COUNT(*)::int AS c FROM alerts');
  if (alertCount === 0) {
    const demoAlerts = [
      ['unauthorized_person', 'Unknown', 'Room 2', '2026-07-05T11:48:00.000Z', 'open'],
      ['unauthorized_person', 'Unknown', 'Room 1', '2026-07-05T10:22:00.000Z', 'open'],
      ['tailgating', 'Unknown', 'Room 3', '2026-07-05T13:05:00.000Z', 'open'],
      ['unauthorized_person', 'Unknown', 'Room 1', '2026-07-04T15:40:00.000Z', 'resolved'],
      ['unauthorized_person', 'Unknown', 'Room 2', '2026-07-04T09:12:00.000Z', 'resolved'],
    ];
    for (const a of demoAlerts) {
      await pool.query('INSERT INTO alerts (type, person, room, time, status) VALUES ($1, $2, $3, $4, $5)', a);
    }
  }
}

let readyPromise = null;

// Called once from index.js before the server starts listening. Creates the
// schema and seeds demo data if the tables are empty; safe to call repeatedly
// (idempotent) since seeding is gated on each table's row count.
function init() {
  if (!readyPromise) {
    readyPromise = exec(SCHEMA).then(seedIfEmpty);
  }
  return readyPromise;
}

module.exports = { prepare, exec, pool, init };
