const mongoose = require('mongoose');
const FirstAidBox = require('../models/FirstAidBox');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const Incident = require('../models/Incident');
const { ApiError } = require('../utils/http');

/**
 * Stock service — the ONLY place that changes quantities inside first aid kits.
 *
 * Guarantees:
 *  - quantities are whole numbers and can never become negative;
 *  - each kit item's quantity is always the sum of its batches;
 *  - concurrent updates to the same kit are detected (optimistic concurrency on
 *    the kit document) and retried, so no update is lost;
 *  - every movement is recorded in the StockTransaction ledger.
 */

const MAX_RETRIES = 10;
const backoff = (attempt) => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15 * attempt) + 5));
const idOf = (v) => (v && v._id ? v._id : v);
const sameId = (a, b) => a != null && b != null && String(idOf(a)) === String(idOf(b));
const qtyOf = (boxItem) => FirstAidBox.itemQuantity(boxItem);

const toInt = (value, name, { min = 0 } = {}) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw ApiError.badRequest(`${name} must be a whole number${min > 0 ? ` of at least ${min}` : ' of 0 or more'}`);
  }
  return n;
};

const toDate = (value, name) => {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`Invalid ${name}`);
  return d;
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const findBoxItem = (box, itemId) => {
  const boxItem = box.items.find((i) => sameId(i.item, itemId));
  if (!boxItem) throw ApiError.notFound('This item is not part of the kit');
  return boxItem;
};

const itemName = (boxItem) => (boxItem.item && boxItem.item.name) || 'Item';

/** Sort batches for dispensing: unexpired first (soonest expiry first), then expired. */
const dispenseOrder = (stocks, now = new Date()) => [...stocks].sort((a, b) => {
  const aExp = a.expiryDate && new Date(a.expiryDate) < now;
  const bExp = b.expiryDate && new Date(b.expiryDate) < now;
  if (aExp !== bExp) return aExp ? 1 : -1;
  if (!a.expiryDate) return 1;
  if (!b.expiryDate) return -1;
  return new Date(a.expiryDate) - new Date(b.expiryDate);
});

/**
 * Load a kit, apply `apply(box)` (which mutates it and returns transaction
 * specs), save with optimistic concurrency, retry on conflicts, then record the
 * transactions and evaluate alerts.
 */
const mutateBox = async ({ companyId, boxId, user, reference, apply, guard, allowInactive = false }) => {
  if (!mongoose.Types.ObjectId.isValid(String(boxId))) throw ApiError.notFound('First aid kit not found');

  for (let attempt = 1; ; attempt += 1) {
    const filter = { _id: boxId, company: companyId };
    if (!allowInactive) filter.isActive = true;
    const box = await FirstAidBox.findOne(filter).populate('items.item', 'name unit category isMandatory');
    if (!box) throw ApiError.notFound('First aid kit not found');
    if (guard) guard(box);
    // Bring legacy single-quantity items into batch form before changing anything
    box.migrateLegacyStock();

    const specs = (await apply(box)) || [];
    try {
      await box.save();
    } catch (err) {
      if (err.name === 'VersionError' && attempt < MAX_RETRIES) { await backoff(attempt); continue; }
      throw err;
    }

    if (specs.length) {
      await StockTransaction.insertMany(specs.map((s) => ({
        company: box.company,
        box: box._id,
        boxCode: box.boxId,
        performedBy: user && user._id,
        performedByName: user && user.name,
        reference,
        ...s
      })));
    }

    // Evaluate low-stock / out-of-stock / expiry alerts for the changed kit.
    try {
      const { evaluateBoxAlerts } = require('./monitoringService');
      await evaluateBoxAlerts(box);
    } catch (err) {
      console.error('Alert evaluation failed for kit', box.boxId, err.message);
    }

    return { box, transactions: specs };
  }
};

// ─── Operations ─────────────────────────────────────────────────────────────

/** Add a new batch of an item to a kit. */
const restock = (ctx, { itemId, quantity, batchNumber, expiryDate, manufacturingDate, supplier, purchaseDate, reason }) => {
  const qty = toInt(quantity, 'Quantity', { min: 1 });
  const exp = toDate(expiryDate, 'expiry date');
  if (exp && exp < startOfToday()) throw ApiError.badRequest('Cannot add stock that has already expired');
  const mfg = toDate(manufacturingDate, 'manufacturing date');
  if (mfg && exp && mfg > exp) throw ApiError.badRequest('Manufacturing date must be before the expiry date');

  return mutateBox({
    ...ctx,
    apply: (box) => {
      const boxItem = findBoxItem(box, itemId);
      const before = qtyOf(boxItem);
      boxItem.stocks.push({
        batchNumber: batchNumber ? String(batchNumber).trim() : undefined,
        quantity: qty,
        expiryDate: exp,
        manufacturingDate: mfg,
        supplier: supplier ? String(supplier).trim() : undefined,
        purchaseDate: toDate(purchaseDate, 'purchase date'),
        addedAt: new Date()
      });
      boxItem.lastRestocked = new Date();
      return [{
        item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'restock',
        quantityChange: qty, quantityBefore: before, quantityAfter: before + qty,
        batchNumber, expiryDate: exp, reason
      }];
    }
  });
};

/**
 * Remove units of an item, oldest expiry first.
 *  - Manual dispensing (allowShortfall=false) never hands out expired units and
 *    is rejected when there is not enough usable stock.
 *  - Recorded usage (incidents/treatments, allowShortfall=true) deducts what is
 *    physically there and records any shortfall instead of going negative.
 */
const dispenseFromBoxItem = (boxItem, quantity, { allowShortfall, now = new Date() }) => {
  const before = qtyOf(boxItem);
  const usable = boxItem.stocks.filter((s) => !s.expiryDate || new Date(s.expiryDate) >= now);
  const pool = allowShortfall ? boxItem.stocks : usable;
  const available = pool.reduce((sum, s) => sum + s.quantity, 0);
  if (!allowShortfall && available < quantity) {
    throw ApiError.conflict(`Only ${available} usable unit(s) of ${itemName(boxItem)} available in this kit`);
  }
  let remaining = quantity;
  for (const stock of dispenseOrder(pool, now)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, stock.quantity);
    stock.quantity -= take;
    remaining -= take;
  }
  boxItem.stocks = boxItem.stocks.filter((s) => s.quantity > 0);
  const after = qtyOf(boxItem);
  return { before, after, shortfall: Math.max(0, remaining) };
};

const dispense = (ctx, { itemId, quantity, reason, allowShortfall = false }) => {
  const qty = toInt(quantity, 'Quantity', { min: 1 });
  return mutateBox({
    ...ctx,
    apply: (box) => {
      const boxItem = findBoxItem(box, itemId);
      const { before, after, shortfall } = dispenseFromBoxItem(boxItem, qty, { allowShortfall });
      return [{
        item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'dispense',
        quantityChange: after - before, quantityBefore: before, quantityAfter: after, reason, shortfall
      }];
    }
  });
};

/** Correct the quantity of one batch (e.g. after a physical count). 0 removes the batch. */
const adjustBatch = (ctx, { itemId, stockId, quantity, reason }) => {
  const qty = toInt(quantity, 'Quantity');
  if (!reason || !String(reason).trim()) throw ApiError.badRequest('A reason is required for stock adjustments');
  return mutateBox({
    ...ctx,
    apply: (box) => {
      const boxItem = findBoxItem(box, itemId);
      const stock = boxItem.stocks.id(stockId);
      if (!stock) throw ApiError.notFound('Batch not found');
      const before = qtyOf(boxItem);
      if (stock.quantity === qty) throw ApiError.badRequest('Quantity is unchanged');
      const { batchNumber, expiryDate } = stock;
      if (qty === 0) boxItem.stocks.pull(stock._id);
      else stock.quantity = qty;
      const after = qtyOf(boxItem);
      return [{
        item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'adjustment',
        quantityChange: after - before, quantityBefore: before, quantityAfter: after,
        batchNumber, expiryDate, reason: String(reason).trim()
      }];
    }
  });
};

/**
 * Replace all batches of an item (bulk editor). Existing batches are matched by
 * _id; the net change is recorded as one adjustment (or restock if only added).
 */
const setBatches = (ctx, { itemId, stocks, reason }) => {
  if (!Array.isArray(stocks)) throw ApiError.badRequest('stocks must be an array of batches');
  if (stocks.length > 100) throw ApiError.badRequest('Too many batches');
  const clean = stocks.map((s, i) => {
    const quantity = toInt(s.quantity, `Batch ${i + 1} quantity`);
    const expiryDate = toDate(s.expiryDate, `batch ${i + 1} expiry date`);
    return {
      ...(s._id && mongoose.Types.ObjectId.isValid(String(s._id)) ? { _id: s._id } : {}),
      batchNumber: s.batchNumber ? String(s.batchNumber).trim().slice(0, 60) : undefined,
      quantity,
      expiryDate,
      manufacturingDate: toDate(s.manufacturingDate, `batch ${i + 1} manufacturing date`),
      supplier: s.supplier ? String(s.supplier).trim().slice(0, 120) : undefined,
      purchaseDate: toDate(s.purchaseDate, `batch ${i + 1} purchase date`),
      addedAt: toDate(s.addedAt, 'added date') || new Date()
    };
  }).filter((s) => s.quantity > 0);

  return mutateBox({
    ...ctx,
    apply: (box) => {
      const boxItem = findBoxItem(box, itemId);
      const before = qtyOf(boxItem);
      const original = new Map(boxItem.stocks.map((s) => [String(s._id), s.quantity]));
      const added = clean.filter((s) => !s._id || !original.has(String(s._id)));
      const newExpired = added.find((s) => s.expiryDate && s.expiryDate < startOfToday());
      if (newExpired) throw ApiError.badRequest('Cannot add a batch that has already expired');
      const keptIds = new Set(clean.filter((s) => s._id).map((s) => String(s._id)));
      const anyReduced = [...original.keys()].some((id) => !keptIds.has(id))
        || clean.some((s) => s._id && original.has(String(s._id)) && s.quantity < original.get(String(s._id)));

      boxItem.stocks = clean;
      const after = qtyOf(boxItem);
      if (added.length) boxItem.lastRestocked = new Date();
      if (after === before && !added.length) return [];
      return [{
        item: idOf(boxItem.item), itemName: itemName(boxItem),
        type: after > before && !anyReduced ? 'restock' : 'adjustment',
        quantityChange: after - before, quantityBefore: before, quantityAfter: after,
        reason: reason || 'Batch details updated'
      }];
    }
  });
};

/** Remove expired batches from a kit (one item, or all items). */
const removeExpired = (ctx, { itemId, reason } = {}) => mutateBox({
  ...ctx,
  apply: (box) => {
    const now = new Date();
    const specs = [];
    box.items.forEach((boxItem) => {
      if (itemId && !sameId(boxItem.item, itemId)) return;
      const expired = boxItem.stocks.filter((s) => s.expiryDate && new Date(s.expiryDate) < now && s.quantity > 0);
      if (!expired.length) return;
      let running = qtyOf(boxItem);
      expired.forEach((s) => {
        specs.push({
          item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'expired_removal',
          quantityChange: -s.quantity, quantityBefore: running, quantityAfter: running - s.quantity,
          batchNumber: s.batchNumber, expiryDate: s.expiryDate, reason: reason || 'Expired stock removed'
        });
        running -= s.quantity;
        boxItem.stocks.pull(s._id);
      });
    });
    if (!specs.length) throw ApiError.badRequest('There is no expired stock to remove');
    return specs;
  }
});

/** Add a catalog item to a kit's contents list. */
const addItemToBox = async (ctx, { itemId, requiredQty }) => {
  const req = toInt(requiredQty ?? 0, 'Required quantity');
  if (!mongoose.Types.ObjectId.isValid(String(itemId))) throw ApiError.badRequest('Invalid item');
  const catalogItem = await InventoryItem.findOne({
    _id: itemId, isActive: { $ne: false }, $or: [{ isGlobal: true }, { company: ctx.companyId }]
  });
  if (!catalogItem) throw ApiError.notFound('Inventory item not found');
  return mutateBox({
    ...ctx,
    apply: (box) => {
      if (box.items.some((i) => sameId(i.item, itemId))) throw ApiError.conflict(`${catalogItem.name} is already in this kit`);
      box.items.push({ item: catalogItem._id, requiredQty: req, stocks: [], currentQty: 0 });
      return [{
        item: catalogItem._id, itemName: catalogItem.name, type: 'item_added',
        quantityChange: 0, quantityBefore: 0, quantityAfter: 0, reason: `Added to kit (required: ${req})`
      }];
    }
  });
};

/** Change the minimum required quantity (low-stock threshold) of a kit item. */
const updateRequirement = (ctx, { itemId, requiredQty }) => {
  const req = toInt(requiredQty, 'Required quantity');
  return mutateBox({
    ...ctx,
    apply: (box) => {
      const boxItem = findBoxItem(box, itemId);
      boxItem.requiredQty = req;
      return [];
    }
  });
};

/** Remove an item from a kit's contents. Any remaining stock is written off and logged. */
const removeItemFromBox = (ctx, { itemId, reason }) => mutateBox({
  ...ctx,
  apply: (box) => {
    const boxItem = findBoxItem(box, itemId);
    const before = qtyOf(boxItem);
    const spec = {
      item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'item_removed',
      quantityChange: -before, quantityBefore: before, quantityAfter: 0, reason: reason || 'Removed from kit'
    };
    box.items = box.items.filter((i) => !sameId(i.item, itemId));
    return [spec];
  }
});

/** Bulk restock: add one batch per entry. */
const restockMany = (ctx, entries) => {
  if (!Array.isArray(entries) || !entries.length) throw ApiError.badRequest('Provide at least one item to restock');
  const clean = entries.map((e, i) => ({
    itemId: e.itemId || e.item,
    quantity: toInt(e.quantity, `Entry ${i + 1} quantity`, { min: 1 }),
    batchNumber: e.batchNumber,
    expiryDate: toDate(e.expiryDate, `entry ${i + 1} expiry date`),
    supplier: e.supplier
  }));
  if (clean.some((e) => e.expiryDate && e.expiryDate < startOfToday())) {
    throw ApiError.badRequest('Cannot add stock that has already expired');
  }
  return mutateBox({
    ...ctx,
    apply: (box) => clean.map((e) => {
      const boxItem = findBoxItem(box, e.itemId);
      const before = qtyOf(boxItem);
      boxItem.stocks.push({ batchNumber: e.batchNumber, quantity: e.quantity, expiryDate: e.expiryDate, supplier: e.supplier, addedAt: new Date() });
      boxItem.lastRestocked = new Date();
      return {
        item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'restock',
        quantityChange: e.quantity, quantityBefore: before, quantityAfter: before + e.quantity,
        batchNumber: e.batchNumber, expiryDate: e.expiryDate, reason: 'Replenishment'
      };
    })
  });
};

/**
 * Deduct supplies recorded against an incident — exactly once.
 * The `stockDeducted` flag is claimed atomically, so repeated workflow steps
 * (manager confirmation, doctor review, edits) can never deduct twice.
 */
const deductForIncident = async (incident, user) => {
  if (!incident.firstAidBoxUsed || !incident.itemsUsed || !incident.itemsUsed.length) return null;
  const claim = await Incident.updateOne(
    { _id: incident._id, stockDeducted: { $ne: true } },
    { $set: { stockDeducted: true, stockDeductedAt: new Date() } }
  );
  if (claim.modifiedCount !== 1) return null; // already deducted

  try {
    const result = await mutateBox({
      companyId: incident.company,
      boxId: idOf(incident.firstAidBoxUsed),
      user,
      reference: { model: 'Incident', id: incident._id, label: incident.incidentId },
      apply: (box) => incident.itemsUsed
        .filter((u) => u.item && u.quantity > 0)
        .map((usage) => {
          const boxItem = box.items.find((i) => sameId(i.item, usage.item));
          if (!boxItem) return null;
          const { before, after, shortfall } = dispenseFromBoxItem(boxItem, usage.quantity, { allowShortfall: true });
          return {
            item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'dispense',
            quantityChange: after - before, quantityBefore: before, quantityAfter: after, shortfall,
            reason: `Used for incident ${incident.incidentId}`
          };
        })
        .filter(Boolean)
    });
    incident.stockDeducted = true;
    return result;
  } catch (err) {
    await Incident.updateOne({ _id: incident._id }, { $set: { stockDeducted: false }, $unset: { stockDeductedAt: 1 } });
    throw err;
  }
};

/** Deduct supplies recorded against a treatment. */
const deductForTreatment = (treatment, user) => {
  const meds = (treatment.medicinesUsed || []).filter((m) => m.item && m.quantity > 0);
  if (!treatment.firstAidBoxUsed || !meds.length) return null;
  return mutateBox({
    companyId: treatment.company,
    boxId: idOf(treatment.firstAidBoxUsed),
    user,
    reference: { model: 'TreatmentRecord', id: treatment._id, label: treatment.treatmentId },
    apply: (box) => meds.map((med) => {
      const boxItem = box.items.find((i) => sameId(i.item, med.item));
      if (!boxItem) return null;
      const { before, after, shortfall } = dispenseFromBoxItem(boxItem, med.quantity, { allowShortfall: true });
      return {
        item: idOf(boxItem.item), itemName: itemName(boxItem), type: 'dispense',
        quantityChange: after - before, quantityBefore: before, quantityAfter: after, shortfall,
        reason: `Used for treatment ${treatment.treatmentId}`
      };
    }).filter(Boolean)
  });
};

module.exports = {
  mutateBox,
  restock,
  restockMany,
  dispense,
  adjustBatch,
  setBatches,
  removeExpired,
  addItemToBox,
  updateRequirement,
  removeItemFromBox,
  deductForIncident,
  deductForTreatment,
  dispenseOrder,
  sameId,
  idOf
};
