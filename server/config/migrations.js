const FirstAidBox = require('../models/FirstAidBox');
const Incident = require('../models/Incident');
const Notification = require('../models/Notification');
const InventoryItem = require('../models/InventoryItem');

/**
 * Idempotent, non-destructive data migrations run at startup.
 * They only add/derive fields; no documents are deleted.
 */

/** Build indexes; if an index exists with outdated options, replace just that index. */
const ensureIndexes = async (Model) => {
  try {
    await Model.createIndexes();
  } catch (err) {
    if (![85, 86].includes(err.code)) throw err; // IndexOptionsConflict / IndexKeySpecsConflict
    const existing = await Model.collection.indexes();
    for (const [fields, options] of Model.schema.indexes()) {
      const name = options.name || Object.entries(fields).map(([k, v]) => `${k}_${v}`).join('_');
      const current = existing.find((i) => i.name === name);
      if (current && JSON.stringify(current.partialFilterExpression || null) !== JSON.stringify(options.partialFilterExpression || null)) {
        console.log(`🔧 Rebuilding index ${Model.modelName}.${name} with updated options`);
        await Model.collection.dropIndex(name);
      }
    }
    await Model.createIndexes();
  }
};

// Legacy kits stored quantity in item.currentQty without batches.
const migrateLegacyStock = async () => {
  const boxes = await FirstAidBox.find({ items: { $elemMatch: { currentQty: { $gt: 0 }, $or: [{ stocks: { $size: 0 } }, { stocks: { $exists: false } }] } } });
  for (const box of boxes) {
    if (box.migrateLegacyStock()) await box.save();
  }
  return boxes.length;
};

// Older code deducted kit stock when an incident was created; mark those so they are never deducted again.
const markLegacyIncidentDeductions = async () => {
  const r = await Incident.updateMany(
    { stockDeducted: { $exists: false }, firstAidBoxUsed: { $exists: true, $ne: null }, 'itemsUsed.0': { $exists: true } },
    { $set: { stockDeducted: true } }
  );
  return r.modifiedCount;
};

// Older notifications were created without a category, which broke category filters.
const backfillNotificationCategories = async () => {
  const map = {
    incident_alert: 'incident', incident_update: 'incident', report_pending: 'incident', inventory_low: 'inventory',
    inventory_alert: 'inventory', expiry_alert: 'expiry', compliance_alert: 'compliance', inspection_due: 'compliance',
    certification_expiry: 'certification', treatment_alert: 'treatment', prescription_alert: 'prescription'
  };
  let n = 0;
  for (const [type, category] of Object.entries(map)) {
    const r = await Notification.updateMany({ type, category: 'system' }, { $set: { category } });
    n += r.modifiedCount;
  }
  return n;
};

// Older statutory catalog items used `isPrescribed`; expose it as `isMandatory`.
const backfillMandatoryItems = async () => {
  const r = await InventoryItem.collection.updateMany(
    { isMandatory: { $exists: false }, isPrescribed: true },
    { $set: { isMandatory: true } }
  );
  return r.modifiedCount;
};

// Incidents created before responders existed: grant access to the managers who were
// actually alerted about them (otherwise an SOS from another department stays hidden).
const backfillIncidentResponders = async () => {
  const User = require('../models/User');
  const legacy = await Incident.find({ responders: { $exists: false } }).select('_id statusHistory').lean();
  let n = 0;
  for (const inc of legacy) {
    const alerted = await Notification.distinct('recipient', { relatedModel: 'Incident', relatedId: inc._id });
    const managers = alerted.length ? await User.find({ _id: { $in: alerted }, role: 'manager' }).distinct('_id') : [];
    const isSOS = (inc.statusHistory || []).some((h) => /^SOS Emergency/i.test(h.notes || ''));
    await Incident.updateOne({ _id: inc._id }, { $set: { responders: managers, isSOS } });
    n += 1;
  }
  return n;
};

const runMigrations = async () => {
  // Load every model so all of their indexes are built
  const fs = require('fs');
  const path = require('path');
  const modelsDir = path.join(__dirname, '..', 'models');
  fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js')).forEach((f) => require(path.join(modelsDir, f)));
  const mongoose = require('mongoose');
  for (const Model of Object.values(mongoose.models)) {
    await ensureIndexes(Model);
  }
  const results = {
    legacyKits: await migrateLegacyStock(),
    legacyIncidents: await markLegacyIncidentDeductions(),
    notificationCategories: await backfillNotificationCategories(),
    mandatoryItems: await backfillMandatoryItems(),
    incidentResponders: await backfillIncidentResponders()
  };
  const changed = Object.entries(results).filter(([, v]) => v > 0);
  if (changed.length) console.log('🔧 Data migrations applied:', Object.fromEntries(changed));
  return results;
};

module.exports = { runMigrations };
