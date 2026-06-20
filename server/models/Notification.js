const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  type: {
    type: String,
    enum: [
      'incident_alert',
      'incident_update',
      'inventory_low',
      'certification_expiry',
      'inspection_due',
      'report_pending',
      'system',
      'expiry_alert',
      'compliance_alert',
      'treatment_alert',
      'prescription_alert'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  titleHi: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  messageHi: {
    type: String,
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'info', 'warning', 'critical'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['inventory', 'expiry', 'compliance', 'incident', 'certification', 'treatment', 'prescription', 'system'],
    default: 'system'
  },
  relatedModel: {
    type: String,
    enum: ['Incident', 'FirstAidBox', 'User', 'Department', 'TreatmentRecord', 'Prescription', 'InventoryItem']
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  archivedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
