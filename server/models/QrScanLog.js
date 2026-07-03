const mongoose = require('mongoose');

const qrScanLogSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required']
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scanTime: {
    type: Date,
    default: Date.now
  },
  actionType: {
    type: String,
    enum: ['profile_view', 'attendance', 'emergency', 'dispensing', 'access_control', 'qr_validation', 'medication_report'],
    default: 'profile_view'
  },
  deviceId: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
qrScanLogSchema.index({ employee: 1, scanTime: -1 });
qrScanLogSchema.index({ company: 1, scanTime: -1 });
qrScanLogSchema.index({ actionType: 1 });

module.exports = mongoose.model('QrScanLog', qrScanLogSchema);
