const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  checked: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

const deficiencySchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['minor', 'moderate', 'serious', 'critical'],
    default: 'minor'
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: true });

const inspectionSchema = new mongoose.Schema({
  inspectionId: {
    type: String,
    unique: true,
    trim: true
  },
  firstAidBox: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FirstAidBox',
    required: [true, 'First aid box is required']
  },
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Inspector is required']
  },
  inspectorName: {
    type: String,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  inspectionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['adequate', 'needs_replenishment', 'items_expired', 'failed'],
    required: true
  },
  checklist: [checklistItemSchema],
  deficiencies: [deficiencySchema],
  overallNotes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  // Snapshot of the kit's compliance at the time of inspection (inspection history)
  complianceScore: {
    type: Number,
    min: 0,
    max: 100
  },
  complianceStatus: {
    type: String,
    enum: ['compliant', 'at_risk', 'non_compliant']
  },
  findings: {
    missingItems: { type: Number, default: 0 },
    lowStockItems: { type: Number, default: 0 },
    expiredUnits: { type: Number, default: 0 },
    expiringSoonUnits: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Auto-generate inspection ID
inspectionSchema.pre('save', async function() {
  if (!this.inspectionId) {
    const Counter = require('./Counter');
    this.inspectionId = await Counter.nextYearlyId({ prefix: 'INS', model: 'Inspection', field: 'inspectionId', companyId: this.company });
  }
});

// Indexes
inspectionSchema.index({ company: 1, inspectionDate: -1 });
inspectionSchema.index({ firstAidBox: 1, inspectionDate: -1 });
inspectionSchema.index({ inspector: 1 });

module.exports = mongoose.model('Inspection', inspectionSchema);
