const mongoose = require('mongoose');

/**
 * Immutable ledger of every stock movement in a first aid kit.
 * quantityChange is signed: positive for restock, negative for dispense/removal.
 */
const stockTransactionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  box: { type: mongoose.Schema.Types.ObjectId, ref: 'FirstAidBox', required: true },
  boxCode: { type: String, trim: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  itemName: { type: String, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['restock', 'dispense', 'adjustment', 'expired_removal', 'item_added', 'item_removed', 'kit_retired']
  },
  quantityChange: { type: Number, required: true },
  quantityBefore: { type: Number, required: true, min: 0 },
  quantityAfter: { type: Number, required: true, min: 0 },
  batchNumber: { type: String, trim: true },
  expiryDate: { type: Date },
  reason: { type: String, trim: true, maxlength: 500 },
  // What triggered the movement (an incident, a treatment, an inspection, ...)
  reference: {
    model: { type: String, enum: ['Incident', 'TreatmentRecord', 'Inspection', null] },
    id: { type: mongoose.Schema.Types.ObjectId },
    label: { type: String, trim: true }
  },
  // Units that were requested but not available (e.g. usage recorded after the fact)
  shortfall: { type: Number, default: 0, min: 0 },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String, trim: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

stockTransactionSchema.index({ company: 1, createdAt: -1 });
stockTransactionSchema.index({ box: 1, createdAt: -1 });
stockTransactionSchema.index({ item: 1, createdAt: -1 });
stockTransactionSchema.index({ company: 1, type: 1, createdAt: -1 });

// The ledger is append-only.
const immutable = function () { throw new Error('Stock transactions cannot be modified'); };
['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete']
  .forEach((op) => stockTransactionSchema.pre(op, immutable));

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
