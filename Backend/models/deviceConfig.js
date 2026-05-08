// backend/models/deviceConfig.js
// Stores the desired hardware configuration and tracks the last acknowledged state.
const mongoose = require('mongoose');

const deviceConfigSchema = new mongoose.Schema({
  deviceId: { type: String, default: 'arduino-001', unique: true },

  // ── Desired config (set via dashboard) ──────────────────────
  desired: {
    sendIntervalMs:       { type: Number, default: 180000 }, // telemetry period in ms
    mq7R0:                { type: Number, default: 5.0  },   // MQ-7  baseline resistance
    mq131R0:              { type: Number, default: 10.0 },   // MQ-131 baseline resistance
    rlValue:              { type: Number, default: 10.0 },   // shared load resistor kΩ
    tempOffset:           { type: Number, default: 0.0  },
    humOffset:            { type: Number, default: 0.0  },
    aqiWarnThreshold:     { type: Number, default: 100  },   // mirrors ml/config.py AQI_ALERT_WARNING
    aqiCriticalThreshold: { type: Number, default: 150  },
    aqiSevereThreshold:   { type: Number, default: 200  },
  },

  // ── Reported config (echoed back by the Arduino after applying) ──
  reported: {
    sendIntervalMs:       { type: Number },
    mq7R0:                { type: Number },
    mq131R0:              { type: Number },
    rlValue:              { type: Number },
    tempOffset:           { type: Number },
    humOffset:            { type: Number },
    aqiWarnThreshold:     { type: Number },
    aqiCriticalThreshold: { type: Number },
    aqiSevereThreshold:   { type: Number },
    firmwareVersion:      { type: String },   // sent by device
    lastSeenAt:           { type: Date   },
  },

  // pending = dashboard changed desired but device hasn't ACKed yet
  status: { type: String, enum: ['pending', 'synced', 'error'], default: 'pending' },

  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DeviceConfig', deviceConfigSchema);
