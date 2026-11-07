const FirstAidBox = require('../models/FirstAidBox');
const InventoryItem = require('../models/InventoryItem');
const StockTransaction = require('../models/StockTransaction');
const User = require('../models/User');
const Department = require('../models/Department');
const stock = require('../services/stockService');
const { aggregateCatalog, inventorySummary } = require('../services/inventoryService');
const { evaluateBox } = require('../services/complianceService');
const { classify } = require('../services/expiryService');
const { audit, diffFields } = require('../utils/notificationService');
const { assertCanManageKit, departmentScope, isAdmin } = require('../utils/access');
const {
  ApiError, companyIdOf, qs, searchRegex, parsePagination, paginated, pick, isValidId, dateRange
} = require('../utils/http');

const ITEM_FIELDS = ['name', 'nameHi', 'category', 'unit', 'description', 'descriptionHi', 'requiredQty', 'isMandatory',
  'prescribedBy', 'defaultShelfLifeDays', 'requiresExpiryTracking'];
const BOX_EDIT_FIELDS = ['location', 'floor', 'classType', 'inCharge', 'department', 'inspectionFrequencyDays', 'riskCategory'];

const BOX_POPULATE = [
  { path: 'department', select: 'name code' },
  { path: 'inCharge', select: 'name email phone firstAidCertified certificationExpiry' },
  { path: 'items.item', select: 'name category unit isMandatory requiresExpiryTracking' }
];

const ctxFor = (req, extra = {}) => ({
  companyId: companyIdOf(req),
  user: req.user,
  guard: (box) => assertCanManageKit(req, box),
  ...extra
});

/** Shape a kit for API responses: fresh status, compliance and per-item details. */
const presentBox = (box, { detailed = false } = {}) => {
  box.computeStatus();
  const compliance = evaluateBox(box);
  const obj = box.toObject({ virtuals: false });
  obj.compliance = { score: compliance.score, status: compliance.status, issues: compliance.issues };
  obj.items = obj.items.map((i) => {
    const qty = (i.stocks || []).reduce((s, b) => s + (b.quantity || 0), 0);
    let nearest = null;
    (i.stocks || []).forEach((b) => {
      if (b.quantity && b.expiryDate && (!nearest || new Date(b.expiryDate) < new Date(nearest))) nearest = b.expiryDate;
    });
    const expiry = classify(nearest);
    return {
      ...i,
      currentQty: qty,
      stockStatus: i.requiredQty > 0 && qty === 0 ? 'out_of_stock' : (i.requiredQty > 0 && qty < i.requiredQty ? 'low_stock' : 'in_stock'),
      nearestExpiry: nearest,
      expiryStatus: expiry.status,
      daysToExpiry: expiry.daysRemaining,
      stocks: (i.stocks || []).map((b) => ({ ...b, ...classify(b.expiryDate) }))
    };
  });
  if (detailed) {
    obj.complianceDetails = compliance;
    obj.inspectionLogs = (obj.inspectionLogs || []).slice(-20).reverse();
  } else {
    delete obj.inspectionLogs;
  }
  return obj;
};

const findKit = async (req, id, { populate = true, includeInactive = false } = {}) => {
  if (!isValidId(id)) throw ApiError.notFound('First aid kit not found');
  const filter = { _id: id, company: companyIdOf(req) };
  if (!includeInactive) filter.isActive = true;
  let q = FirstAidBox.findOne(filter);
  if (populate) q = q.populate(BOX_POPULATE);
  const box = await q;
  if (!box) throw ApiError.notFound('First aid kit not found');
  return box;
};

const validateRefs = async (req, body) => {
  const companyId = companyIdOf(req);
  if (body.department !== undefined) {
    if (!isValidId(String(body.department)) || !(await Department.exists({ _id: body.department, company: companyId, isActive: true }))) {
      throw ApiError.badRequest('Invalid department');
    }
  }
  if (body.inCharge !== undefined && body.inCharge !== null && body.inCharge !== '') {
    if (!isValidId(String(body.inCharge)) || !(await User.exists({ _id: body.inCharge, company: companyId, isActive: true }))) {
      throw ApiError.badRequest('Invalid person in charge');
    }
  } else if (body.inCharge === '') {
    body.inCharge = null;
  }
};

// ─── Catalog ────────────────────────────────────────────────────────────────

// @route GET /api/inventory/items
exports.getInventoryItems = async (req, res) => {
  const companyId = companyIdOf(req);
  const includeInactive = qs(req.query.includeInactive) === 'true';
  let list = await aggregateCatalog(companyId, { includeInactive });

  const search = qs(req.query.search);
  const category = qs(req.query.category);
  const stockStatus = qs(req.query.stockStatus);
  const expiryStatus = qs(req.query.expiryStatus);
  const mandatory = qs(req.query.mandatory);
  if (search) { const rx = searchRegex(search); list = list.filter((i) => rx.test(i.name) || rx.test(i.description || '')); }
  if (category) list = list.filter((i) => i.category === category);
  if (stockStatus) list = list.filter((i) => i.stock.stockStatus === stockStatus);
  if (expiryStatus) list = list.filter((i) => i.stock.expiryStatus === expiryStatus);
  if (mandatory) list = list.filter((i) => Boolean(i.isMandatory) === (mandatory === 'true'));

  const sortKey = qs(req.query.sort) || 'name';
  const desc = sortKey.startsWith('-');
  const key = desc ? sortKey.slice(1) : sortKey;
  const getters = {
    name: (i) => i.name.toLowerCase(),
    category: (i) => `${i.category}${i.name.toLowerCase()}`,
    quantity: (i) => i.stock.totalQty,
    fillRate: (i) => i.stock.fillRate ?? 999,
    expiry: (i) => (i.stock.nearestExpiry ? new Date(i.stock.nearestExpiry).getTime() : Infinity),
    status: (i) => ['out_of_stock', 'low_stock', 'not_stocked', 'in_stock'].indexOf(i.stock.stockStatus)
  };
  const get = getters[key] || getters.name;
  list.sort((a, b) => { const x = get(a); const y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });

  if (!req.query.page && !req.query.limit) {
    return res.json({ success: true, count: list.length, total: list.length, data: list });
  }
  const pg = parsePagination(req.query, { defaultLimit: 25 });
  res.json(paginated(list.slice(pg.skip, pg.skip + pg.limit), list.length, pg));
};

// @route GET /api/inventory/items/:id
exports.getInventoryItem = async (req, res) => {
  const companyId = companyIdOf(req);
  if (!isValidId(req.params.id)) throw ApiError.notFound('Inventory item not found');
  const item = await InventoryItem.findOne({ _id: req.params.id, $or: [{ isGlobal: true }, { company: companyId }] }).lean();
  if (!item) throw ApiError.notFound('Inventory item not found');

  const [catalog, boxes, transactions] = await Promise.all([
    aggregateCatalog(companyId, { includeInactive: true }),
    FirstAidBox.find({ company: companyId, isActive: true, 'items.item': item._id }).populate('department', 'name').lean(),
    StockTransaction.find({ company: companyId, item: item._id }).sort('-createdAt').limit(25).lean()
  ]);
  const stats = (catalog.find((c) => String(c._id) === String(item._id)) || {}).stock;

  const kits = boxes.map((box) => {
    const bi = box.items.find((i) => String(i.item) === String(item._id));
    const qty = (bi.stocks || []).reduce((s, b) => s + (b.quantity || 0), 0);
    return {
      _id: box._id,
      boxId: box.boxId,
      location: box.location,
      department: box.department && box.department.name,
      requiredQty: bi.requiredQty,
      currentQty: qty,
      stockStatus: bi.requiredQty > 0 && qty === 0 ? 'out_of_stock' : (qty < bi.requiredQty ? 'low_stock' : 'in_stock'),
      batches: (bi.stocks || []).map((b) => ({ ...b, ...classify(b.expiryDate) }))
    };
  }).sort((a, b) => a.boxId.localeCompare(b.boxId));

  res.json({ success: true, data: { ...item, stock: stats, kits, transactions } });
};

const assertCanEditItem = (req, item) => {
  if (item.isGlobal && !isAdmin(req)) {
    throw ApiError.forbidden('Statutory (global) items can only be edited by an administrator');
  }
};

const normalizeItemBody = (body) => {
  const data = pick(body, ITEM_FIELDS);
  if (data.requiredQty) data.requiredQty = pick(data.requiredQty, ['classA', 'classB', 'classC']);
  return data;
};

// @route POST /api/inventory/items
exports.createInventoryItem = async (req, res) => {
  const companyId = companyIdOf(req);
  const data = normalizeItemBody(req.body);
  const duplicate = await InventoryItem.findOne({
    name: new RegExp(`^${String(data.name || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    isActive: { $ne: false },
    $or: [{ isGlobal: true }, { company: companyId }]
  });
  if (duplicate) throw ApiError.conflict(`An item named "${duplicate.name}" already exists`);
  const item = await InventoryItem.create({ ...data, company: companyId, isGlobal: false });
  audit(req, { action: 'Created inventory item', entity: 'InventoryItem', entityId: item._id, entityLabel: item.name, details: `${item.name} (${item.category})` });
  res.status(201).json({ success: true, data: item, message: 'Inventory item created' });
};

// @route PUT /api/inventory/items/:id
exports.updateInventoryItem = async (req, res) => {
  const companyId = companyIdOf(req);
  if (!isValidId(req.params.id)) throw ApiError.notFound('Inventory item not found');
  const item = await InventoryItem.findOne({ _id: req.params.id, $or: [{ isGlobal: true }, { company: companyId }] });
  if (!item) throw ApiError.notFound('Inventory item not found');
  assertCanEditItem(req, item);

  const data = normalizeItemBody(req.body);
  if (data.name && data.name.trim().toLowerCase() !== item.name.toLowerCase()) {
    const dup = await InventoryItem.findOne({
      _id: { $ne: item._id },
      name: new RegExp(`^${data.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      isActive: { $ne: false },
      $or: [{ isGlobal: true }, { company: companyId }]
    });
    if (dup) throw ApiError.conflict(`An item named "${dup.name}" already exists`);
  }
  const before = item.toObject();
  if (data.requiredQty) {
    data.requiredQty = { ...before.requiredQty, ...data.requiredQty };
  }
  item.set(data);
  await item.save();
  audit(req, {
    action: 'Updated inventory item', entity: 'InventoryItem', entityId: item._id, entityLabel: item.name,
    changes: diffFields(before, item.toObject(), ITEM_FIELDS)
  });
  res.json({ success: true, data: item, message: 'Inventory item updated' });
};

// @route DELETE /api/inventory/items/:id  (archives the item; history is preserved)
exports.deleteInventoryItem = async (req, res) => {
  const companyId = companyIdOf(req);
  if (!isValidId(req.params.id)) throw ApiError.notFound('Inventory item not found');
  const item = await InventoryItem.findOne({ _id: req.params.id, $or: [{ isGlobal: true }, { company: companyId }] });
  if (!item || item.isActive === false) throw ApiError.notFound('Inventory item not found');
  assertCanEditItem(req, item);
  const inUse = await FirstAidBox.countDocuments({ company: companyId, isActive: true, 'items.item': item._id });
  if (inUse) {
    throw ApiError.conflict(`${item.name} is still part of ${inUse} kit(s). Remove it from those kits first.`);
  }
  item.isActive = false;
  await item.save();
  audit(req, { action: 'Archived inventory item', entity: 'InventoryItem', entityId: item._id, entityLabel: item.name });
  res.json({ success: true, message: `${item.name} archived` });
};

// @route GET /api/inventory/summary
exports.getInventorySummary = async (req, res) => {
  const { totals, byCategory } = await inventorySummary(companyIdOf(req), { departmentId: departmentScope(req) });
  res.json({ success: true, data: { totals, byCategory } });
};

// @route GET /api/inventory/transactions
exports.getTransactions = async (req, res) => {
  const filter = { company: companyIdOf(req) };
  ['box', 'item'].forEach((k) => {
    const v = qs(req.query[k]);
    if (v) { if (!isValidId(v)) throw ApiError.badRequest(`Invalid ${k}`); filter[k] = v; }
  });
  const type = qs(req.query.type);
  if (type) filter.type = type;
  const range = dateRange(req.query);
  if (range) filter.createdAt = range;
  const search = qs(req.query.search);
  if (search) { const rx = searchRegex(search); filter.$or = [{ itemName: rx }, { boxCode: rx }, { reason: rx }, { performedByName: rx }]; }
  const pg = parsePagination(req.query, { defaultLimit: 25 });
  const [rows, total] = await Promise.all([
    StockTransaction.find(filter).sort('-createdAt').skip(pg.skip).limit(pg.limit).lean(),
    StockTransaction.countDocuments(filter)
  ]);
  res.json(paginated(rows, total, pg));
};

// @route GET /api/inventory/medication-options
exports.getMedicationOptions = async (req, res) => {
  const companyId = companyIdOf(req);
  const [boxes, items] = await Promise.all([
    FirstAidBox.find({ company: companyId, isActive: true }).select('boxId location floor department items.item')
      .populate('department', 'name').sort('boxId').lean(),
    InventoryItem.find({ $or: [{ isGlobal: true }, { company: companyId }], isActive: { $ne: false } })
      .select('name category unit').sort('category name').lean()
  ]);
  res.json({
    success: true,
    data: {
      boxes: boxes.map((b) => ({ ...b, itemIds: (b.items || []).map((i) => i.item), items: undefined })),
      items
    }
  });
};

// ─── Kits ───────────────────────────────────────────────────────────────────

// @route GET /api/inventory/boxes
exports.getBoxes = async (req, res) => {
  const filter = { company: companyIdOf(req), isActive: true };
  const department = qs(req.query.department);
  if (department) { if (!isValidId(department)) throw ApiError.badRequest('Invalid department'); filter.department = department; }
  const status = qs(req.query.status);
  if (status) filter.status = status;
  const classType = qs(req.query.classType);
  if (classType) filter.classType = classType;
  const location = qs(req.query.location);
  if (location) filter.location = location;
  const search = qs(req.query.search);
  if (search) { const rx = searchRegex(search); filter.$or = [{ boxId: rx }, { location: rx }, { floor: rx }]; }

  const boxes = await FirstAidBox.find(filter).populate(BOX_POPULATE).sort('boxId');
  let list = boxes.map((b) => presentBox(b));
  // Status is time-dependent; filter again on the fresh value
  if (status) list = list.filter((b) => b.status === status);
  const compliance = qs(req.query.compliance);
  if (compliance) list = list.filter((b) => b.compliance.status === compliance);

  if (!req.query.page && !req.query.limit) {
    return res.json({ success: true, count: list.length, total: list.length, data: list });
  }
  const pg = parsePagination(req.query, { defaultLimit: 24 });
  res.json(paginated(list.slice(pg.skip, pg.skip + pg.limit), list.length, pg));
};

// @route GET /api/inventory/boxes/:id
exports.getBox = async (req, res) => {
  const box = await findKit(req, req.params.id);
  await box.populate('inspectionLogs.inspectedBy', 'name');
  res.json({ success: true, data: presentBox(box, { detailed: true }) });
};

// @route POST /api/inventory/boxes
exports.createBox = async (req, res) => {
  const companyId = companyIdOf(req);
  const data = pick(req.body, ['boxId', ...BOX_EDIT_FIELDS]);
  if (!data.boxId || !String(data.boxId).trim()) throw ApiError.badRequest('Kit ID is required');
  data.boxId = String(data.boxId).trim().toUpperCase();
  if (data.department === undefined) throw ApiError.badRequest('Department is required');
  await validateRefs(req, data);
  if (req.user.role === 'manager') assertCanManageKit(req, { department: data.department });
  if (await FirstAidBox.exists({ boxId: data.boxId })) throw ApiError.conflict(`Kit ID ${data.boxId} is already in use`);

  // Populate the contents list from the catalog's statutory quantities for the kit class.
  const classKey = `class${data.classType || 'B'}`;
  let items = [];
  if (req.body.populateFromClass !== false) {
    const catalog = await InventoryItem.find({
      isActive: { $ne: false }, $or: [{ isGlobal: true }, { company: companyId }],
      [`requiredQty.${classKey}`]: { $gt: 0 }
    }).select('_id requiredQty');
    items = catalog.map((c) => ({ item: c._id, requiredQty: c.requiredQty[classKey], stocks: [] }));
  }

  const now = new Date();
  const freq = data.inspectionFrequencyDays || 30;
  const box = await FirstAidBox.create({
    ...data,
    company: companyId,
    items,
    // A new kit must be inspected before it counts as compliant.
    nextInspectionDue: now,
    inspectionFrequencyDays: freq
  });
  audit(req, { action: 'Created first aid kit', entity: 'FirstAidBox', entityId: box._id, entityLabel: box.boxId, details: `${box.boxId} at ${box.location} (Class ${box.classType}, ${items.length} items)` });
  await box.populate(BOX_POPULATE);
  res.status(201).json({ success: true, data: presentBox(box), message: `Kit ${box.boxId} created` });
};

// @route PUT /api/inventory/boxes/:id
exports.updateBox = async (req, res) => {
  const box = await findKit(req, req.params.id, { populate: false });
  assertCanManageKit(req, box);
  const data = pick(req.body, BOX_EDIT_FIELDS);
  await validateRefs(req, data);
  if (data.department !== undefined && req.user.role === 'manager') assertCanManageKit(req, { department: data.department });
  const before = box.toObject();
  box.set(data);
  if (data.inspectionFrequencyDays && box.lastInspectionDate) {
    box.nextInspectionDue = new Date(box.lastInspectionDate.getTime() + box.inspectionFrequencyDays * 86400000);
  }
  await box.save();
  audit(req, {
    action: 'Updated first aid kit', entity: 'FirstAidBox', entityId: box._id, entityLabel: box.boxId,
    changes: diffFields(before, box.toObject(), BOX_EDIT_FIELDS)
  });
  await box.populate(BOX_POPULATE);
  res.json({ success: true, data: presentBox(box), message: 'Kit updated' });
};

// @route DELETE /api/inventory/boxes/:id  (retires the kit; history is preserved)
exports.deleteBox = async (req, res) => {
  const reason = req.body && req.body.reason ? String(req.body.reason).trim().slice(0, 300) : 'Kit retired';
  const { box } = await stock.mutateBox({
    ...ctxFor(req),
    boxId: req.params.id,
    apply: (b) => {
      const specs = b.items
        .map((i) => ({ i, qty: (i.stocks || []).reduce((s, x) => s + x.quantity, 0) }))
        .filter(({ qty }) => qty > 0)
        .map(({ i, qty }) => ({
          item: stock.idOf(i.item), itemName: (i.item && i.item.name) || 'Item', type: 'kit_retired',
          quantityChange: -qty, quantityBefore: qty, quantityAfter: qty, reason
        }));
      b.isActive = false;
      b.retiredAt = new Date();
      b.retiredReason = reason;
      // Ledger records the write-off; quantities are kept on the retired kit for audit.
      return specs.map((s) => ({ ...s, quantityAfter: 0 }));
    }
  });
  audit(req, { action: 'Retired first aid kit', entity: 'FirstAidBox', entityId: box._id, entityLabel: box.boxId, details: reason });
  res.json({ success: true, message: `Kit ${box.boxId} retired` });
};

// ─── Kit contents & stock ───────────────────────────────────────────────────

const respondWithKit = async (req, res, result, message, status = 200) => {
  const box = await findKit(req, result.box._id);
  res.status(status).json({ success: true, data: presentBox(box, { detailed: true }), message });
};

const stockAudit = (req, box, action, details) => audit(req, {
  action, entity: 'Inventory', entityId: box._id, entityLabel: box.boxId, details
});

// @route POST /api/inventory/boxes/:id/items
exports.addBoxItem = async (req, res) => {
  const result = await stock.addItemToBox(ctxFor(req, { boxId: req.params.id }), { itemId: req.body.itemId, requiredQty: req.body.requiredQty });
  stockAudit(req, result.box, 'Added item to kit', `${result.transactions[0].itemName} added to ${result.box.boxId}`);
  await respondWithKit(req, res, result, 'Item added to kit', 201);
};

// @route PUT /api/inventory/boxes/:id/items/:itemId
exports.updateBoxItem = async (req, res) => {
  const result = await stock.updateRequirement(ctxFor(req, { boxId: req.params.id }), { itemId: req.params.itemId, requiredQty: req.body.requiredQty });
  stockAudit(req, result.box, 'Changed required quantity', `Required quantity set to ${req.body.requiredQty}`);
  await respondWithKit(req, res, result, 'Required quantity updated');
};

// @route DELETE /api/inventory/boxes/:id/items/:itemId
exports.removeBoxItem = async (req, res) => {
  const result = await stock.removeItemFromBox(ctxFor(req, { boxId: req.params.id }), { itemId: req.params.itemId, reason: req.body && req.body.reason });
  stockAudit(req, result.box, 'Removed item from kit', `${result.transactions[0].itemName} removed from ${result.box.boxId}`);
  await respondWithKit(req, res, result, 'Item removed from kit');
};

// @route POST /api/inventory/boxes/:id/items/:itemId/restock
exports.restockItem = async (req, res) => {
  const result = await stock.restock(ctxFor(req, { boxId: req.params.id }), { ...req.body, itemId: req.params.itemId });
  const t = result.transactions[0];
  stockAudit(req, result.box, 'Restocked item', `+${t.quantityChange} ${t.itemName} (${t.quantityBefore} → ${t.quantityAfter})`);
  await respondWithKit(req, res, result, `Added ${t.quantityChange} unit(s) of ${t.itemName}`);
};

// @route POST /api/inventory/boxes/:id/items/:itemId/dispense
exports.dispenseItem = async (req, res) => {
  const result = await stock.dispense(ctxFor(req, { boxId: req.params.id }), {
    itemId: req.params.itemId, quantity: req.body.quantity, reason: req.body.reason
  });
  const t = result.transactions[0];
  stockAudit(req, result.box, 'Dispensed item', `${t.quantityChange} ${t.itemName} (${t.quantityBefore} → ${t.quantityAfter})`);
  await respondWithKit(req, res, result, `Dispensed ${-t.quantityChange} unit(s) of ${t.itemName}`);
};

// @route POST /api/inventory/boxes/:id/items/:itemId/adjust
exports.adjustItem = async (req, res) => {
  const result = await stock.adjustBatch(ctxFor(req, { boxId: req.params.id }), {
    itemId: req.params.itemId, stockId: req.body.stockId, quantity: req.body.quantity, reason: req.body.reason
  });
  const t = result.transactions[0];
  stockAudit(req, result.box, 'Adjusted stock', `${t.itemName}: ${t.quantityBefore} → ${t.quantityAfter} (${t.reason})`);
  await respondWithKit(req, res, result, 'Stock adjusted');
};

// @route POST /api/inventory/boxes/:id/remove-expired  and  /boxes/:id/items/:itemId/remove-expired
exports.removeExpired = async (req, res) => {
  const result = await stock.removeExpired(ctxFor(req, { boxId: req.params.id }), { itemId: req.params.itemId, reason: req.body && req.body.reason });
  const units = result.transactions.reduce((s, t) => s - t.quantityChange, 0);
  stockAudit(req, result.box, 'Removed expired stock', `${units} expired unit(s) removed from ${result.box.boxId}`);
  await respondWithKit(req, res, result, `Removed ${units} expired unit(s)`);
};

// @route PUT /api/inventory/boxes/:id/items/:itemId/stocks  (bulk batch editor)
exports.updateItemStocks = async (req, res) => {
  const result = await stock.setBatches(ctxFor(req, { boxId: req.params.id }), {
    itemId: req.params.itemId, stocks: req.body.stocks, reason: req.body.reason
  });
  const t = result.transactions[0];
  if (t) stockAudit(req, result.box, 'Updated stock batches', `${t.itemName}: ${t.quantityBefore} → ${t.quantityAfter}`);
  await respondWithKit(req, res, result, 'Stock updated');
};

// @route PUT /api/inventory/boxes/:id/replenish  body: { items: [{ itemId, quantity, batchNumber, expiryDate }] }
exports.replenishBox = async (req, res) => {
  const result = await stock.restockMany(ctxFor(req, { boxId: req.params.id }), req.body.items);
  const units = result.transactions.reduce((s, t) => s + t.quantityChange, 0);
  stockAudit(req, result.box, 'Replenished kit', `${units} unit(s) across ${result.transactions.length} item(s)`);
  await respondWithKit(req, res, result, `Kit replenished with ${units} unit(s)`);
};

module.exports.presentBox = presentBox;
module.exports.findKit = findKit;
