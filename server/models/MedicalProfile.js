const mongoose = require('mongoose');

const currentMedicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  dosage: {
    type: String,
    trim: true
  },
  frequency: {
    type: String,
    trim: true
  }
}, { _id: false });

const medicalProfileSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required'],
    unique: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
    trim: true
  },
  knownAllergies: [{
    type: String,
    trim: true
  }],
  medicalConditions: [{
    type: String,
    trim: true
  }],
  currentMedications: [currentMedicationSchema],
  emergencyContact: {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  doctorName: {
    type: String,
    trim: true
  },
  doctorContact: {
    type: String,
    trim: true
  },
  riskLevel: {
    type: String,
    enum: ['low', 'moderate', 'high', 'critical'],
    default: 'low'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Auto-compute risk level based on medical data
medicalProfileSchema.pre('save', function(next) {
  this.lastUpdated = new Date();

  // Risk computation heuristic
  const allergyCount = (this.knownAllergies || []).filter(a => a).length;
  const conditionCount = (this.medicalConditions || []).filter(c => c).length;
  const medicationCount = (this.currentMedications || []).length;

  const highRiskConditions = ['diabetes', 'epilepsy', 'heart disease', 'asthma', 'hypertension', 'seizures'];
  const hasHighRiskCondition = (this.medicalConditions || []).some(c =>
    highRiskConditions.some(hr => c.toLowerCase().includes(hr))
  );

  if (hasHighRiskCondition || conditionCount >= 3 || (allergyCount >= 3 && conditionCount >= 2)) {
    this.riskLevel = 'critical';
  } else if (conditionCount >= 2 || allergyCount >= 3 || medicationCount >= 3) {
    this.riskLevel = 'high';
  } else if (conditionCount >= 1 || allergyCount >= 1 || medicationCount >= 1) {
    this.riskLevel = 'moderate';
  } else {
    this.riskLevel = 'low';
  }

  next();
});

// Index for efficient querying
medicalProfileSchema.index({ company: 1 });
medicalProfileSchema.index({ riskLevel: 1 });

module.exports = mongoose.model('MedicalProfile', medicalProfileSchema);
