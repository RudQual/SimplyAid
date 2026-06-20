const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  employeeId: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee'
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  phone: {
    type: String,
    trim: true
  },

  // --- Basic Information (new) ---
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  profilePhoto: {
    type: String,
    trim: true
  },

  // --- Organizational (enhanced) ---
  designation: {
    type: String,
    trim: true
  },
  dateOfJoining: {
    type: Date
  },
  employeeStatus: {
    type: String,
    enum: ['active', 'on_leave', 'suspended', 'resigned'],
    default: 'active'
  },

  // --- Safety Information (new) ---
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    trim: true
  },
  knownAllergies: [{
    type: String,
    trim: true
  }],
  chronicConditions: [{
    type: String,
    trim: true
  }],
  emergencyContact: {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relationship: { type: String, trim: true }
  },

  // --- First Aid Information ---
  firstAidCertified: {
    type: Boolean,
    default: false
  },
  certificationNumber: {
    type: String,
    trim: true
  },
  certificationExpiry: {
    type: Date
  },
  firstAidTrainingStatus: {
    type: String,
    enum: ['not_trained', 'in_training', 'trained'],
    default: 'not_trained'
  },

  // --- QR / System Information (new) ---
  qrCodeId: {
    type: String,
    trim: true
  },
  qrCodeData: {
    type: String,
    select: false // Large base64 string — only fetch when needed
  },
  qrCodeGeneratedAt: {
    type: Date
  },
  lastQrScanAt: {
    type: Date
  },

  // --- System ---
  preferredLanguage: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Unique employeeId per company, but only if it exists
userSchema.index(
  { employeeId: 1, company: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      employeeId: { $exists: true } 
    } 
  }
);

// Unique QR code ID
userSchema.index(
  { qrCodeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      qrCodeId: { $exists: true, $ne: null }
    }
  }
);

// Hash password and clean empty fields before saving
userSchema.pre('save', async function(next) {
  if (this.employeeId === '') {
    this.employeeId = undefined;
  }

  // Sync isActive from employeeStatus
  if (this.isModified('employeeStatus')) {
    this.isActive = ['active', 'on_leave'].includes(this.employeeStatus);
  }
  
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
