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
  },
  batchNumber: {
    type: String,
    trim: true
  },
  manufacturingDate: {
    type: Date
  },
  supplier: {
    type: String,
    trim: true
  },
  purchaseDate: {
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
  riskCategory: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  qrCodeId: {
    type: String,
    trim: true
  },
  qrCodeData: {
    type: String,
    select: false
  },
  qrCodeGeneratedAt: {
    type: Date
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

// Get expiry status breakdown for all items in this box
firstAidBoxSchema.methods.getExpiryStatus = function() {
  const now = new Date();
  const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const result = { healthy: [], warning: [], critical: [], expired: [] };

  this.items.forEach(item => {
    if (!item.expiryDate) {
      result.healthy.push(item);
      return;
    }
    const exp = new Date(item.expiryDate);
    if (exp < now) result.expired.push(item);
    else if (exp <= d30) result.critical.push(item);
    else if (exp <= d90) result.warning.push(item);
    else result.healthy.push(item);
  });

  return result;
};

// Unique QR code ID index
firstAidBoxSchema.index(
  { qrCodeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      qrCodeId: { $exists: true, $ne: null }
    }
  }
);

module.exports = mongoose.model('FirstAidBox', firstAidBoxSchema);
