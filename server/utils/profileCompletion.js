/**
 * Profile Completion Calculator
 * 
 * Calculates what percentage of mandatory profile fields are filled.
 * Designed to be future-proof — add new sections/fields without breaking existing logic.
 */

const SECTIONS = {
  personal: {
    label: 'Personal Information',
    mandatory: [
      { key: 'name', label: 'Full Name' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'gender', label: 'Gender' },
      { key: 'bloodGroup', label: 'Blood Group' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'emergencyContact.name', label: 'Emergency Contact Name' },
      { key: 'emergencyContact.phone', label: 'Emergency Contact Number' },
      { key: 'emergencyContact.relationship', label: 'Emergency Contact Relationship' }
    ]
  },
  employment: {
    label: 'Employment Information',
    mandatory: [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'designation', label: 'Designation' },
      { key: 'factoryLocation', label: 'Factory Location' },
      { key: 'shiftTiming', label: 'Shift Timing' },
      { key: 'dateOfJoining', label: 'Date of Joining' },
      { key: 'reportingManager', label: 'Reporting Manager' }
    ]
  },
  medical: {
    label: 'Medical Information',
    mandatory: [
      { key: 'bloodGroup', label: 'Blood Group' },
      { key: 'knownAllergies', label: 'Known Allergies' },
      { key: 'chronicConditions', label: 'Existing Medical Conditions' },
      { key: 'currentMedications', label: 'Current Medications' }
    ]
  },
  safety: {
    label: 'Safety Information',
    mandatory: [
      { key: 'firstAidTrainingStatus', label: 'First Aid Training Status' },
      { key: 'lastSafetyTrainingDate', label: 'Last Safety Training Date' },
      { key: 'ppeAssigned', label: 'PPE Assigned' },
      { key: 'safetyCertifications', label: 'Safety Certifications' }
    ]
  }
};

/**
 * Get a nested value from an object using dot notation.
 * e.g. getNestedValue(user, 'emergencyContact.name')
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Check if a field value counts as "filled".
 */
const isFilled = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Date) return true;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

/**
 * Calculate profile completion for a user object.
 * 
 * @param {Object} user - Plain user object (use .toObject() for Mongoose docs)
 * @returns {{ percentage: number, completed: boolean, sections: Object, missingFields: string[] }}
 */
const calculateProfileCompletion = (user) => {
  const userData = user.toObject ? user.toObject() : user;

  let totalMandatory = 0;
  let totalFilled = 0;
  const sections = {};
  const missingFields = [];

  // Use a Set to avoid double-counting fields that appear in multiple sections
  // (e.g. bloodGroup appears in both personal and medical)
  const countedFields = new Set();
  const allFieldResults = [];

  for (const [sectionKey, section] of Object.entries(SECTIONS)) {
    let sectionFilled = 0;
    const sectionTotal = section.mandatory.length;
    const sectionMissing = [];

    for (const field of section.mandatory) {
      const value = getNestedValue(userData, field.key);
      const filled = isFilled(value);

      if (filled) {
        sectionFilled++;
      } else {
        sectionMissing.push(field.label);
      }

      // Only count toward overall percentage once per unique field key
      if (!countedFields.has(field.key)) {
        countedFields.add(field.key);
        allFieldResults.push(filled);
      }
    }

    sections[sectionKey] = {
      label: section.label,
      filled: sectionFilled,
      total: sectionTotal,
      complete: sectionFilled === sectionTotal,
      percentage: sectionTotal > 0 ? Math.round((sectionFilled / sectionTotal) * 100) : 100,
      missingFields: sectionMissing
    };
  }

  totalMandatory = allFieldResults.length;
  totalFilled = allFieldResults.filter(Boolean).length;

  const percentage = totalMandatory > 0
    ? Math.round((totalFilled / totalMandatory) * 100)
    : 100;

  // Collect all missing field names (deduplicated)
  const allMissing = new Set();
  for (const section of Object.values(sections)) {
    section.missingFields.forEach(f => allMissing.add(f));
  }

  return {
    percentage,
    completed: percentage === 100,
    sections,
    missingFields: [...allMissing]
  };
};

module.exports = { calculateProfileCompletion, SECTIONS };
