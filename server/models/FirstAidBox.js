const mongoose = require('mongoose');
const { DAY_MS, EXPIRY_SOON_DAYS, EXPIRY_WARNING_DAYS } = require('../config/constants');

const nonNegativeInt = {
  validator: (v) => Number.isInteger(v) && v >= 0,
  message: (p) => `${p.path} must be a whole number of 0 or more (got ${p.value})`
};

// A batch of a supply inside a kit. Every unit in a kit belongs to exactly one batch.
const stockEntrySchema = new mongoose.Schema({
  batchNumber: { type: String, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, default: 0, validate: nonNegativeInt },
  expiryDate: { type: Date },
  manufacturingDate: { type: Date },
  supplier: { type: String, trim: true, maxlength: 120 },
  purchaseDate: { type: Date },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const boxItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  // Minimum quantity that must be present (the low-stock threshold for this kit)
  requiredQty: { type: Number, required: true, default: 0, validate: nonNegativeInt },
  lastRestocked: { type: Date },
  stocks: [stockEntrySchema],
  // Derived: always equal to the sum of stocks[].quantity (kept for backward compatibility)
  currentQty: { type: Number, default: 0, min: 0 },
  // Legacy single-batch fields from older data. Migrated into `stocks` automatically.
  expiryDate: { type: Date },
  batchNumber: { type: String, trim: true },
  manufacturingDate: { type: Date },
  supplier: { type: String, trim: true },
  purchaseDate: { type: Date }
}, { _id: false });

const inspectionLogSchema = new mongoose.Schema({
  inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inspection: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspection' },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['adequate', 'needs_replenishment', 'items_expired', 'failed'], required: true },
  notes: { type: String, trim: true }
}, { _id: true, timestamps: false });

const firstAidBoxSchema = new mongoose.Schema({
  boxId: { type: String, required: [true, 'Kit ID is required'], unique: true, trim: true, uppercase: true, maxlength: 40 },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: [true, 'Department is required'] },
  location: { type: String, required: [true, 'Location is required'], trim: true, maxlength: 200 },
  floor: { type: String, trim: true, maxlength: 50 },
  classType: { type: String, enum: ['A', 'B', 'C'], required: [true, 'Class type is required'], default: 'B' },
  inCharge: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [boxItemSchema],
  inspectionLogs: [inspectionLogSchema],
  lastInspectionDate: { type: Date },
  nextInspectionDue: { type: Date },
  inspectionFrequencyDays: { type: Number, default: 30, min: 1, max: 365 },
  status: {
    type: String,
    enum: ['adequate', 'needs_replenishment', 'items_expired', 'overdue_inspection', 'inactive'],
    default: 'adequate'
  },
  // Snapshot of stock health, recomputed on every save and by the monitoring job.
  health: {
    totalUnits: { type: Number, default: 0 },
    missingItems: { type: Number, default: 0 },   // required items with 0 units
    lowStockItems: { type: Number, default: 0 },  // required items below requiredQty (incl. missing)
    expiredUnits: { type: Number, default: 0 },
    expiringSoonUnits: { type: Number, default: 0 },
    computedAt: { type: Date }
  },
  riskCategory: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  qrCodeId: { type: String, trim: true },
  qrCodeData: { type: String, select: false },
  qrCodeGeneratedAt: { type: Date },
  isActive: { type: Boolean, default: true },
  retiredAt: { type: Date },
  retiredReason: { type: String, trim: true }
}, {
  timestamps: true,
  optimisticConcurrency: true
});

/** Total units of a kit item (sum of its batches). */
firstAidBoxSchema.statics.itemQuantity = (boxItem) =>
  (boxItem.stocks || []).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

/**
 * Move legacy single-batch quantities into `stocks` so batches are the single
 * source of truth. Non-destructive: the legacy fields are left untouched.
 * Returns true when anything changed.
 */
firstAidBoxSchema.methods.migrateLegacyStock = function () {
  let changed = false;
  this.items.forEach((item) => {
    if ((!item.stocks || item.stocks.length === 0) && item.currentQty > 0) {
      item.stocks = [{
        batchNumber: item.batchNumber || 'OPENING-STOCK',
        quantity: Math.max(0, Math.floor(item.currentQty)),
        expiryDate: item.expiryDate,
        manufacturingDate: item.manufacturingDate,
        supplier: item.supplier,
        purchaseDate: item.purchaseDate,
        addedAt: item.lastRestocked || this.createdAt || new Date()
      }];
      changed = true;
    }
  });
  return changed;
};

/** Recompute derived quantities, health snapshot and status from current data. */
firstAidBoxSchema.methods.computeStatus = function (now = new Date()) {
  const soon = new Date(now.getTime() + EXPIRY_SOON_DAYS * DAY_MS);
  const health = { totalUnits: 0, missingItems: 0, lowStockItems: 0, expiredUnits: 0, expiringSoonUnits: 0, computedAt: now };

  this.items.forEach((item) => {
    const qty = (item.stocks || []).reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    item.currentQty = qty;
    health.totalUnits += qty;
    if (item.requiredQty > 0 && qty < item.requiredQty) {
      health.lowStockItems += 1;
      if (qty === 0) health.missingItems += 1;
    }
    (item.stocks || []).forEach((s) => {
      if (!s.expiryDate || !s.quantity) return;
      const exp = new Date(s.expiryDate);
      if (exp < now) health.expiredUnits += s.quantity;
      else if (exp <= soon) health.expiringSoonUnits += s.quantity;
    });
  });
  this.health = health;

  if (!this.isActive) this.status = 'inactive';
  else if (health.expiredUnits > 0) this.status = 'items_expired';
  else if (!this.nextInspectionDue || this.nextInspectionDue < now) this.status = 'overdue_inspection';
  else if (health.lowStockItems > 0) this.status = 'needs_replenishment';
  else this.status = 'adequate';
  return this.status;
};

/** Expiry breakdown of every batch in the kit. */
firstAidBoxSchema.methods.getExpiryStatus = function (now = new Date()) {
  const d30 = new Date(now.getTime() + EXPIRY_SOON_DAYS * DAY_MS);
  const d90 = new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS);
  const result = { healthy: [], warning: [], critical: [], expired: [] };
  this.items.forEach((item) => {
    (item.stocks || []).forEach((stock) => {
      const entry = { item, stock };
      if (!stock.expiryDate) return result.healthy.push(entry);
      const exp = new Date(stock.expiryDate);
      if (exp < now) result.expired.push(entry);
      else if (exp <= d30) result.critical.push(entry);
      else if (exp <= d90) result.warning.push(entry);
      else result.healthy.push(entry);
    });
  });
  return result;
};

// Derived fields are recomputed on every save. Legacy migration is deliberately
// NOT run here: it must happen when a kit is loaded, before any stock change —
// otherwise an item whose last batch was just removed would look like legacy
// data (no batches, old currentQty) and its stock would be resurrected.
firstAidBoxSchema.pre('validate', function () {
  this.computeStatus();
});

firstAidBoxSchema.index({ qrCodeId: 1 }, { unique: true, partialFilterExpression: { qrCodeId: { $type: 'string' } } });
firstAidBoxSchema.index({ company: 1, isActive: 1, department: 1 });
firstAidBoxSchema.index({ company: 1, status: 1 });
firstAidBoxSchema.index({ 'items.item': 1 });

module.exports = mongoose.model('FirstAidBox', firstAidBoxSchema);
