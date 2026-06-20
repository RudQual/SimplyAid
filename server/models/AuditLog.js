const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    trim: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true
  },
  entity: {
    type: String,
    required: true,
    enum: [
      'Treatment',
      'Prescription',
      'Inspection',
      'Inventory',
      'Compliance',
      'QrScan',
      'MedicalProfile',
      'Notification',
      'FirstAidBox',
      'Incident',
      'User'
    ]
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: String,
    trim: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  ipAddress: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
