const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  nameHi: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['dressing', 'bandage', 'antiseptic', 'medicine', 'equipment', 'other'],
    required: true
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  isPrescribed: {
    type: Boolean,
    default: false
  },
  prescribedBy: {
    type: String,
    trim: true // e.g., 'Factories Act 1948, Section 45'
  },
  description: {
    type: String,
    trim: true
  },
  descriptionHi: {
    type: String,
    trim: true
  },
  // Default required quantities per box class
  requiredQty: {
    classA: { type: Number, default: 0 },
    classB: { type: Number, default: 0 },
    classC: { type: Number, default: 0 }
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  isGlobal: {
    type: Boolean,
    default: false // true for statutory items
  },
  defaultShelfLifeDays: {
    type: Number,
    default: 365
  },
  requiresExpiryTracking: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
