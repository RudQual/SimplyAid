const FirstAidBox = require('../models/FirstAidBox');
const { DAY_MS, EXPIRY_CRITICAL_DAYS, EXPIRY_SOON_DAYS, EXPIRY_WARNING_DAYS } = require('../config/constants');

/**
 * Expiry bands
 *   expired  — expiry date has passed
 *   critical — expires within 7 days
 *   soon     — expires within 30 days
 *   warning  — expires within 90 days
 *   ok       — more than 90 days left
 *   none     — no expiry date recorded
 */
const classify = (expiryDate, now = new Date()) => {
  if (!expiryDate) return { status: 'none', daysRemaining: null };
  const days = Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / DAY_MS);
  let status = 'ok';
  if (new Date(expiryDate) < now) status = 'expired';
  else if (days <= EXPIRY_CRITICAL_DAYS) status = 'critical';
  else if (days <= EXPIRY_SOON_DAYS) status = 'soon';
  else if (days <= EXPIRY_WARNING_DAYS) status = 'warning';
  return { status, daysRemaining: days };
};

/** Flatten every batch of every kit into expiry entries. */
const collectEntries = (boxes, now = new Date()) => {
  const entries = [];
  boxes.forEach((box) => {
    box.items.forEach((item) => {
      (item.stocks || []).forEach((stock) => {
        if (!stock.quantity) return;
        const { status, daysRemaining } = classify(stock.expiryDate, now);
        entries.push({
          boxObjId: box._id,
          boxId: box.boxId,
          boxLocation: box.location,
          department: box.department ? box.department.name : 'Unknown',
          departmentId: box.department ? box.department._id : null,
          itemId: item.item ? item.item._id : null,
          itemName: item.item ? item.item.name : 'Unknown item',
          itemCategory: item.item ? item.item.category : 'other',
          unit: item.item ? item.item.unit : '',
          stockId: stock._id,
          batchNumber: stock.batchNumber,
          supplier: stock.supplier,
          currentQty: stock.quantity,
          expiryDate: stock.expiryDate,
          daysRemaining,
          status
        });
      });
    });
  });
  return entries;
};

const loadCompanyBoxes = (companyId, { departmentId, boxId } = {}) => {
  const filter = { company: companyId, isActive: true };
  if (departmentId) filter.department = departmentId;
  if (boxId) filter._id = boxId;
  return FirstAidBox.find(filter)
    .populate('items.item', 'name category unit')
    .populate('department', 'name code');
};

const summarize = (entries, boxCount) => {
  const by = (s) => entries.filter((e) => e.status === s);
  const units = (list) => list.reduce((sum, e) => sum + e.currentQty, 0);
  const expired = by('expired');
  const critical = by('critical');
  const soon = by('soon');
  const warning = by('warning');
  return {
    totalBatches: entries.length,
    totalBoxes: boxCount,
    expiredCount: expired.length,
    expiredUnits: units(expired),
    critical7Count: critical.length,
    critical30Count: soon.length,
    warning90Count: warning.length,
    healthyCount: by('ok').length + by('none').length,
    expiringSoonUnits: units(critical) + units(soon),
    // kept for older clients
    totalItems: entries.length
  };
};

/** Expiry timeline: units expiring per month for the next `months` months. */
const timeline = (entries, months = 6, now = new Date()) => {
  const buckets = [];
  for (let i = 0; i < months; i += 1) {
    const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    buckets.push({
      month: start.toISOString().slice(0, 7),
      label: `${start.toLocaleString('en-US', { month: 'short' })} ’${String(start.getFullYear()).slice(2)}`,
      units: entries.filter((e) => e.expiryDate && new Date(e.expiryDate) >= (i === 0 ? now : start) && new Date(e.expiryDate) < end)
        .reduce((s, e) => s + e.currentQty, 0)
    });
  }
  return buckets;
};

module.exports = { classify, collectEntries, loadCompanyBoxes, summarize, timeline };
