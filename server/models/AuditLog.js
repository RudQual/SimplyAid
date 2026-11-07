const mongoose = require('mongoose');

/** Append-only activity history. Entries cannot be updated or deleted through the app. */
const auditLogSchema = new mongoose.Schema({
  // Null for system-generated entries (e.g. the scheduled monitoring job)
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, trim: true },
  userRole: { type: String, trim: true },
  action: { type: String, required: [true, 'Action is required'], trim: true },
  entity: {
    type: String,
    required: true,
    enum: [
      'Treatment', 'Prescription', 'Inspection', 'Inventory', 'InventoryItem', 'Compliance', 'QrScan',
      'MedicalProfile', 'Notification', 'FirstAidBox', 'Incident', 'User', 'Department', 'Company',
      'Scanner', 'Auth', 'Report', 'System'
    ]
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  entityLabel: { type: String, trim: true },
  details: { type: String, trim: true },
  // Field-level changes: { field: { from, to } }
  changes: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  ipAddress: { type: String, trim: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

const immutable = function () { throw new Error('Activity log entries cannot be modified'); };
['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete']
  .forEach((op) => auditLogSchema.pre(op, immutable));

module.exports = mongoose.model('AuditLog', auditLogSchema);
