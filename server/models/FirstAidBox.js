const mongoose = require('mongoose');

const boxItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  currentQty: {
    type: Number,
    required: true,
    default: 0
  },
  requiredQty: {
    type: Number,
    required: true,
    default: 0
  },
  lastRestocked: {
    type: Date
  },
  expiryDate: {
    type: Date
  }
}, { _id: false });

const inspectionLogSchema = new mongoose.Schema({
  inspectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['adequate', 'needs_replenishment', 'items_expired'],
    required: true
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: true, timestamps: false });

const firstAidBoxSchema = new mongoose.Schema({
  boxId: {
    type: String,
    required: [true, 'Box ID is required'],
    unique: true,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
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
  classType: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: [true, 'Class type is required'],
    default: 'B'
  },
  inCharge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [boxItemSchema],
  inspectionLogs: [inspectionLogSchema],
  lastInspectionDate: {
    type: Date
  },
  nextInspectionDue: {
    type: Date
  },
  inspectionFrequencyDays: {
    type: Number,
    default: 30 // Monthly inspection
  },
  status: {
    type: String,
    enum: ['adequate', 'needs_replenishment', 'overdue_inspection', 'inactive'],
    default: 'adequate'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Auto-compute status based on items and inspection dates
firstAidBoxSchema.methods.computeStatus = function() {
  const now = new Date();
  
  // Check if inspection is overdue
  if (this.nextInspectionDue && this.nextInspectionDue < now) {
    this.status = 'overdue_inspection';
    return;
  }
  
  // Check if any items need replenishment
  const needsReplenishment = this.items.some(item => item.currentQty < item.requiredQty);
  if (needsReplenishment) {
    this.status = 'needs_replenishment';
    return;
  }
  
  this.status = 'adequate';
};

module.exports = mongoose.model('FirstAidBox', firstAidBoxSchema);
