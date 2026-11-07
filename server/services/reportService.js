const PDFDocument = require('pdfkit');
const Incident = require('../models/Incident');
const Inspection = require('../models/Inspection');
const StockTransaction = require('../models/StockTransaction');
const AuditLog = require('../models/AuditLog');
const FirstAidBox = require('../models/FirstAidBox');
const { aggregateCatalog } = require('./inventoryService');
const { collectEntries, loadCompanyBoxes } = require('./expiryService');
const { companyCompliance } = require('./complianceService');
const { ApiError, qs, isValidId, dateRange, searchRegex } = require('../utils/http');

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmtDateTime = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : '');
const label = (s) => (s ? String(s).replace(/_/g, ' ') : '');

/**
 * Report definitions. Each returns { title, columns: [{ key, label }], rows }.
 * `opts` = { companyId, departmentId (manager scope), query }
 */
const REPORTS = {
  inventory: {
    title: 'Inventory Status',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId, query }) => {
      let list = await aggregateCatalog(companyId, { departmentId });
      const category = qs(query.category);
      const stockStatus = qs(query.stockStatus);
      if (category) list = list.filter((i) => i.category === category);
      if (stockStatus) list = list.filter((i) => i.stock.stockStatus === stockStatus);
      return {
        columns: [
          { key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'unit', label: 'Unit' },
          { key: 'kits', label: 'Kits' }, { key: 'quantity', label: 'In stock' }, { key: 'required', label: 'Required' },
          { key: 'fill', label: 'Fill %' }, { key: 'status', label: 'Stock status' }, { key: 'expired', label: 'Expired units' },
          { key: 'nearest', label: 'Nearest expiry' }
        ],
        rows: list.map((i) => ({
          name: i.name, category: i.category, unit: i.unit, kits: i.stock.boxCount, quantity: i.stock.totalQty,
          required: i.stock.totalRequired, fill: i.stock.fillRate ?? '', status: label(i.stock.stockStatus),
          expired: i.stock.expiredQty, nearest: fmtDate(i.stock.nearestExpiry)
        }))
      };
    }
  },
  'low-stock': {
    title: 'Low Stock',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId }) => {
      const filter = { company: companyId, isActive: true };
      if (departmentId) filter.department = departmentId;
      const boxes = await FirstAidBox.find(filter).populate('items.item', 'name unit').populate('department', 'name').lean();
      const rows = [];
      boxes.forEach((b) => b.items.forEach((i) => {
        const qty = (i.stocks || []).reduce((s, x) => s + x.quantity, 0);
        if (i.requiredQty > 0 && qty < i.requiredQty) {
          rows.push({
            kit: b.boxId, location: b.location, department: b.department && b.department.name,
            item: i.item && i.item.name, current: qty, required: i.requiredQty, shortfall: i.requiredQty - qty,
            status: qty === 0 ? 'Out of stock' : 'Low stock'
          });
        }
      }));
      rows.sort((a, b) => b.shortfall - a.shortfall);
      return {
        columns: [
          { key: 'kit', label: 'Kit' }, { key: 'location', label: 'Location' }, { key: 'department', label: 'Department' },
          { key: 'item', label: 'Item' }, { key: 'current', label: 'Current' }, { key: 'required', label: 'Required' },
          { key: 'shortfall', label: 'Shortfall' }, { key: 'status', label: 'Status' }
        ],
        rows
      };
    }
  },
  expiry: {
    title: 'Expiry Report',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId, query }) => {
      const boxes = await loadCompanyBoxes(companyId, { departmentId });
      let entries = collectEntries(boxes).filter((e) => e.status !== 'none');
      const status = qs(query.status);
      if (status === 'attention') entries = entries.filter((e) => ['expired', 'critical', 'soon'].includes(e.status));
      else if (status) entries = entries.filter((e) => e.status === status);
      entries.sort((a, b) => a.daysRemaining - b.daysRemaining);
      return {
        columns: [
          { key: 'item', label: 'Item' }, { key: 'kit', label: 'Kit' }, { key: 'location', label: 'Location' },
          { key: 'department', label: 'Department' }, { key: 'batch', label: 'Batch' }, { key: 'qty', label: 'Qty' },
          { key: 'expiry', label: 'Expiry date' }, { key: 'days', label: 'Days left' }, { key: 'status', label: 'Status' }
        ],
        rows: entries.map((e) => ({
          item: e.itemName, kit: e.boxId, location: e.boxLocation, department: e.department, batch: e.batchNumber || '',
          qty: e.currentQty, expiry: fmtDate(e.expiryDate), days: e.daysRemaining, status: label(e.status)
        }))
      };
    }
  },
  compliance: {
    title: 'Compliance Report',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId }) => {
      const c = await companyCompliance(companyId, { departmentId });
      return {
        summary: [
          `Overall compliance: ${c.overallCompliance}% (${label(c.complianceStatus)})`,
          ...c.checks.map((k) => `${k.compliant ? 'PASS' : 'FAIL'} — ${k.rule} (${k.section}): required ${k.required}, actual ${k.actual}`)
        ],
        columns: [
          { key: 'kit', label: 'Kit' }, { key: 'location', label: 'Location' }, { key: 'department', label: 'Department' },
          { key: 'score', label: 'Score' }, { key: 'status', label: 'Status' }, { key: 'issues', label: 'Issues' },
          { key: 'lastInspection', label: 'Last inspection' }, { key: 'nextDue', label: 'Next due' }
        ],
        rows: c.boxes.map((b) => ({
          kit: b.boxId, location: b.location, department: b.department && b.department.name, score: b.score,
          status: label(b.complianceStatus), issues: b.issues.map((i) => i.message).join('; '),
          lastInspection: fmtDate(b.lastInspectionDate), nextDue: fmtDate(b.nextInspectionDue)
        }))
      };
    }
  },
  inspections: {
    title: 'Inspection History',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId, query }) => {
      const filter = { company: companyId };
      const range = dateRange(query);
      if (range) filter.inspectionDate = range;
      const status = qs(query.status);
      if (status) filter.status = status;
      if (departmentId) filter.firstAidBox = { $in: await FirstAidBox.find({ company: companyId, department: departmentId }).distinct('_id') };
      const list = await Inspection.find(filter).populate('firstAidBox', 'boxId location').sort('-inspectionDate').limit(5000).lean();
      return {
        columns: [
          { key: 'id', label: 'Inspection' }, { key: 'date', label: 'Date' }, { key: 'kit', label: 'Kit' },
          { key: 'location', label: 'Location' }, { key: 'inspector', label: 'Inspector' }, { key: 'status', label: 'Result' },
          { key: 'score', label: 'Score' }, { key: 'deficiencies', label: 'Open deficiencies' }
        ],
        rows: list.map((i) => ({
          id: i.inspectionId, date: fmtDate(i.inspectionDate), kit: i.firstAidBox && i.firstAidBox.boxId,
          location: i.firstAidBox && i.firstAidBox.location, inspector: i.inspectorName, status: label(i.status),
          score: i.complianceScore ?? '', deficiencies: (i.deficiencies || []).filter((d) => !d.resolved).length
        }))
      };
    }
  },
  'stock-movements': {
    title: 'Stock Movements',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId, query }) => {
      const filter = { company: companyId };
      const range = dateRange(query);
      if (range) filter.createdAt = range;
      const type = qs(query.type);
      if (type) filter.type = type;
      if (departmentId) filter.box = { $in: await FirstAidBox.find({ company: companyId, department: departmentId }).distinct('_id') };
      const list = await StockTransaction.find(filter).sort('-createdAt').limit(10000).lean();
      return {
        columns: [
          { key: 'date', label: 'Date' }, { key: 'kit', label: 'Kit' }, { key: 'item', label: 'Item' }, { key: 'type', label: 'Type' },
          { key: 'change', label: 'Change' }, { key: 'before', label: 'Before' }, { key: 'after', label: 'After' },
          { key: 'by', label: 'By' }, { key: 'reason', label: 'Reason' }
        ],
        rows: list.map((t) => ({
          date: fmtDateTime(t.createdAt), kit: t.boxCode, item: t.itemName, type: label(t.type), change: t.quantityChange,
          before: t.quantityBefore, after: t.quantityAfter, by: t.performedByName || 'System', reason: t.reason || ''
        }))
      };
    }
  },
  'accident-register': {
    title: 'Accident Register (Section 88)',
    roles: ['doctor', 'manager'],
    build: async ({ companyId, departmentId, query }) => {
      const filter = { company: companyId };
      if (qs(query.reportableOnly) !== 'false') filter.isReportable = true;
      if (departmentId) filter.department = departmentId;
      const range = dateRange(query);
      if (range) filter.dateTime = range;
      const list = await Incident.find(filter).populate('department', 'name').sort('-dateTime').limit(5000).lean();
      return {
        columns: [
          { key: 'id', label: 'Incident' }, { key: 'date', label: 'Date' }, { key: 'person', label: 'Injured person' },
          { key: 'department', label: 'Department' }, { key: 'severity', label: 'Severity' }, { key: 'daysLost', label: 'Days lost' },
          { key: 'outcome', label: 'Outcome' }, { key: 'form18', label: 'Form 18' }
        ],
        rows: list.map((i) => ({
          id: i.incidentId, date: fmtDate(i.dateTime), person: i.injuredPerson && i.injuredPerson.name,
          department: i.department && i.department.name, severity: i.severity, daysLost: i.daysLost || 0,
          outcome: label(i.outcome), form18: i.form18Generated ? `Generated ${fmtDate(i.form18GeneratedDate)}` : 'Pending'
        }))
      };
    }
  },
  activity: {
    title: 'Activity Log',
    roles: ['doctor'],
    build: async ({ companyId, query }) => {
      const filter = { company: companyId };
      const range = dateRange(query);
      if (range) filter.createdAt = range;
      const entity = qs(query.entity);
      if (entity) filter.entity = entity;
      const user = qs(query.user);
      if (user && isValidId(user)) filter.user = user;
      const search = qs(query.search);
      if (search) { const rx = searchRegex(search); filter.$or = [{ action: rx }, { details: rx }, { userName: rx }, { entityLabel: rx }]; }
      const list = await AuditLog.find(filter).sort('-createdAt').limit(10000).lean();
      return {
        columns: [
          { key: 'date', label: 'Date' }, { key: 'user', label: 'User' }, { key: 'role', label: 'Role' }, { key: 'action', label: 'Action' },
          { key: 'entity', label: 'Record type' }, { key: 'record', label: 'Record' }, { key: 'details', label: 'Details' }
        ],
        rows: list.map((l) => ({
          date: fmtDateTime(l.createdAt), user: l.userName || 'System', role: l.userRole || '', action: l.action,
          entity: l.entity, record: l.entityLabel || '', details: l.details || ''
        }))
      };
    }
  }
};

const getReport = async (type, opts) => {
  const def = REPORTS[type];
  if (!def) throw ApiError.notFound(`Unknown report: ${type}`);
  const built = await def.build(opts);
  return { type, title: def.title, generatedAt: new Date(), ...built };
};

// ─── Renderers ──────────────────────────────────────────────────────────────

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Neutralise spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (report) => {
  const lines = [report.columns.map((c) => csvCell(c.label)).join(',')];
  report.rows.forEach((r) => lines.push(report.columns.map((c) => csvCell(r[c.key])).join(',')));
  return `﻿${lines.join('\r\n')}\r\n`;
};

const streamPdf = (res, report, { companyName, userName }) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  doc.pipe(res);
  const pageWidth = doc.page.width - 72;
  doc.fontSize(16).fillColor('#0f172a').text(`SimplyAID — ${report.title}`);
  doc.fontSize(9).fillColor('#64748b').text(`${companyName || ''} · Generated ${fmtDateTime(report.generatedAt)} UTC by ${userName} · ${report.rows.length} row(s)`);
  doc.moveDown(0.8);
  (report.summary || []).forEach((line) => doc.fontSize(9).fillColor('#0f172a').text(line));
  if (report.summary) doc.moveDown(0.6);

  const colWidth = pageWidth / report.columns.length;
  const drawHeader = () => {
    const y = doc.y;
    doc.rect(36, y - 2, pageWidth, 16).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
    report.columns.forEach((c, i) => doc.text(c.label, 36 + i * colWidth + 3, y + 2, { width: colWidth - 6, ellipsis: true, lineBreak: false }));
    doc.font('Helvetica');
    doc.y = y + 18;
  };
  drawHeader();
  report.rows.forEach((r, idx) => {
    const cells = report.columns.map((c) => (r[c.key] === undefined || r[c.key] === null ? '' : String(r[c.key])));
    const height = Math.max(12, ...cells.map((t) => doc.heightOfString(t, { width: colWidth - 6 }))) + 4;
    if (doc.y + height > doc.page.height - 36) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    if (idx % 2) doc.rect(36, y - 1, pageWidth, height).fill('#f8fafc');
    doc.fillColor('#334155').fontSize(8);
    cells.forEach((t, i) => doc.text(t, 36 + i * colWidth + 3, y + 1, { width: colWidth - 6 }));
    doc.y = y + height;
  });
  if (!report.rows.length) doc.fontSize(10).fillColor('#64748b').text('No records match the selected filters.');
  doc.end();
};

module.exports = { REPORTS, getReport, toCsv, streamPdf };
