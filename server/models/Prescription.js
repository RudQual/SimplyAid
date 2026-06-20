const mongoose = require('mongoose');

const prescriptionMedicineSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: [true, 'Medicine name is required'],
    trim: true
  },
  strength: {
    type: String,
    trim: true
  },
  dosage: {
    type: String,
    required: [true, 'Dosage is required'],
    trim: true
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required'],
    trim: true
  },
  duration: {
    type: String,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  prescriptionId: {
    type: String,
    unique: true,
    trim: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Employee is required']
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  doctorName: {
    type: String,
    required: [true, 'Doctor name is required'],
    trim: true
  },
  doctorRegistrationNumber: {
    type: String,
    trim: true
  },
  issueDate: {
    type: Date,
    required: [true, 'Issue date is required'],
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  medicines: {
    type: [prescriptionMedicineSchema],
    validate: {
      validator: function(v) { return v && v.length > 0; },
      message: 'At least one medicine is required'
    }
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Auto-generate prescription ID
prescriptionSchema.pre('save', async function(next) {
  if (!this.prescriptionId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Prescription').countDocuments({
      company: this.company,
      createdAt: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`)
      }
    });
    this.prescriptionId = `PRX-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  // Auto-expire if past expiry date
  if (this.expiryDate && new Date() > this.expiryDate && this.status === 'active') {
    this.status = 'expired';
  }

  next();
});

// Indexes for common queries
prescriptionSchema.index({ employee: 1, status: 1 });
prescriptionSchema.index({ company: 1, createdAt: -1 });
prescriptionSchema.index({ status: 1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
