const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  const employees = db.prepare('SELECT emp_id, name, rfid_tag, department, shift FROM employees ORDER BY emp_id').all();
  res.json(employees);
});

module.exports = router;
