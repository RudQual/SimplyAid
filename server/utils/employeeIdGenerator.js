const mongoose = require('mongoose');

/**
 * Generate the next unique Employee ID in the format EMP-YYYY-XXXX
 * Scoped per company and per calendar year.
 * 
 * @param {ObjectId} companyId - The company to scope the ID within
 * @returns {string} e.g. "EMP-2026-0001"
 */
const generateEmployeeId = async (companyId) => {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  // Find the highest existing sequence number for this company/year
  const User = mongoose.model('User');
  const lastUser = await User.findOne({
    company: companyId,
    employeeId: { $regex: `^EMP-${year}-` }
  })
    .sort({ employeeId: -1 })
    .select('employeeId')
    .lean();

  let nextSeq = 1;
  if (lastUser && lastUser.employeeId) {
    const parts = lastUser.employeeId.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `EMP-${year}-${String(nextSeq).padStart(4, '0')}`;
};

module.exports = { generateEmployeeId };
