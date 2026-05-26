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
    enum: ['admin', 'safety_officer', 'first_aider', 'department_head', 'employee'],
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
  dateOfJoining: {
    type: Date
  },
  designation: {
    type: String,
    trim: true
  },
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

// Unique employeeId per company
userSchema.index({ employeeId: 1, company: 1 }, { unique: true, sparse: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
