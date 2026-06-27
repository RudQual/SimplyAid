const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  incidentId: {
    type: String,
    unique: true,
    trim: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  // Who reported
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Injured person details
  injuredPerson: {
    name: { type: String, required: true, trim: true },
    employeeId: { type: String, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    designation: { type: String, trim: true }
  },
  // When & Where
  dateTime: {
    type: Date,
    required: [true, 'Incident date/time is required'],
    default: Date.now
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  // What happened
  incidentType: {
    type: String,
    enum: ['injury', 'illness', 'near_miss', 'dangerous_occurrence'],
    required: true
  },
  severity: {
    type: String,
    enum: ['minor', 'moderate', 'serious', 'fatal'],
    required: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  causeOfInjury: {
    type: String,
    trim: true
  },
  bodyPartAffected: [{
    type: String,
    trim: true
  }],
  // Treatment
  treatmentGiven: {
    type: String,
    trim: true
  },
  treatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  firstAidBoxUsed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FirstAidBox'
  },
  itemsUsed: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
    itemName: String,
    quantity: { type: Number, default: 1 }
  }],
  // Outcome
  outcome: {
    type: String,
    enum: ['returned_to_work', 'sent_home', 'hospitalized', 'referred_to_doctor', 'fatal', 'under_observation'],
    required: true
  },
  hospitalName: {
    type: String,
    trim: true
  },
  daysLost: {
    type: Number,
    default: 0
  },
  dateOfReturn: {
    type: Date
  },
  // Compliance (Section 88 — Factories Act)
  isReportable: {
    type: Boolean,
    default: false
  },
  form18Generated: {
    type: Boolean,
    default: false
  },
  form18GeneratedDate: {
    type: Date
  },
  // Investigation
  status: {
    type: String,
    enum: ['reported', 'under_investigation', 'resolved', 'closed'],
    default: 'reported'
  },
  rootCause: {
    type: String,
    trim: true
  },
  correctiveAction: {
    type: String,
    trim: true
  },
  preventiveMeasures: {
    type: String,
    trim: true
  },
  witnesses: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Status change history
  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    notes: String
  }],
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closedAt: {
    type: Date
  },
  // Manager on-site confirmation
  managerConfirmation: {
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
    confirmedAt: { type: Date }
  },
  // Doctor final review
  doctorReview: {
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
    reviewedAt: { type: Date }
  },
  // Track whether manager has forwarded to doctor
  forwardedToDoctor: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate incident ID
incidentSchema.pre('save', async function() {
  if (!this.incidentId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Incident').countDocuments({
      company: this.company,
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      }
    });
    this.incidentId = `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // Auto-determine if reportable (Section 88: death or 48+ hrs / 2+ days lost)
  if (this.severity === 'fatal' || this.daysLost >= 2) {
    this.isReportable = true;
  }
});

// Index for common queries
incidentSchema.index({ company: 1, createdAt: -1 });
incidentSchema.index({ department: 1, status: 1 });
incidentSchema.index({ severity: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
