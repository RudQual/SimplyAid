const mongoose = require('mongoose');

const medicineUsedSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  }
}, { _id: false });

const treatmentRecordSchema = new mongoose.Schema({
  treatmentId: {
    type: String,
    unique: true,
    trim: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },
  employeeName: {
    type: String,
    trim: true
  },
  incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  treatmentDate: {
    type: Date,
    required: [true, 'Treatment date is required'],
    default: Date.now
  },
  treatmentTime: {
    type: String,
    trim: true
  },
  treatmentLocation: {
    type: String,
    trim: true
  },
  injuryType: {
    type: String,
    trim: true
  },
  injurySeverity: {
    type: String,
    enum: ['minor', 'moderate', 'serious', 'critical'],
    required: [true, 'Injury severity is required']
  },
  treatmentProvided: {
    type: String,
    required: [true, 'Treatment description is required'],
    trim: true
  },
  medicinesUsed: [medicineUsedSchema],
  firstAider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'First aider is required']
  },
  firstAiderName: {
    type: String,
    trim: true
  },
  firstAidBoxUsed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FirstAidBox'
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Auto-generate treatment ID
treatmentRecordSchema.pre('save', async function() {
  if (!this.treatmentId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('TreatmentRecord').countDocuments({
      company: this.company,
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      }
    });
    this.treatmentId = `TRT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
});

// Indexes for common queries
treatmentRecordSchema.index({ company: 1, treatmentDate: -1 });
treatmentRecordSchema.index({ employee: 1, treatmentDate: -1 });
treatmentRecordSchema.index({ firstAider: 1 });
treatmentRecordSchema.index({ injurySeverity: 1 });

module.exports = mongoose.model('TreatmentRecord', treatmentRecordSchema);
