require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db'); // ensures schema + seed run on boot

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const productRoutes = require('./routes/products');
const movementRoutes = require('./routes/movements');
const expiryRoutes = require('./routes/expiry');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/expiry-alerts', expiryRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Smart Inventory API listening on port ${PORT}`));
