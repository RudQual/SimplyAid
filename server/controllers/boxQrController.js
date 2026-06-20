const FirstAidBox = require('../models/FirstAidBox');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { createAuditLog } = require('../utils/notificationService');

/**
 * Generate QR code for a First Aid Box.
 * QR payload: { type: "first_aid_box", boxId: "FAB-001" }
 */
const generateBoxQrPayload = (box) => {
  return JSON.stringify({
    type: 'first_aid_box',
    boxId: box.boxId,
    boxObjId: box._id.toString(),
    qrCodeId: box.qrCodeId
  });
};

// @desc    Generate QR code for a first aid box
// @route   POST /api/inventory/boxes/:id/generate-qr
// @access  Admin, Safety Officer
exports.generateBoxQr = async (req, res, next) => {
  try {
    const box = await FirstAidBox.findById(req.params.id).select('+qrCodeData');
    if (!box) {
      return res.status(404).json({ success: false, message: 'First aid box not found' });
    }

    // Generate new QR
    const qrCodeId = crypto.randomUUID();
    box.qrCodeId = qrCodeId;

    const payload = generateBoxQrPayload(box);
    box.qrCodeData = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    box.qrCodeGeneratedAt = new Date();
    await box.save();

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Generated QR code for first aid box',
      entity: 'FirstAidBox',
      entityId: box._id,
      details: `QR code generated for box ${box.boxId}`,
      company: req.user.company._id || req.user.company,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: {
        boxId: box.boxId,
        qrCodeId: box.qrCodeId,
        qrCodeData: box.qrCodeData,
        qrCodeGeneratedAt: box.qrCodeGeneratedAt
      },
      message: 'QR code generated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Scan box QR → return full box profile
// @route   GET /api/inventory/boxes/scan/:boxId
// @access  Protected
exports.scanBoxQr = async (req, res, next) => {
  try {
    const { boxId } = req.params;
    const box = await FirstAidBox.findOne({ boxId })
      .populate('department', 'name code')
      .populate('inCharge', 'name email phone firstAidCertified certificationExpiry')
      .populate('items.item', 'name category unit isPrescribed requiresExpiryTracking')
      .populate('inspectionLogs.inspectedBy', 'name');

    if (!box) {
      return res.status(404).json({ success: false, message: 'First aid box not found' });
    }

    // Compute fresh status and expiry breakdown
    box.computeStatus();
    const expiryStatus = box.getExpiryStatus();

    // Calculate summary stats
    const totalItems = box.items.length;
    const lowStockItems = box.items.filter(i => i.currentQty < i.requiredQty).length;
    const expiringItems = expiryStatus.warning.length + expiryStatus.critical.length;
    const expiredItems = expiryStatus.expired.length;

    // Compliance status
    let complianceStatus = 'compliant';
    if (expiredItems > 0 || box.status === 'overdue_inspection') {
      complianceStatus = 'critical';
    } else if (lowStockItems > 0 || expiringItems > 0) {
      complianceStatus = 'warning';
    }

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Scanned first aid box QR',
      entity: 'QrScan',
      entityId: box._id,
      details: `Scanned box ${box.boxId} at ${box.location}`,
      company: req.user.company._id || req.user.company,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: {
        box,
        summary: {
          totalItems,
          lowStockItems,
          expiringItems,
          expiredItems
        },
        expiryStatus,
        complianceStatus,
        lastInspection: box.inspectionLogs.length
          ? box.inspectionLogs[box.inspectionLogs.length - 1]
          : null,
        nextInspectionDue: box.nextInspectionDue
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download QR code for a box as PNG
// @route   GET /api/inventory/boxes/:id/download-qr
// @access  Protected
exports.downloadBoxQr = async (req, res, next) => {
  try {
    const box = await FirstAidBox.findById(req.params.id);
    if (!box) {
      return res.status(404).json({ success: false, message: 'First aid box not found' });
    }

    const payload = generateBoxQrPayload(box);
    const buffer = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 600,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="QR-${box.boxId}.png"`,
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
