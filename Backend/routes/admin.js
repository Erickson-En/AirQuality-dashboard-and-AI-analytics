// backend/routes/admin.js
// Admin-only API surface.  All routes are protected by requireAdmin middleware.
//
// Endpoints:
//   GET  /api/admin/users              – list all users
//   PUT  /api/admin/users/:id/role     – promote/demote user role
//   DELETE /api/admin/users/:id        – delete a user
//   GET  /api/admin/device-config      – full hardware config twin
//   POST /api/admin/device-config      – push desired hardware config
//   GET  /api/admin/stats              – aggregate dashboard stats

const express       = require('express');
const router        = express.Router();
const requireAdmin  = require('../middleware/requireAdmin');
const User          = require('../models/user');
const DeviceConfig  = require('../models/deviceConfig');
const Reading       = require('../models/reading');
const Alert         = require('../models/alert');

// All routes below require admin
router.use(requireAdmin);

// ── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/users/:id/role ────────────────────────────────────────────
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "user" or "admin"' });
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent deleting yourself
    const requesterId = req.headers['x-user-id'] || req.body?.userId;
    if (req.params.id === requesterId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/device-config ─────────────────────────────────────────────
router.get('/device-config', async (req, res) => {
  try {
    let doc = await DeviceConfig.findOne({ deviceId: 'arduino-001' });
    if (!doc) doc = await DeviceConfig.create({ deviceId: 'arduino-001' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/device-config ────────────────────────────────────────────
router.post('/device-config', async (req, res) => {
  try {
    const allowed = [
      'sendIntervalMs','mq7R0','mq131R0','rlValue',
      'tempOffset','humOffset',
      'aqiWarnThreshold','aqiCriticalThreshold','aqiSevereThreshold',
    ];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[`desired.${k}`] = Number(req.body[k]);
    }
    update['status']    = 'pending';
    update['updatedAt'] = new Date();

    const doc = await DeviceConfig.findOneAndUpdate(
      { deviceId: 'arduino-001' },
      { $set: update },
      { new: true, upsert: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('deviceConfigUpdate', doc);

    res.json({ success: true, config: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalReadings, totalAlerts, totalUsers, latest] = await Promise.all([
      Reading.countDocuments(),
      Alert.countDocuments(),
      User.countDocuments(),
      Reading.findOne().sort({ timestamp: -1 }).lean(),
    ]);
    res.json({
      totalReadings,
      totalAlerts,
      totalUsers,
      lastReading: latest?.timestamp || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
