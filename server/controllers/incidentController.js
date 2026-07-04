const Incident = require('../models/Incident');
const Notification = require('../models/Notification');
const User = require('../models/User');

exports.createIncident = async (req, res, next) => {
  try {
    req.body.company = req.user.company ? (req.user.company._id || req.user.company) : null;
    req.body.reportedBy = req.user._id;

    if (!req.body.department && req.user.department) {
      req.body.department = req.user.department;
    }
    if (!req.body.department && req.body.company) {
      const Department = require('../models/Department');
      const defDept = await Department.findOne({ company: req.body.company });
      if (defDept) req.body.department = defDept._id;
    }
    if (!req.body.department) {
      const Department = require('../models/Department');
      const anyDept = await Department.findOne({});
      if (anyDept) req.body.department = anyDept._id;
    }

    const isManagerAssisted = req.body.reportMode === 'manager_assisted';

    const incident = await Incident.create(req.body);
    incident.statusHistory.push({ status: 'reported', changedBy: req.user._id, notes: isManagerAssisted ? 'Employee requested manager assistance to fill report' : 'Incident reported' });
    await incident.save();

    const notifyRoles = ['manager'];
    const usersToNotify = await User.find({ company: req.body.company, role: { $in: notifyRoles }, isActive: true });

    let notifications;
    if (isManagerAssisted) {
      // Urgent notification: employee cannot file report themselves
      notifications = usersToNotify.map(u => ({
        recipient: u._id, company: req.body.company, type: 'report_pending',
        title: `🚨 Action Required: Fill Incident Report for ${incident.injuredPerson?.name || 'an employee'}`,
        titleHi: `🚨 कार्रवाई आवश्यक: कर्मचारी की घटना रिपोर्ट भरें`,
        message: `Employee ${incident.injuredPerson?.name} (${incident.injuredPerson?.employeeId || 'N/A'}) was unable to fill the report themselves. Please visit them on-site and fill report ${incident.incidentId}.`,
        severity: 'warning',
        priority: 'high',
        category: 'incident',
        relatedModel: 'Incident', relatedId: incident._id
      }));
    } else {
      // Standard new-incident notification
      notifications = usersToNotify.map(u => ({
        recipient: u._id, company: req.body.company, type: 'incident_alert',
        title: `New ${incident.severity} incident reported`,
        titleHi: `नई ${incident.severity} घटना रिपोर्ट`,
        message: `${incident.incidentId}: ${incident.description.substring(0, 100)}`,
        severity: incident.severity === 'fatal' ? 'critical' : incident.severity === 'serious' ? 'warning' : 'info',
        relatedModel: 'Incident', relatedId: incident._id
      }));
    }

    if (notifications.length) await Notification.insertMany(notifications);

    const populated = await Incident.findById(incident._id).populate('reportedBy', 'name').populate('department', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
};

exports.getIncidents = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const { department, severity, status, incidentType, startDate, endDate, search, page = 1, limit = 20 } = req.query;
    const filter = { company: companyId };

    if (department) filter.department = department;
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (incidentType) filter.incidentType = incidentType;
    if (startDate || endDate) { filter.dateTime = {}; if (startDate) filter.dateTime.$gte = new Date(startDate); if (endDate) filter.dateTime.$lte = new Date(endDate); }
    if (search) filter.$or = [{ incidentId: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { 'injuredPerson.name': { $regex: search, $options: 'i' } }];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Incident.countDocuments(filter);
    const incidents = await Incident.find(filter).populate('reportedBy', 'name').populate('department', 'name code').populate('treatedBy', 'name').sort('-dateTime').skip(skip).limit(parseInt(limit));
    res.json({ success: true, count: incidents.length, total, pages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page), data: incidents });
  } catch (error) { next(error); }
};

exports.getIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('reportedBy', 'name email').populate('company', 'name').populate('department', 'name code')
      .populate('injuredPerson.department', 'name').populate('treatedBy', 'name')
      .populate('firstAidBoxUsed', 'boxId location').populate('itemsUsed.item', 'name category')
      .populate('statusHistory.changedBy', 'name').populate('closedBy', 'name');
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    res.json({ success: true, data: incident });
  } catch (error) { next(error); }
};

exports.updateIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    if (req.body.status && req.body.status !== incident.status) {
      incident.statusHistory.push({ status: req.body.status, changedBy: req.user._id, notes: req.body.statusNotes || `Status changed to ${req.body.status}` });
      if (req.body.status === 'closed') { incident.closedBy = req.user._id; incident.closedAt = new Date(); }
    }
    const fields = ['severity','description','treatmentGiven','treatedBy','outcome','daysLost','dateOfReturn','rootCause','correctiveAction','preventiveMeasures','causeOfInjury','hospitalName','witnesses','status','bodyPartAffected'];
    fields.forEach(f => { if (req.body[f] !== undefined) incident[f] = req.body[f]; });
    await incident.save();
    const populated = await Incident.findById(incident._id).populate('reportedBy', 'name').populate('department', 'name code');
    res.json({ success: true, data: populated });
  } catch (error) { next(error); }
};

exports.getIncidentStats = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    let companyObjId = null;
    if (req.user.company) {
      const idStr = req.user.company._id ? req.user.company._id.toString() : req.user.company.toString();
      companyObjId = new mongoose.Types.ObjectId(idStr);
    }

    const startDate = new Date(); startDate.setDate(startDate.getDate() - parseInt(req.query.period || '30'));
    const [stats] = await Incident.aggregate([
      { $match: { company: companyObjId, dateTime: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: 1 }, minor: { $sum: { $cond: [{ $eq: ['$severity', 'minor'] }, 1, 0] } }, moderate: { $sum: { $cond: [{ $eq: ['$severity', 'moderate'] }, 1, 0] } }, serious: { $sum: { $cond: [{ $eq: ['$severity', 'serious'] }, 1, 0] } }, fatal: { $sum: { $cond: [{ $eq: ['$severity', 'fatal'] }, 1, 0] } }, totalDaysLost: { $sum: '$daysLost' }, reportable: { $sum: { $cond: ['$isReportable', 1, 0] } }, openCases: { $sum: { $cond: [{ $in: ['$status', ['reported', 'under_investigation']] }, 1, 0] } } } }
    ]);
    const deptStats = await Incident.aggregate([
      { $match: { company: companyObjId, dateTime: { $gte: startDate } } },
      { $group: { _id: '$department', count: { $sum: 1 }, serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: '$department' }, { $sort: { count: -1 } }
    ]);
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await Incident.aggregate([
      { $match: { company: companyObjId, dateTime: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$dateTime' }, month: { $month: '$dateTime' } }, count: { $sum: 1 }, serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const typeBreakdown = await Incident.aggregate([
      { $match: { company: companyObjId, dateTime: { $gte: startDate } } },
      { $group: { _id: '$incidentType', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: { summary: stats || { total: 0, minor: 0, moderate: 0, serious: 0, fatal: 0, totalDaysLost: 0, reportable: 0, openCases: 0 }, departmentStats: deptStats, monthlyTrend, typeBreakdown } });
  } catch (error) { next(error); }
};

exports.managerConfirm = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    incident.managerConfirmation = {
      confirmedBy: req.user._id,
      notes: req.body.notes || '',
      confirmedAt: new Date()
    };
    incident.forwardedToDoctor = true;
    incident.status = 'under_investigation';
    incident.statusHistory.push({
      status: 'under_investigation',
      changedBy: req.user._id,
      notes: `Manager confirmed on-site. Notes: ${req.body.notes || 'None'}`
    });
    await incident.save();

    // Notify doctors
    const doctors = await User.find({ company: incident.company, role: 'doctor', isActive: true });
    const Notification = require('../models/Notification');
    const notifications = doctors.map(d => ({
      recipient: d._id, company: incident.company, type: 'incident_alert',
      title: `Incident ${incident.incidentId} confirmed by manager`,
      message: `Manager has confirmed incident on-site. Please review.`,
      severity: 'warning',
      relatedModel: 'Incident', relatedId: incident._id
    }));
    if (notifications.length) await Notification.insertMany(notifications);

    const populated = await Incident.findById(incident._id).populate('reportedBy', 'name').populate('department', 'name code').populate('managerConfirmation.confirmedBy', 'name');
    res.json({ success: true, data: populated });
  } catch (error) { next(error); }
};

exports.doctorReview = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    incident.doctorReview = {
      reviewedBy: req.user._id,
      notes: req.body.notes || '',
      reviewedAt: new Date()
    };
    incident.status = 'resolved';
    incident.statusHistory.push({
      status: 'resolved',
      changedBy: req.user._id,
      notes: `Doctor reviewed. Notes: ${req.body.notes || 'None'}`
    });
    // Deduct from First Aid Box if applicable
    if (incident.firstAidBoxUsed && incident.itemsUsed && incident.itemsUsed.length > 0) {
      const FirstAidBox = require('../models/FirstAidBox');
      const box = await FirstAidBox.findById(incident.firstAidBoxUsed);
      if (box) {
        let boxUpdated = false;
        incident.itemsUsed.forEach(usage => {
          const itemIndex = box.items.findIndex(i => i.item.toString() === usage.item.toString());
          if (itemIndex > -1) {
            box.items[itemIndex].currentQty -= usage.quantity;
            if (box.items[itemIndex].currentQty < 0) box.items[itemIndex].currentQty = 0;
            boxUpdated = true;
          }
        });
        if (boxUpdated) {
          box.computeStatus();
          await box.save();
        }
      }
    }

    await incident.save();

    const populated = await Incident.findById(incident._id).populate('reportedBy', 'name').populate('department', 'name code').populate('doctorReview.reviewedBy', 'name');
    res.json({ success: true, data: populated });
  } catch (error) { next(error); }
};

// @desc    Manager fills all details for a pending-assist incident
// @route   PUT /api/incidents/:id/manager-fill
// @access  Protected (manager)
exports.managerFillIncident = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });
    if (!incident.pendingManagerAssist) {
      return res.status(400).json({ success: false, message: 'This incident does not require manager assistance' });
    }

    // Apply all the filled details from the manager
    const fillableFields = [
      'incidentType', 'severity', 'description', 'location', 'causeOfInjury',
      'bodyPartAffected', 'treatmentGiven', 'treatedBy', 'firstAidBoxUsed',
      'itemsUsed', 'outcome', 'daysLost', 'hospitalName', 'witnesses',
      'injuredPerson', 'dateTime', 'department'
    ];
    fillableFields.forEach(f => { if (req.body[f] !== undefined) incident[f] = req.body[f]; });

    // Mark incident as manager-filled and confirm
    incident.pendingManagerAssist = false;
    incident.managerConfirmation = {
      confirmedBy: req.user._id,
      notes: req.body.managerNotes || 'Manager visited on-site and filled the incident report.',
      confirmedAt: new Date()
    };
    incident.forwardedToDoctor = true;
    incident.status = 'under_investigation';
    incident.statusHistory.push({
      status: 'under_investigation',
      changedBy: req.user._id,
      notes: `Manager visited on-site and completed incident report. ${req.body.managerNotes || ''}`
    });
    await incident.save();

    // Notify doctors
    const doctors = await User.find({ company: incident.company, role: 'doctor', isActive: true });
    const notifications = doctors.map(d => ({
      recipient: d._id, company: incident.company, type: 'incident_alert',
      title: `Incident ${incident.incidentId} filed by manager`,
      message: `Manager has visited on-site and completed the incident report for ${incident.injuredPerson?.name}. Please review.`,
      severity: 'warning',
      category: 'incident',
      relatedModel: 'Incident', relatedId: incident._id
    }));
    if (notifications.length) await Notification.insertMany(notifications);

    const populated = await Incident.findById(incident._id)
      .populate('reportedBy', 'name').populate('department', 'name code')
      .populate('managerConfirmation.confirmedBy', 'name');
    res.json({ success: true, data: populated });
  } catch (error) { next(error); }
};
