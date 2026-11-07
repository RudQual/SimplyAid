const crypto = require('crypto');
const QRCode = require('qrcode');
const FirstAidBox = require('../models/FirstAidBox');
const { audit } = require('../utils/notificationService');
const { evaluateBox } = require('../services/complianceService');
const { assertCanManageKit } = require('../utils/access');
const { ApiError, companyIdOf, isValidId } = require('../utils/http');
const { presentBox } = require('./inventoryController');

/** QR payload for a kit — contains identifiers only, never data. */
const qrPayload = (box) => JSON.stringify({
  type: 'first_aid_box',
  boxId: box.boxId,
  boxObjId: box._id.toString(),
  qrCodeId: box.qrCodeId
});

const loadKit = async (req, id, select) => {
  if (!isValidId(id)) throw ApiError.notFound('First aid kit not found');
  let q = FirstAidBox.findOne({ _id: id, company: companyIdOf(req), isActive: true });
  if (select) q = q.select(select);
  const box = await q;
  if (!box) throw ApiError.notFound('First aid kit not found');
  return box;
};

// @route POST /api/inventory/boxes/:id/generate-qr
exports.generateBoxQr = async (req, res) => {
  const box = await loadKit(req, req.params.id, '+qrCodeData');
  assertCanManageKit(req, box);
  box.qrCodeId = crypto.randomUUID();
  box.qrCodeData = await QRCode.toDataURL(qrPayload(box), { errorCorrectionLevel: 'H', width: 300, margin: 2 });
  box.qrCodeGeneratedAt = new Date();
  await box.save();
  audit(req, { action: 'Generated kit QR code', entity: 'FirstAidBox', entityId: box._id, entityLabel: box.boxId });
  res.json({
    success: true,
    data: { boxId: box.boxId, qrCodeId: box.qrCodeId, qrCodeData: box.qrCodeData, qrCodeGeneratedAt: box.qrCodeGeneratedAt },
    message: 'QR code generated'
  });
};

// @route GET /api/inventory/boxes/scan/:boxId  — scan a kit QR (by human-readable kit ID)
exports.scanBoxQr = async (req, res) => {
  const code = String(req.params.boxId || '').trim().toUpperCase();
  const box = await FirstAidBox.findOne({ boxId: code, company: companyIdOf(req), isActive: true })
    .populate('department', 'name code')
    .populate('inCharge', 'name email phone firstAidCertified certificationExpiry')
    .populate('items.item', 'name category unit isMandatory requiresExpiryTracking')
    .populate('inspectionLogs.inspectedBy', 'name');
  if (!box) throw ApiError.notFound('First aid kit not found');

  const compliance = evaluateBox(box);
  const presented = presentBox(box, { detailed: true });
  audit(req, { action: 'Scanned kit QR code', entity: 'QrScan', entityId: box._id, entityLabel: box.boxId, details: `Scanned ${box.boxId} at ${box.location}` });

  res.json({
    success: true,
    data: {
      box: presented,
      summary: {
        totalItems: box.items.length,
        lowStockItems: compliance.low.length + compliance.missing.length,
        expiringItems: compliance.expiringSoon.length,
        expiredItems: compliance.expired.length
      },
      complianceStatus: { compliant: 'compliant', at_risk: 'warning', non_compliant: 'critical' }[compliance.status],
      compliance: { score: compliance.score, status: compliance.status, issues: compliance.issues },
      lastInspection: presented.inspectionLogs && presented.inspectionLogs.length ? presented.inspectionLogs[0] : null,
      nextInspectionDue: box.nextInspectionDue
    }
  });
};

// @route GET /api/inventory/boxes/:id/download-qr
exports.downloadBoxQr = async (req, res) => {
  const box = await loadKit(req, req.params.id);
  const buffer = await QRCode.toBuffer(qrPayload(box), { errorCorrectionLevel: 'H', type: 'png', width: 600, margin: 2 });
  res.set({
    'Content-Type': 'image/png',
    'Content-Disposition': `attachment; filename="QR-${box.boxId}.png"`,
    'Content-Length': buffer.length
  });
  res.send(buffer);
};
