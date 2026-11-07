const mongoose = require('mongoose');
const FirstAidBox = require('../models/FirstAidBox');
const Incident = require('../models/Incident');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const StockTransaction = require('../models/StockTransaction');
const { inventorySummary } = require('../services/inventoryService');
const { collectEntries, summarize, timeline } = require('../services/expiryService');
const { companyCompliance } = require('../services/complianceService');
const { departmentScope, isCompanyWide } = require('../utils/access');
const { companyIdOf } = require('../utils/http');

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// @route GET /api/dashboard
exports.getDashboard = async (req, res) => {
  const companyId = toObjectId(companyIdOf(req));
  const departmentId = departmentScope(req);
  const role = req.user.role;

  const boxFilter = { company: companyId, isActive: true };
  if (departmentId) boxFilter.department = departmentId;

  const incidentMatch = { company: companyId };
  if (departmentId) incidentMatch.department = toObjectId(departmentId);
  if (role === 'employee') incidentMatch.reportedBy = req.user._id;

  const [boxes, inventory, compliance, openIncidents, incidents30, alerts, unreadCount] = await Promise.all([
    FirstAidBox.find(boxFilter).populate('items.item', 'name category unit').populate('department', 'name code'),
    inventorySummary(companyId, { departmentId }),
    role === 'employee' ? null : companyCompliance(companyId, { departmentId }),
    Incident.countDocuments({ ...incidentMatch, status: { $in: ['reported', 'under_investigation'] } }),
    Incident.countDocuments({ ...incidentMatch, dateTime: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    Notification.find({ recipient: req.user._id, archivedAt: null, isRead: false })
      .sort({ createdAt: -1 }).limit(30).lean()
      .then((list) => {
        const rank = { critical: 0, warning: 1, info: 2, low: 3 };
        return list.sort((a, b) => (rank[a.severity] ?? 4) - (rank[b.severity] ?? 4)).slice(0, 6);
      }),
    Notification.countDocuments({ recipient: req.user._id, archivedAt: null, isRead: false })
  ]);

  boxes.forEach((b) => b.computeStatus());
  const entries = collectEntries(boxes);
  const expiry = summarize(entries, boxes.length);

  const kitStatus = ['adequate', 'needs_replenishment', 'items_expired', 'overdue_inspection']
    .map((s) => ({ status: s, count: boxes.filter((b) => b.status === s).length }));

  // Stock level per department: share of required units present (capped per item)
  const deptMap = new Map();
  boxes.forEach((b) => {
    const key = b.department ? String(b.department._id) : 'none';
    const row = deptMap.get(key) || { department: b.department ? b.department.name : 'Unassigned', code: b.department && b.department.code, kits: 0, required: 0, present: 0, lowItems: 0 };
    row.kits += 1;
    b.items.forEach((i) => {
      if (!i.requiredQty) return;
      row.required += i.requiredQty;
      row.present += Math.min(i.currentQty, i.requiredQty);
      if (i.currentQty < i.requiredQty) row.lowItems += 1;
    });
    deptMap.set(key, row);
  });
  const stockByDepartment = [...deptMap.values()]
    .map((r) => ({ ...r, fillRate: r.required ? Math.round((r.present / r.required) * 100) : 100 }))
    .sort((a, b) => a.fillRate - b.fillRate);

  // Recent activity
  let recentActivity = [];
  if (isCompanyWide(req)) {
    recentActivity = await AuditLog.find({ company: companyId }).sort('-createdAt').limit(8).lean();
  } else if (role === 'manager') {
    const ids = boxes.map((b) => b._id);
    const tx = await StockTransaction.find({ company: companyId, box: { $in: ids } }).sort('-createdAt').limit(8).lean();
    recentActivity = tx.map((t) => ({
      _id: t._id,
      createdAt: t.createdAt,
      userName: t.performedByName || 'System',
      action: `${t.type.replace(/_/g, ' ')} · ${t.itemName}`,
      entity: 'Inventory',
      entityLabel: t.boxCode,
      details: `${t.quantityChange > 0 ? '+' : ''}${t.quantityChange} (${t.quantityBefore} → ${t.quantityAfter})`
    }));
  }

  const attentionKits = boxes
    .filter((b) => b.status !== 'adequate')
    .sort((a, b) => ['items_expired', 'needs_replenishment', 'overdue_inspection'].indexOf(a.status) - ['items_expired', 'needs_replenishment', 'overdue_inspection'].indexOf(b.status))
    .slice(0, 6)
    .map((b) => ({ _id: b._id, boxId: b.boxId, location: b.location, department: b.department && b.department.name, status: b.status, health: b.health }));

  res.json({
    success: true,
    data: {
      scope: departmentId ? 'department' : 'company',
      kits: { total: boxes.length, byStatus: kitStatus, attention: attentionKits },
      inventory: inventory.totals,
      inventoryByCategory: inventory.byCategory,
      lowStockItems: inventory.catalog
        .filter((i) => ['low_stock', 'out_of_stock'].includes(i.stock.stockStatus))
        .sort((a, b) => (a.stock.fillRate ?? 0) - (b.stock.fillRate ?? 0))
        .slice(0, 6)
        .map((i) => ({ _id: i._id, name: i.name, unit: i.unit, category: i.category, ...i.stock })),
      expiry: { ...expiry, timeline: timeline(entries) },
      expiringSoon: entries
        .filter((e) => ['expired', 'critical', 'soon'].includes(e.status))
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 8),
      compliance: compliance && {
        overallCompliance: compliance.overallCompliance,
        complianceStatus: compliance.complianceStatus,
        summary: compliance.summary,
        checks: compliance.checks,
        pendingActions: compliance.pendingActions.slice(0, 6)
      },
      stockByDepartment,
      incidents: { open: openIncidents, last30Days: incidents30 },
      alerts,
      unreadNotifications: unreadCount,
      recentActivity
    }
  });
};
