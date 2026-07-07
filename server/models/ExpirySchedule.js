const mongoose = require('mongoose');

const expiryScheduleSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'expiry_check'
  },
  lastRunAt: {
    type: Date,
    default: null
  },
  intervalHours: {
    type: Number,
    default: 24 // Run once every 24 hours
  },
  alertsGeneratedLastRun: {
    type: Number,
    default: 0
  },
  boxesCheckedLastRun: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ExpirySchedule', expiryScheduleSchema);
