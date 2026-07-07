const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ sub: admin.id, username: admin.username, role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: '8h',
  });

  res.json({ token, username: admin.username, role: 'admin' });
});

router.post('/employee-login', (req, res) => {
  const { empId, password } = req.body || {};
  if (!empId || !password) {
    return res.status(400).json({ error: 'Employee ID and password are required' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE emp_id = ?').get(empId);
  if (!employee || !employee.password_hash || !bcrypt.compareSync(password, employee.password_hash)) {
    return res.status(401).json({ error: 'Invalid employee ID or password' });
  }

  const token = jwt.sign(
    { sub: employee.id, empId: employee.emp_id, name: employee.name, role: 'employee' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ token, empId: employee.emp_id, name: employee.name, role: 'employee' });
});

module.exports = router;
