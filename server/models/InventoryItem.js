const mongoose = require('mongoose');
const { INVENTORY_CATEGORIES } = require('../config/constants');

const qty = { type: Number, default: 0, min: [0, 'Required quantity cannot be negative'] };

/**
 * Catalog of supply types. Physical stock lives in first aid kits
 * (FirstAidBox.items[].stocks); company-wide totals are always computed from
 * kits, so the catalog and kit inventory can never drift apart.
 */
const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Item name is required'], trim: true, maxlength: 120 },
  nameHi: { type: String, trim: true, maxlength: 120 },
  category: {
    type: String,
    enum: { values: INVENTORY_CATEGORIES, message: 'Invalid category' },
    required: [true, 'Category is required']
  },
  unit: { type: String, required: [true, 'Unit is required'], trim: true, maxlength: 30 },
  description: { type: String, trim: true, maxlength: 1000 },
  descriptionHi: { type: String, trim: true, maxlength: 1000 },
  // Default required quantities per kit class (used when creating kits)
  requiredQty: { classA: qty, classB: qty, classC: qty },
  // Mandatory (statutory) supplies count towards kit compliance
  isMandatory: { type: Boolean, default: false },
  prescribedBy: { type: String, trim: true, maxlength: 120 },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  isGlobal: { type: Boolean, default: false },
  defaultShelfLifeDays: { type: Number, default: 365, min: 0 },
  requiresExpiryTracking: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

inventoryItemSchema.index({ company: 1, isActive: 1, category: 1, name: 1 });
inventoryItemSchema.index({ isGlobal: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
