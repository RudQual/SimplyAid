const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  code: {
    type: String,
    required: [true, 'Company code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  registrationNumber: {
    type: String,
    trim: true
  },
  factoryLicenseNumber: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String
  },
  totalWorkers: {
    type: Number,
    default: 0
  },
  // Section 45(4): Ambulance room required if 500+ workers
  requiresAmbulanceRoom: {
    type: Boolean,
    default: false
  },
  industry: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Auto-compute ambulance room requirement
companySchema.pre('save', function() {
  this.requiresAmbulanceRoom = this.totalWorkers >= 500;
});

module.exports = mongoose.model('Company', companySchema);
