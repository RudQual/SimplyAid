const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Build the JSON payload that gets encoded into the QR code.
 * Intentionally contains NO sensitive data — only IDs for lookup.
 */
const buildQrPayload = (user) => {
  return JSON.stringify({
    employeeId: user.employeeId,
    userId: user._id.toString(),
    qrCodeId: user.qrCodeId,
    qrVersion: '1',
    type: 'employee'
  });
};

/**
 * Generate a QR code as a base64 PNG data URI.
 * @param {Object} user - Mongoose User document (must have employeeId and _id)
 * @returns {{ qrCodeId: string, qrCodeData: string }} 
 */
const generateQrCode = async (user) => {
  const qrCodeId = user.qrCodeId || crypto.randomUUID();
  
  // Temporarily set qrCodeId so payload includes it
  const tempUser = { ...user.toObject ? user.toObject() : user, qrCodeId };
  const payload = buildQrPayload(tempUser);

  const qrCodeData = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  return {
    qrCodeId,
    qrCodeData,
    qrCodeGeneratedAt: new Date()
  };
};

/**
 * Regenerate a QR code with a fresh UUID (invalidates old QR).
 * @param {Object} user - Mongoose User document
 * @returns {{ qrCodeId: string, qrCodeData: string, qrCodeGeneratedAt: Date }}
 */
const regenerateQrCode = async (user) => {
  // Force a new UUID so old QR codes become invalid
  user.qrCodeId = crypto.randomUUID();
  return generateQrCode(user);
};

/**
 * Generate a QR code as a raw PNG buffer (for download endpoints).
 * @param {Object} user - Mongoose User document
 * @returns {Buffer}
 */
const generateQrBuffer = async (user) => {
  const payload = buildQrPayload(user);
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 600,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
};

module.exports = { generateQrCode, regenerateQrCode, generateQrBuffer, buildQrPayload };
