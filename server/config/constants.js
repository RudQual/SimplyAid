const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  DAY_MS,
  // Expiry bands (days before expiry)
  EXPIRY_CRITICAL_DAYS: 7,
  EXPIRY_SOON_DAYS: 30,
  EXPIRY_WARNING_DAYS: 90,
  // Factories Act, 1948 — Section 45: one first aid box per 150 workers
  WORKERS_PER_BOX: 150,
  // Compliance score weights (sum = 100) — see services/complianceService.js
  COMPLIANCE_WEIGHTS: { supplies: 40, expiry: 25, inspection: 20, inCharge: 15 },
  COMPLIANCE_THRESHOLDS: { compliant: 90, atRisk: 70 },
  INVENTORY_CATEGORIES: ['dressing', 'bandage', 'antiseptic', 'medicine', 'equipment', 'other']
};
