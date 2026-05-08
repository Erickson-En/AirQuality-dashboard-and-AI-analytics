// backend/routes/deviceConfig.js
// REST API for the remote hardware configuration feedback loop.
//
// Flow:
//   Dashboard  --POST /api/device-config/desired--> Backend (saves desired, marks pending)
//   Arduino    --POST /api/sensor-data-----------> Backend (reads response body with config)
//   Arduino    --POST /api/device-config/ack-----> Backend (saves reported, marks synced)
//   Dashboard  --GET  /api/device-config----------> Backend (returns desired + reported + status)

const express = require('express');
const router  = express.Router();
const DeviceConfig = require('../models/deviceConfig');

const DEVICE_ID = 'arduino-001';

// ── GET current twin (dashboard polls this) ──────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let doc = await DeviceConfig.findOne({ deviceId: DEVICE_ID });
    if (!doc) {
      doc = await DeviceConfig.create({ deviceId: DEVICE_ID });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST desired config (dashboard → backend) ────────────────────────────────
// Body: { sendIntervalMs, mq7R0, mq131R0, rlValue, tempOffset, humOffset,
//         aqiWarnThreshold, aqiCriticalThreshold, aqiSevereThreshold }
router.post('/desired', async (req, res) => {
  try {
    const update = {};
    const allowed = [
      'sendIntervalMs','mq7R0','mq131R0','rlValue',
      'tempOffset','humOffset',
      'aqiWarnThreshold','aqiCriticalThreshold','aqiSevereThreshold',
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[`desired.${k}`] = Number(req.body[k]);
    }
    update['status']    = 'pending';
    update['updatedAt'] = new Date();

    const doc = await DeviceConfig.findOneAndUpdate(
      { deviceId: DEVICE_ID },
      { $set: update },
      { new: true, upsert: true }
    );

    // Broadcast to all connected dashboard clients via Socket.IO (attached to app)
    const io = req.app.get('io');
    if (io) io.emit('deviceConfigUpdate', doc);

    res.json({ success: true, config: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST ack (Arduino → backend after applying config) ───────────────────────
// Body mirrors the desired fields, plus optional firmwareVersion string
router.post('/ack', async (req, res) => {
  try {
    const reported = {};
    const allowed = [
      'sendIntervalMs','mq7R0','mq131R0','rlValue',
      'tempOffset','humOffset',
      'aqiWarnThreshold','aqiCriticalThreshold','aqiSevereThreshold',
      'firmwareVersion',
    ];
    for (const k of allowed) {
      if (req.body[k] !== undefined) reported[`reported.${k}`] = req.body[k];
    }
    reported['reported.lastSeenAt'] = new Date();
    reported['status']    = 'synced';
    reported['updatedAt'] = new Date();

    const doc = await DeviceConfig.findOneAndUpdate(
      { deviceId: DEVICE_ID },
      { $set: reported },
      { new: true, upsert: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('deviceConfigUpdate', doc);

    res.json({ success: true, config: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET config payload (Arduino polls this on boot / check-in) ───────────────
// Returns only the desired fields so the firmware can apply them directly
router.get('/payload', async (req, res) => {
  try {
    let doc = await DeviceConfig.findOne({ deviceId: DEVICE_ID });
    if (!doc) doc = await DeviceConfig.create({ deviceId: DEVICE_ID });
    res.json({
      config: doc.desired,
      status: doc.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
