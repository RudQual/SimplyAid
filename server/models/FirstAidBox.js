const mongoose = require('mongoose');

const stockEntrySchema = new mongoose.Schema({
  batchNumber: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  expiryDate: {
    type: Date
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
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const boxItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  requiredQty: {
    type: Number,
    required: true,
    default: 0
  },
  lastRestocked: {
    type: Date
  },
  // Multiple stock batches per item
  stocks: [stockEntrySchema],
  // Legacy single-entry fields (kept for backward compatibility)
  currentQty: {
    type: Number,
    default: 0
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
  
  // Check if any items need replenishment (use stocks sum or legacy currentQty)
  const needsReplenishment = this.items.some(item => {
    const totalQty = item.stocks && item.stocks.length > 0
      ? item.stocks.reduce((sum, s) => sum + (s.quantity || 0), 0)
      : (item.currentQty || 0);
    return totalQty < item.requiredQty;
  });
  if (needsReplenishment) {
    this.status = 'needs_replenishment';
    return;
  }
  
  this.status = 'adequate';
};

// Get expiry status breakdown for all stock entries across all items in this box
firstAidBoxSchema.methods.getExpiryStatus = function() {
  const now = new Date();
  const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const result = { healthy: [], warning: [], critical: [], expired: [] };

  this.items.forEach(item => {
    // If item has stocks, check each stock entry
    if (item.stocks && item.stocks.length > 0) {
      item.stocks.forEach(stock => {
        const entry = { item, stock };
        if (!stock.expiryDate) {
          result.healthy.push(entry);
          return;
        }
        const exp = new Date(stock.expiryDate);
        if (exp < now) result.expired.push(entry);
        else if (exp <= d30) result.critical.push(entry);
        else if (exp <= d90) result.warning.push(entry);
        else result.healthy.push(entry);
      });
    } else {
      // Legacy: use top-level expiryDate
      if (!item.expiryDate) {
        result.healthy.push({ item, stock: null });
        return;
      }
      const exp = new Date(item.expiryDate);
      if (exp < now) result.expired.push({ item, stock: null });
      else if (exp <= d30) result.critical.push({ item, stock: null });
      else if (exp <= d90) result.warning.push({ item, stock: null });
      else result.healthy.push({ item, stock: null });
    }
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
