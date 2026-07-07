const mongoose = require('mongoose');

const scannerSchema = new mongoose.Schema({
  scannerId: {
    type: String,
    required: [true, 'Scanner ID is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Scanner name is required'],
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  floor: {
    type: String,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for fast company-scoped queries
scannerSchema.index({ company: 1, isActive: 1 });
scannerSchema.index({ department: 1 });

module.exports = mongoose.model('Scanner', scannerSchema);
