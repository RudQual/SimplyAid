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
  // Scanner that was used (auto-fills location & department)
  scanner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scanner'
  },
  // What happened
  incidentType: {
    type: String,
    enum: ['injury', 'illness', 'near_miss', 'dangerous_occurrence'],
    default: 'injury'
  },
  // Multiple injury types for detailed classification
  injuryTypes: [{
    type: {
      type: String,
      trim: true
    },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'serious', 'fatal'],
      default: 'minor'
    }
  }],
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
    quantity: { type: Number, default: 1, min: [1, 'Quantity used must be at least 1'] }
  }],
  // Set once the items used have been deducted from the kit, so stock is
  // never deducted twice as the incident moves through its workflow.
  stockDeducted: {
    type: Boolean,
    default: false
  },
  stockDeductedAt: {
    type: Date
  },
  // Outcome
  outcome: {
    type: String,
    enum: ['returned_to_work', 'sent_home', 'hospitalized', 'referred_to_doctor', 'fatal', 'under_observation', 'pending_confirmation'],
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
  },
  // How the incident was initiated
  reportMode: {
    type: String,
    enum: ['self_reported', 'manager_assisted'],
    default: 'self_reported'
  },
  // True when employee delegated form-filling to the manager
  pendingManagerAssist: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-generate incident ID
incidentSchema.pre('save', async function() {
  if (!this.incidentId) {
    const Counter = require('./Counter');
    this.incidentId = await Counter.nextYearlyId({ prefix: 'INC', model: 'Incident', field: 'incidentId', companyId: this.company });
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
incidentSchema.index({ company: 1, dateTime: -1 });
incidentSchema.index({ company: 1, reportedBy: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
