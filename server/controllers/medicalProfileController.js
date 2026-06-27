const MedicalProfile = require('../models/MedicalProfile');
const User = require('../models/User');
const { createAuditLog } = require('../utils/notificationService');

// @desc    Get medical profile for an employee (create if not exists)
// @route   GET /api/medical-profiles/:employeeId
// @access  Protected (self, admin, safety_officer, first_aider)
exports.getMedicalProfile = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId;
    const employee = await User.findById(employeeId).select('name employeeId bloodGroup knownAllergies chronicConditions emergencyContact company');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Access control: self, or admin/safety/first_aider
    const isSelf = req.user._id.toString() === employeeId;
    const hasAccess = ['doctor', 'manager'].includes(req.user.role);
    if (!isSelf && !hasAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this medical profile' });
    }

    // Upsert: find or create
    let profile = await MedicalProfile.findOne({ employee: employeeId })
      .populate('employee', 'name employeeId email phone profilePhoto department bloodGroup knownAllergies chronicConditions emergencyContact');

    if (!profile) {
      // Seed from existing User data
      profile = await MedicalProfile.create({
        employee: employeeId,
        company: employee.company,
        bloodGroup: employee.bloodGroup || '',
        knownAllergies: employee.knownAllergies || [],
        medicalConditions: employee.chronicConditions || [],
        emergencyContact: employee.emergencyContact || {}
      });
      profile = await MedicalProfile.findById(profile._id)
        .populate('employee', 'name employeeId email phone profilePhoto department bloodGroup knownAllergies chronicConditions emergencyContact');
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Update medical profile
// @route   PUT /api/medical-profiles/:employeeId
// @access  Protected (self, admin, safety_officer)
exports.updateMedicalProfile = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId;
    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isSelf = req.user._id.toString() === employeeId;
    const isAdmin = ['doctor', 'manager'].includes(req.user.role);
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const companyId = req.user.company._id || req.user.company;

    // Upsert the profile
    const allowedFields = [
      'bloodGroup', 'knownAllergies', 'medicalConditions', 'currentMedications',
      'emergencyContact', 'doctorName', 'doctorContact'
    ];
    const updates = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    let profile = await MedicalProfile.findOne({ employee: employeeId });
    if (!profile) {
      profile = new MedicalProfile({ employee: employeeId, company: companyId });
    }

    Object.assign(profile, updates);
    await profile.save(); // triggers risk level computation

    // Also sync key fields back to User model for backward compatibility
    const userSync = {};
    if (updates.bloodGroup !== undefined) userSync.bloodGroup = updates.bloodGroup;
    if (updates.knownAllergies !== undefined) userSync.knownAllergies = updates.knownAllergies;
    if (updates.medicalConditions !== undefined) userSync.chronicConditions = updates.medicalConditions;
    if (updates.emergencyContact !== undefined) userSync.emergencyContact = updates.emergencyContact;
    if (Object.keys(userSync).length) {
      await User.findByIdAndUpdate(employeeId, userSync);
    }

    // Audit log
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Updated medical profile',
      entity: 'MedicalProfile',
      entityId: profile._id,
      details: `Updated medical profile for employee ${employee.name}`,
      company: companyId,
      ipAddress: req.ip
    });

    const populated = await MedicalProfile.findById(profile._id)
      .populate('employee', 'name employeeId email phone profilePhoto department');

    res.json({ success: true, data: populated, message: 'Medical profile updated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get emergency card (minimal data for QR scan)
// @route   GET /api/medical-profiles/:employeeId/emergency
// @access  Protected
exports.getEmergencyCard = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId;
    const employee = await User.findById(employeeId)
      .select('name employeeId bloodGroup knownAllergies chronicConditions emergencyContact profilePhoto department')
      .populate('department', 'name');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const profile = await MedicalProfile.findOne({ employee: employeeId })
      .select('bloodGroup knownAllergies medicalConditions currentMedications emergencyContact riskLevel doctorName doctorContact');

    // Merge User and MedicalProfile data for complete emergency card
    const emergencyData = {
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department?.name,
      profilePhoto: employee.profilePhoto,
      bloodGroup: profile?.bloodGroup || employee.bloodGroup,
      allergies: profile?.knownAllergies?.length ? profile.knownAllergies : employee.knownAllergies,
      medicalConditions: profile?.medicalConditions || employee.chronicConditions || [],
      currentMedications: profile?.currentMedications || [],
      emergencyContact: profile?.emergencyContact?.name ? profile.emergencyContact : employee.emergencyContact,
      riskLevel: profile?.riskLevel || 'low',
      doctorName: profile?.doctorName,
      doctorContact: profile?.doctorContact
    };

    // Log the scan
    createAuditLog({
      user: req.user._id,
      userName: req.user.name,
      action: 'Viewed emergency card',
      entity: 'MedicalProfile',
      entityId: employee._id,
      details: `Viewed emergency card for ${employee.name}`,
      company: req.user.company._id || req.user.company,
      ipAddress: req.ip
    });

    res.json({ success: true, data: emergencyData });
  } catch (error) {
    next(error);
  }
};
