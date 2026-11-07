const { collectEntries, loadCompanyBoxes, summarize, timeline } = require('../services/expiryService');
const { runCompanyChecks, getScheduleStatus } = require('../services/monitoringService');
const StockTransaction = require('../models/StockTransaction');
const { audit } = require('../utils/notificationService');
const { departmentScope } = require('../utils/access');
const { ApiError, companyIdOf, qs, isValidId, searchRegex, parsePagination, paginated } = require('../utils/http');

const scopeOptions = (req) => {
  const departmentId = departmentScope(req) || qs(req.query.department);
  if (departmentId && !isValidId(String(departmentId))) throw ApiError.badRequest('Invalid department');
  const boxId = qs(req.query.box);
  if (boxId && !isValidId(boxId)) throw ApiError.badRequest('Invalid kit');
  return { departmentId, boxId };
};

// @route GET /api/expiry/dashboard
exports.getExpiryDashboard = async (req, res) => {
  const boxes = await loadCompanyBoxes(companyIdOf(req), scopeOptions(req));
  const entries = collectEntries(boxes);
  const group = (s) => entries.filter((e) => e.status === s).sort((a, b) => a.daysRemaining - b.daysRemaining);
  const recentRemovals = await StockTransaction.find({ company: companyIdOf(req), type: 'expired_removal' })
    .sort('-createdAt').limit(10).lean();

  res.json({
    success: true,
    data: {
      summary: summarize(entries, boxes.length),
      timeline: timeline(entries),
      items: {
        expired: group('expired'),
        critical7: group('critical'),
        critical30: group('soon'),
        warning90: group('warning'),
        healthy: [...group('ok'), ...group('none')]
      },
      recentRemovals,
      schedule: await getScheduleStatus()
    }
  });
};

// @route GET /api/expiry/items?status=expired|critical|soon|warning|ok|attention&category&department&box&search&daysLeft
exports.getExpiringItems = async (req, res) => {
  const boxes = await loadCompanyBoxes(companyIdOf(req), scopeOptions(req));
  let entries = collectEntries(boxes);

  const status = qs(req.query.status);
  const category = qs(req.query.category);
  const search = qs(req.query.search);
  const daysLeft = qs(req.query.daysLeft);
  if (status === 'attention') entries = entries.filter((e) => ['expired', 'critical', 'soon'].includes(e.status));
  else if (status) entries = entries.filter((e) => e.status === status);
  else if (daysLeft !== undefined) {
    const n = parseInt(daysLeft, 10);
    if (!Number.isFinite(n)) throw ApiError.badRequest('daysLeft must be a number');
    entries = entries.filter((e) => e.daysRemaining !== null && e.daysRemaining <= n);
  } else {
    entries = entries.filter((e) => e.status !== 'none');
  }
  if (category) entries = entries.filter((e) => e.itemCategory === category);
  if (search) {
    const rx = searchRegex(search);
    entries = entries.filter((e) => rx.test(e.itemName) || rx.test(e.boxId) || rx.test(e.boxLocation) || rx.test(e.batchNumber || ''));
  }
  entries.sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));

  if (!req.query.page && !req.query.limit) {
    return res.json({ success: true, count: entries.length, total: entries.length, data: entries });
  }
  const pg = parsePagination(req.query, { defaultLimit: 25 });
  res.json(paginated(entries.slice(pg.skip, pg.skip + pg.limit), entries.length, pg));
};

// @route POST /api/expiry/check-alerts — run the monitoring checks for this company now
exports.checkAndGenerateExpiryAlerts = async (req, res) => {
  const result = await runCompanyChecks(companyIdOf(req));
  audit(req, {
    action: 'Ran monitoring check', entity: 'Inventory',
    details: `Checked ${result.boxesChecked} kit(s): ${result.alertsGenerated} new alert(s)`
  });
  res.json({
    success: true,
    message: result.alertsGenerated
      ? `Check complete — ${result.alertsGenerated} new alert(s) generated.`
      : 'Check complete — no new alerts (existing alerts are not duplicated).',
    data: result
  });
};
