const { ApiError, departmentIdOf } = require('./http');
const { COMPANY_WIDE } = require('../config/roles');

const isCompanyWide = (req) => COMPANY_WIDE.includes(req.user.role);
const isAdmin = (req) => req.user.role === 'admin';

/**
 * Managers may only change kits that belong to their own department.
 * Admins and doctors may change any kit in their company.
 */
const assertCanManageKit = (req, box) => {
  if (isCompanyWide(req)) return;
  if (req.user.role === 'manager') {
    const dept = departmentIdOf(req);
    const boxDept = box.department && (box.department._id || box.department);
    if (dept && boxDept && String(dept) === String(boxDept)) return;
    throw ApiError.forbidden('Managers can only manage kits in their own department');
  }
  throw ApiError.forbidden();
};

/** Managers only see/act on records in their own department (when they have one). */
const departmentScope = (req) => {
  if (req.user.role === 'manager' && departmentIdOf(req)) return departmentIdOf(req);
  return null;
};

module.exports = { isCompanyWide, isAdmin, assertCanManageKit, departmentScope };
