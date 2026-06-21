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
    trim: true
  }
}, {
  timestamps: true
});

// Auto-generate inspection ID
inspectionSchema.pre('save', async function() {
  if (!this.inspectionId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Inspection').countDocuments({
      company: this.company,
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      }
    });
    this.inspectionId = `INS-${year}-${String(count + 1).padStart(4, '0')}`;
  }
});

// Indexes
inspectionSchema.index({ company: 1, inspectionDate: -1 });
inspectionSchema.index({ firstAidBox: 1, inspectionDate: -1 });
inspectionSchema.index({ inspector: 1 });

module.exports = mongoose.model('Inspection', inspectionSchema);
