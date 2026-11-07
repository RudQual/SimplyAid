const InventoryItem = require('../models/InventoryItem');
const FirstAidBox = require('../models/FirstAidBox');
const { DAY_MS, EXPIRY_SOON_DAYS } = require('../config/constants');

/**
 * Company-wide inventory view: each catalog item with stock aggregated across
 * all active kits. Because totals are computed from kit batches, the global
 * inventory and kit inventory are always consistent.
 */
const aggregateCatalog = async (companyId, { departmentId, includeInactive = false } = {}) => {
  const itemFilter = { $or: [{ isGlobal: true }, { company: companyId }] };
  if (!includeInactive) itemFilter.isActive = { $ne: false };
  const boxFilter = { company: companyId, isActive: true };
  if (departmentId) boxFilter.department = departmentId;

  const [items, boxes] = await Promise.all([
    InventoryItem.find(itemFilter).sort('category name').lean(),
    FirstAidBox.find(boxFilter).select('boxId location department items').populate('department', 'name').lean()
  ]);

  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRY_SOON_DAYS * DAY_MS);
  const stats = new Map(items.map((i) => [String(i._id), {
    totalQty: 0, totalRequired: 0, presentCapped: 0, boxCount: 0, lowStockBoxes: 0, outOfStockBoxes: 0,
    expiredQty: 0, expiringSoonQty: 0, nearestExpiry: null, batches: 0
  }]));

  boxes.forEach((box) => {
    box.items.forEach((bi) => {
      const s = stats.get(String(bi.item));
      if (!s) return;
      const qty = (bi.stocks || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
      s.boxCount += 1;
      s.totalQty += qty;
      s.totalRequired += bi.requiredQty || 0;
      // Surplus in one kit cannot cover a shortfall in another
      s.presentCapped += Math.min(qty, bi.requiredQty || 0);
      if (bi.requiredQty > 0 && qty < bi.requiredQty) s.lowStockBoxes += 1;
      if (bi.requiredQty > 0 && qty === 0) s.outOfStockBoxes += 1;
      (bi.stocks || []).forEach((b) => {
        if (!b.quantity) return;
        s.batches += 1;
        if (!b.expiryDate) return;
        const exp = new Date(b.expiryDate);
        if (exp < now) s.expiredQty += b.quantity;
        else {
          if (exp <= soon) s.expiringSoonQty += b.quantity;
          if (!s.nearestExpiry || exp < s.nearestExpiry) s.nearestExpiry = exp;
        }
      });
    });
  });

  return items.map((item) => {
    const s = stats.get(String(item._id));
    let stockStatus = 'in_stock';
    if (s.boxCount === 0) stockStatus = 'not_stocked';
    else if (s.totalQty === 0) stockStatus = 'out_of_stock';
    else if (s.lowStockBoxes > 0) stockStatus = 'low_stock';
    let expiryStatus = 'ok';
    if (s.expiredQty > 0) expiryStatus = 'expired';
    else if (s.expiringSoonQty > 0) expiryStatus = 'expiring';
    else if (!s.batches) expiryStatus = 'none';
    return {
      ...item,
      stock: {
        ...s,
        availableQty: s.totalQty - s.expiredQty,
        nearestExpiry: s.nearestExpiry,
        daysToNearestExpiry: s.nearestExpiry ? Math.ceil((s.nearestExpiry - now) / DAY_MS) : null,
        fillRate: s.totalRequired ? Math.floor((s.presentCapped / s.totalRequired) * 100) : null,
        stockStatus,
        expiryStatus
      }
    };
  });
};

/** Headline numbers used by the dashboard and inventory pages. */
const inventorySummary = async (companyId, opts = {}) => {
  const catalog = await aggregateCatalog(companyId, opts);
  const byCategory = {};
  catalog.forEach((i) => {
    byCategory[i.category] = byCategory[i.category] || { category: i.category, items: 0, units: 0, required: 0 };
    byCategory[i.category].items += 1;
    byCategory[i.category].units += i.stock.totalQty;
    byCategory[i.category].required += i.stock.totalRequired;
  });
  const count = (pred) => catalog.filter(pred).length;
  return {
    catalog,
    totals: {
      catalogItems: catalog.length,
      totalUnits: catalog.reduce((s, i) => s + i.stock.totalQty, 0),
      lowStockItems: count((i) => i.stock.stockStatus === 'low_stock'),
      outOfStockItems: count((i) => i.stock.stockStatus === 'out_of_stock'),
      notStockedItems: count((i) => i.stock.stockStatus === 'not_stocked'),
      expiredUnits: catalog.reduce((s, i) => s + i.stock.expiredQty, 0),
      expiringSoonUnits: catalog.reduce((s, i) => s + i.stock.expiringSoonQty, 0),
      lowStockSlots: catalog.reduce((s, i) => s + i.stock.lowStockBoxes, 0),
      outOfStockSlots: catalog.reduce((s, i) => s + i.stock.outOfStockBoxes, 0)
    },
    byCategory: Object.values(byCategory)
  };
};

module.exports = { aggregateCatalog, inventorySummary };
