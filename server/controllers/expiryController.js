const FirstAidBox = require('../models/FirstAidBox');
const { notifySafetyTeam, createAuditLog } = require('../utils/notificationService');

// Helper: extract expiry entries from a box item (stocks-aware)
function getExpiryEntries(item, box) {
  const entries = [];
  const baseEntry = {
    boxId: box.boxId,
    boxLocation: box.location,
    department: box.department?.name || 'Unknown',
    itemName: item.item?.name || 'Unknown Item',
    itemCategory: item.item?.category || 'other',
    supplier: item.supplier
  };

  if (item.stocks && item.stocks.length > 0) {
    item.stocks.forEach(stock => {
      entries.push({
        ...baseEntry,
        currentQty: stock.quantity,
        expiryDate: stock.expiryDate,
        batchNumber: stock.batchNumber,
        supplier: stock.supplier || baseEntry.supplier,
        stockId: stock._id
      });
    });
  } else {
    // Legacy single-entry item
    entries.push({
      ...baseEntry,
      currentQty: item.currentQty,
      expiryDate: item.expiryDate,
      batchNumber: item.batchNumber,
      stockId: null
    });
  }

  return entries;
}

// @desc    Get expiry dashboard — aggregate expiry data across all boxes
// @route   GET /api/expiry/dashboard
// @access  Protected
exports.getExpiryDashboard = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const boxes = await FirstAidBox.find({ company: companyId, isActive: true })
      .populate('items.item', 'name category unit')
      .populate('department', 'name code');

    const stats = {
      expired: [],
      critical7: [],   // expiring within 7 days
      critical30: [],  // expiring within 30 days
      warning90: [],   // expiring within 90 days
      healthy: []
    };

    let totalItems = 0;

    boxes.forEach(box => {
      box.items.forEach(item => {
        const entries = getExpiryEntries(item, box);

        entries.forEach(entry => {
          totalItems++;

          if (!entry.expiryDate) {
            stats.healthy.push(entry);
            return;
          }

          const exp = new Date(entry.expiryDate);
          if (exp < now) {
            stats.expired.push(entry);
          } else if (exp <= d7) {
            stats.critical7.push(entry);
          } else if (exp <= d30) {
            stats.critical30.push(entry);
          } else if (exp <= d90) {
            stats.warning90.push(entry);
          } else {
            stats.healthy.push(entry);
          }
        });
      });
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalItems,
          totalBoxes: boxes.length,
          expiredCount: stats.expired.length,
          critical7Count: stats.critical7.length,
          critical30Count: stats.critical30.length,
          warning90Count: stats.warning90.length,
          healthyCount: stats.healthy.length
        },
        items: stats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get expiring items with filtering
// @route   GET /api/expiry/items
// @access  Protected
exports.getExpiringItems = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const { category, department, daysLeft = 90 } = req.query;

    const filter = { company: companyId, isActive: true };
    if (department) filter.department = department;

    const boxes = await FirstAidBox.find(filter)
      .populate('items.item', 'name category unit')
      .populate('department', 'name code');

    const now = new Date();
    const cutoff = new Date(now.getTime() + parseInt(daysLeft) * 24 * 60 * 60 * 1000);

    const expiringItems = [];
    boxes.forEach(box => {
      box.items.forEach(item => {
        const entries = getExpiryEntries(item, box);

        entries.forEach(entry => {
          if (!entry.expiryDate) return;
          if (category && item.item?.category !== category) return;

          const exp = new Date(entry.expiryDate);
          if (exp > cutoff) return;

          const daysRemaining = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));

          expiringItems.push({
            ...entry,
            boxObjectId: box._id,
            departmentId: box.department?._id,
            daysRemaining,
            status: daysRemaining < 0 ? 'expired' : daysRemaining <= 30 ? 'critical' : 'warning'
          });
        });
      });
    });

    // Sort by days remaining (most urgent first)
    expiringItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.json({
      success: true,
      count: expiringItems.length,
      data: expiringItems
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check all boxes and generate expiry alerts
// @route   POST /api/expiry/check-alerts
// @access  Admin, Safety Officer
exports.checkAndGenerateExpiryAlerts = async (req, res, next) => {
  try {
    const companyId = req.user.company._id || req.user.company;
    const now = new Date();

    const boxes = await FirstAidBox.find({ company: companyId, isActive: true })
      .populate('items.item', 'name category');

    const alerts = [];
    const alertThresholds = [
      { days: 0, label: 'EXPIRED', severity: 'critical' },
      { days: 7, label: 'expiring in 7 days', severity: 'critical' },
      { days: 30, label: 'expiring in 30 days', severity: 'warning' },
      { days: 90, label: 'expiring in 90 days', severity: 'info' }
    ];

    boxes.forEach(box => {
      box.items.forEach(item => {
        const entries = getExpiryEntries(item, box);

        entries.forEach(entry => {
          if (!entry.expiryDate) return;

          const exp = new Date(entry.expiryDate);
          const daysRemaining = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));

          for (const threshold of alertThresholds) {
            if (daysRemaining <= threshold.days) {
              alerts.push({
                type: 'expiry_alert',
                title: `${entry.itemName} — ${threshold.label}`,
                message: `${entry.itemName} in box ${box.boxId} (${box.location}) is ${threshold.label}. Batch: ${entry.batchNumber || 'N/A'}, Qty: ${entry.currentQty}`,
                severity: threshold.severity,
                relatedModel: 'FirstAidBox',
                relatedId: box._id
              });
              break;
            }
          }
        });
      });
    });

    // Send alerts to safety team
    if (alerts.length) {
      for (const alert of alerts) {
        await notifySafetyTeam(companyId, alert);
      }
    }

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Ran expiry check',
      entity: 'Inventory',
      details: `Expiry check completed: ${alerts.length} alerts generated across ${boxes.length} boxes`,
      company: companyId,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Expiry check completed. ${alerts.length} alerts generated.`,
      data: { alertsGenerated: alerts.length, boxesChecked: boxes.length }
    });
  } catch (error) {
    next(error);
  }
};
