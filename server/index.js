require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db'); // ensures schema + seed run on boot

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const productRoutes = require('./routes/products');
const movementRoutes = require('./routes/movements');
const expiryRoutes = require('./routes/expiry');
const roomEntryRoutes = require('./routes/roomEntries');
const cctvRoutes = require('./routes/cctv');
const rfidRoutes = require('./routes/rfid');
const alertRoutes = require('./routes/alerts');
const monitorRoutes = require('./routes/monitor');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/expiry-alerts', expiryRoutes);
app.use('/api/room-entries', roomEntryRoutes);
app.use('/api/cctv', cctvRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/monitor', monitorRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Smart Inventory API listening on port ${PORT}`));
