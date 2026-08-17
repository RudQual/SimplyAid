const Incident = require('../models/Incident');
const Notification = require('../models/Notification');
const User = require('../models/User');

exports.createIncident = async (req, res, next) => {
  try {
    req.body.company = req.user.company ? (req.user.company._id || req.user.company) : null;
    req.body.reportedBy = req.user._id;

    // Auto-resolve department and location from scanner if provided
    if (req.body.scanner) {
      const Scanner = require('../models/Scanner');
      const scanner = await Scanner.findById(req.body.scanner).populate('department', 'name');
      if (scanner) {
        if (!req.body.department) req.body.department = scanner.department._id || scanner.department;
        if (!req.body.location) req.body.location = scanner.location;
      }
    }

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

    // --- Deduct from First Aid Box ---
    if (incident.firstAidBoxUsed && incident.itemsUsed && incident.itemsUsed.length > 0) {
      const FirstAidBox = require('../models/FirstAidBox');
      const box = await FirstAidBox.findById(incident.firstAidBoxUsed).populate('items.item', 'name');
      if (box) {
        let boxUpdated = false;
        let emptyItems = [];
        
        incident.itemsUsed.forEach(usage => {
          const itemIndex = box.items.findIndex(i => i.item._id.toString() === usage.item.toString() || i.item.toString() === usage.item.toString());
          if (itemIndex > -1) {
            const boxItem = box.items[itemIndex];
            let remaining = usage.quantity;

            if (boxItem.stocks && boxItem.stocks.length > 0) {
              boxItem.stocks.sort((a, b) => {
                if (!a.expiryDate) return 1;
                if (!b.expiryDate) return -1;
                return new Date(a.expiryDate) - new Date(b.expiryDate);
              });
              for (const stock of boxItem.stocks) {
                if (remaining <= 0) break;
                const deduct = Math.min(remaining, stock.quantity);
                stock.quantity -= deduct;
                remaining -= deduct;
              }
              boxItem.stocks = boxItem.stocks.filter(s => s.quantity > 0);
              boxItem.currentQty = boxItem.stocks.reduce((sum, s) => sum + s.quantity, 0);
            } else {
              boxItem.currentQty -= usage.quantity;
              if (boxItem.currentQty < 0) boxItem.currentQty = 0;
            }
            boxUpdated = true;

            // Check if stock became empty
            if (boxItem.currentQty === 0) {
              emptyItems.push(boxItem.item.name || usage.itemName || 'An item');
            }
          }
        });
        
        if (boxUpdated) {
          box.computeStatus();
          await box.save();
        }

        // Notify doctors if any item became completely empty
        if (emptyItems.length > 0) {
          const doctors = await User.find({ company: incident.company, role: 'doctor', isActive: true });
          const inventoryNotifs = doctors.map(d => ({
            recipient: d._id, company: incident.company, type: 'inventory_alert',
            title: `⚠️ Inventory Empty: ${box.boxId}`,
            titleHi: `⚠️ इन्वेंटरी खाली: ${box.boxId}`,
            message: `Stock is completely empty for: ${emptyItems.join(', ')} in box ${box.boxId} after incident ${incident.incidentId}.`,
            severity: 'critical', priority: 'high', category: 'inventory',
            relatedModel: 'FirstAidBox', relatedId: box._id
          }));
          if (inventoryNotifs.length) await Notification.insertMany(inventoryNotifs);
        }
      }
    }

    // --- Department Tree Notifications ---
    // 1. Notify all managers of the incident's department
    const deptManagerFilter = {
      company: req.body.company,
      role: 'manager',
      isActive: true
    };
    // Try to find managers specifically for this department, fallback to all managers
    const deptManagers = await User.find({ ...deptManagerFilter, department: req.body.department });
    const allManagers = deptManagers.length > 0
      ? deptManagers
      : await User.find(deptManagerFilter);

    // 2. Notify workers in the same department
    const deptWorkers = await User.find({
      company: req.body.company,
      department: req.body.department,
      role: { $in: ['user', 'worker', 'employee'] },
      isActive: true,
      _id: { $ne: req.user._id } // Don't notify the reporter
    });

    let notifications;
    if (isManagerAssisted) {
      notifications = allManagers.map(u => ({
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
      // Manager notifications
      const managerNotifs = allManagers.map(u => ({
        recipient: u._id, company: req.body.company, type: 'incident_alert',
        title: `New ${incident.severity} incident reported`,
        titleHi: `नई ${incident.severity} घटना रिपोर्ट`,
        message: `${incident.incidentId}: ${incident.description.substring(0, 100)}`,
        severity: incident.severity === 'fatal' ? 'critical' : incident.severity === 'serious' ? 'warning' : 'info',
        relatedModel: 'Incident', relatedId: incident._id
      }));

      // Worker notifications (awareness)
      const workerNotifs = deptWorkers.map(u => ({
        recipient: u._id, company: req.body.company, type: 'incident_alert',
        title: `⚠️ Incident reported in your department`,
        titleHi: `⚠️ आपके विभाग में घटना रिपोर्ट`,
        message: `${incident.incidentId}: A ${incident.severity} incident has been reported. Stay alert.`,
        severity: 'info',
        relatedModel: 'Incident', relatedId: incident._id
      }));

      notifications = [...managerNotifs, ...workerNotifs];
    }

    if (notifications.length) await Notification.insertMany(notifications);

    const populated = await Incident.findById(incident._id).populate('reportedBy', 'name').populate('department', 'name').populate('scanner', 'name location');
    res.status(201).json({ success: true, data: populated });
  } catch (error) { next(error); }
};

// @desc    SOS Emergency — instant empty report sent to immediate manager
// @route   POST /api/incidents/sos
// @access  Private (any authenticated user)
exports.createSOSIncident = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('company', 'name code')
      .populate('department', 'name code');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const companyId = user.company?._id || user.company;
    const departmentId = user.department?._id || user.department;

    // Find the user's immediate manager:
    // 1. First try to match by the user's reportingManager name field
    // 2. Then try managers in the same department
    // 3. Fallback to any manager in the company
    let immediateManager = null;

    if (user.reportingManager) {
      immediateManager = await User.findOne({
        company: companyId,
        role: 'manager',
        name: user.reportingManager,
        isActive: true
      });
    }

    if (!immediateManager) {
      immediateManager = await User.findOne({
        company: companyId,
        department: departmentId,
        role: 'manager',
        isActive: true
      });
    }

    if (!immediateManager) {
      immediateManager = await User.findOne({
        company: companyId,
        role: 'manager',
        isActive: true
      });
    }

    // Create the emergency incident with minimal auto-filled data
    const incident = await Incident.create({
      company: companyId,
      reportedBy: user._id,
      injuredPerson: {
        name: user.name,
        employeeId: user.employeeId,
        department: departmentId,
        gender: user.gender,
        designation: user.designation
      },
      dateTime: new Date(),
      location: user.factoryLocation || 'Unknown — SOS triggered',
      department: departmentId,
      incidentType: 'injury',
      severity: 'serious',
      description: `🚨 SOS EMERGENCY triggered by ${user.name} (${user.employeeId || 'N/A'}). Immediate assistance required. Details pending.`,
      outcome: 'pending_confirmation',
      status: 'reported',
      reportMode: 'self_reported',
      pendingManagerAssist: true
    });

    incident.statusHistory.push({
      status: 'reported',
      changedBy: user._id,
      notes: 'SOS Emergency — auto-generated. Employee needs immediate help.'
    });
    await incident.save();

    // Send high-priority notification to the immediate manager
    const notifications = [];

    if (immediateManager) {
      notifications.push({
        recipient: immediateManager._id,
        company: companyId,
        type: 'report_pending',
        title: `🆘 SOS EMERGENCY from ${user.name}!`,
        titleHi: `🆘 ${user.name} से आपातकालीन SOS!`,
        message: `${user.name} (${user.employeeId || 'N/A'}) — ${user.designation || 'Employee'} in ${user.department?.name || 'Unknown Dept'} has triggered an SOS emergency at ${user.factoryLocation || 'unknown location'}. Report ${incident.incidentId} created. Go to them immediately!`,
        messageHi: `${user.name} (${user.employeeId || 'N/A'}) ने ${user.factoryLocation || 'अज्ञात स्थान'} पर आपातकालीन SOS दबाया है। रिपोर्ट ${incident.incidentId}। तुरंत जाएं!`,
        severity: 'critical',
        priority: 'high',
        category: 'incident',
        relatedModel: 'Incident',
        relatedId: incident._id
      });
    }

    // Also notify all other managers in the department for awareness
    const otherManagers = await User.find({
      company: companyId,
      role: 'manager',
      isActive: true,
      _id: { $ne: immediateManager?._id }
    });

    otherManagers.forEach(mgr => {
      notifications.push({
        recipient: mgr._id,
        company: companyId,
        type: 'incident_alert',
        title: `🆘 SOS: ${user.name} needs emergency help`,
        titleHi: `🆘 SOS: ${user.name} को आपातकालीन सहायता चाहिए`,
        message: `Emergency incident ${incident.incidentId} auto-created. ${user.name} (${user.designation || 'Employee'}) at ${user.factoryLocation || 'unknown'}.`,
        severity: 'critical',
        relatedModel: 'Incident',
        relatedId: incident._id
      });
    });

    // Notify doctors too
    const doctors = await User.find({
      company: companyId,
      role: 'doctor',
      isActive: true
    });

    doctors.forEach(doc => {
      notifications.push({
        recipient: doc._id,
        company: companyId,
        type: 'incident_alert',
        title: `🆘 SOS: Medical emergency — ${user.name}`,
        titleHi: `🆘 SOS: चिकित्सा आपातकाल — ${user.name}`,
        message: `${user.name} (${user.employeeId || 'N/A'}) triggered SOS at ${user.factoryLocation || 'unknown'}. Incident ${incident.incidentId}. Possible injury — prepare for medical response.`,
        severity: 'critical',
        relatedModel: 'Incident',
        relatedId: incident._id
      });
    });

    if (notifications.length) await Notification.insertMany(notifications);

    const populated = await Incident.findById(incident._id)
      .populate('reportedBy', 'name employeeId')
      .populate('department', 'name');

    res.status(201).json({
      success: true,
      data: populated,
      message: `SOS sent! ${immediateManager ? `${immediateManager.name} has been notified.` : 'All managers have been notified.'}`
    });
  } catch (error) { next(error); }
};

exports.getIncidents = async (req, res, next) => {
  try {
    const companyId = req.user.company ? (req.user.company._id || req.user.company) : null;
    const { department, severity, status, incidentType, outcome, location, startDate, endDate, search, forwardedToDoctor, page = 1, limit = 20 } = req.query;
    const filter = { company: companyId };
    
    if (location) filter.location = location;

    // Managers can only see incidents for their own department
    if (req.user.role === 'manager' && req.user.department) {
      filter.department = req.user.department._id || req.user.department;
    } else if (department) {
      filter.department = department;
    }
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (outcome) filter.outcome = outcome;
    if (incidentType) filter.incidentType = incidentType;
    if (forwardedToDoctor !== undefined) filter.forwardedToDoctor = forwardedToDoctor === 'true';
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
    
    let outcomeChanged = false;
    if (req.body.outcome && req.body.outcome !== incident.outcome) {
      outcomeChanged = true;
    }

    const fields = ['severity','description','treatmentGiven','treatedBy','outcome','daysLost','dateOfReturn','rootCause','correctiveAction','preventiveMeasures','causeOfInjury','hospitalName','witnesses','status','bodyPartAffected','location'];
    fields.forEach(f => { if (req.body[f] !== undefined) incident[f] = req.body[f]; });

    if (outcomeChanged) {
      if (incident.outcome === 'referred_to_doctor') {
        incident.forwardedToDoctor = true;
        const User = require('../models/User');
        const Notification = require('../models/Notification');
        const doctors = await User.find({ company: incident.company, role: 'doctor', isActive: true });
        const notifications = doctors.map(d => ({
          recipient: d._id, company: incident.company, type: 'incident_alert',
          title: `Incident ${incident.incidentId} requires medical attention`,
          message: `The incident outcome has been updated. Please review.`,
          severity: 'warning',
          relatedModel: 'Incident', relatedId: incident._id
        }));
        if (notifications.length) await Notification.insertMany(notifications);
      } else if (incident.outcome === 'returned_to_work') {
        incident.forwardedToDoctor = false;
        if (incident.status !== 'resolved' && incident.status !== 'closed') {
          incident.status = 'resolved';
          incident.statusHistory.push({
            status: 'resolved',
            changedBy: req.user._id,
            notes: 'Resolved automatically as outcome was updated to returned to work.'
          });
        }
      }
    }

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

    const baseMatch = { company: companyObjId };
    if (req.user.role === 'manager' && req.user.department) {
      const deptIdStr = req.user.department._id ? req.user.department._id.toString() : req.user.department.toString();
      baseMatch.department = new mongoose.Types.ObjectId(deptIdStr);
    }

    const startDate = new Date(); startDate.setDate(startDate.getDate() - parseInt(req.query.period || '30'));
    
    const [stats] = await Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: 1 }, minor: { $sum: { $cond: [{ $eq: ['$severity', 'minor'] }, 1, 0] } }, moderate: { $sum: { $cond: [{ $eq: ['$severity', 'moderate'] }, 1, 0] } }, serious: { $sum: { $cond: [{ $eq: ['$severity', 'serious'] }, 1, 0] } }, fatal: { $sum: { $cond: [{ $eq: ['$severity', 'fatal'] }, 1, 0] } }, totalDaysLost: { $sum: '$daysLost' }, reportable: { $sum: { $cond: ['$isReportable', 1, 0] } }, openCases: { $sum: { $cond: [{ $in: ['$status', ['reported', 'under_investigation']] }, 1, 0] } } } }
    ]);
    const deptStats = await Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: startDate } } },
      { $group: { _id: '$department', count: { $sum: 1 }, serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
      { $unwind: '$department' }, { $sort: { count: -1 } }
    ]);
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$dateTime' }, month: { $month: '$dateTime' } }, count: { $sum: 1 }, serious: { $sum: { $cond: [{ $in: ['$severity', ['serious', 'fatal']] }, 1, 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const typeBreakdown = await Incident.aggregate([
      { $match: { ...baseMatch, dateTime: { $gte: startDate } } },
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
    
    // Update outcome if provided by manager
    if (req.body.outcome) {
      incident.outcome = req.body.outcome;
    }

    incident.status = 'under_investigation';
    incident.statusHistory.push({
      status: 'under_investigation',
      changedBy: req.user._id,
      notes: `Manager confirmed on-site. Outcome: ${req.body.outcome || incident.outcome}. Notes: ${req.body.notes || 'None'}`
    });
    
    // Only forward and notify doctors if referred
    if (incident.outcome === 'referred_to_doctor') {
      incident.forwardedToDoctor = true;
      const doctors = await User.find({ company: incident.company, role: 'doctor', isActive: true });
      const Notification = require('../models/Notification');
      const notifications = doctors.map(d => ({
        recipient: d._id, company: incident.company, type: 'incident_alert',
        title: `Incident ${incident.incidentId} requires medical attention`,
        message: `Manager has referred an employee to the doctor. Please review.`,
        severity: 'warning',
        relatedModel: 'Incident', relatedId: incident._id
      }));
      if (notifications.length) await Notification.insertMany(notifications);
    } else {
      incident.forwardedToDoctor = false;
      // If they returned to work, we can just resolve it directly since no doctor is needed
      if (incident.outcome === 'returned_to_work') {
        incident.status = 'resolved';
        incident.statusHistory.push({
          status: 'resolved',
          changedBy: req.user._id,
          notes: 'Resolved automatically as worker returned to work.'
        });
      }
    }

    // Deduct from First Aid Box if applicable (stocks-aware, FIFO by expiry)
    if (incident.firstAidBoxUsed && incident.itemsUsed && incident.itemsUsed.length > 0) {
      const FirstAidBox = require('../models/FirstAidBox');
      const box = await FirstAidBox.findById(incident.firstAidBoxUsed);
      if (box) {
        let boxUpdated = false;
        incident.itemsUsed.forEach(usage => {
          const itemIndex = box.items.findIndex(i => i.item.toString() === usage.item.toString());
          if (itemIndex > -1) {
            const boxItem = box.items[itemIndex];
            let remaining = usage.quantity;

            if (boxItem.stocks && boxItem.stocks.length > 0) {
              // Sort stocks by expiry date (soonest first = FIFO)
              boxItem.stocks.sort((a, b) => {
                if (!a.expiryDate) return 1;
                if (!b.expiryDate) return -1;
                return new Date(a.expiryDate) - new Date(b.expiryDate);
              });

              // Deduct from each stock in order
              for (const stock of boxItem.stocks) {
                if (remaining <= 0) break;
                const deduct = Math.min(remaining, stock.quantity);
                stock.quantity -= deduct;
                remaining -= deduct;
              }

              // Remove depleted stocks (quantity = 0)
              boxItem.stocks = boxItem.stocks.filter(s => s.quantity > 0);

              // Update legacy currentQty to match total stocks
              boxItem.currentQty = boxItem.stocks.reduce((sum, s) => sum + s.quantity, 0);
            } else {
              // Legacy: just deduct from currentQty
              boxItem.currentQty -= usage.quantity;
              if (boxItem.currentQty < 0) boxItem.currentQty = 0;
            }
            boxUpdated = true;
          }
        });
        if (boxUpdated) await box.save();
      }
    }

    await incident.save();

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
    // Deduct from First Aid Box if applicable (stocks-aware, FIFO by expiry)
    if (incident.firstAidBoxUsed && incident.itemsUsed && incident.itemsUsed.length > 0) {
      const FirstAidBox = require('../models/FirstAidBox');
      const box = await FirstAidBox.findById(incident.firstAidBoxUsed);
      if (box) {
        let boxUpdated = false;
        incident.itemsUsed.forEach(usage => {
          const itemIndex = box.items.findIndex(i => i.item.toString() === usage.item.toString());
          if (itemIndex > -1) {
            const boxItem = box.items[itemIndex];
            let remaining = usage.quantity;

            if (boxItem.stocks && boxItem.stocks.length > 0) {
              // Sort stocks by expiry date (soonest first = FIFO)
              boxItem.stocks.sort((a, b) => {
                if (!a.expiryDate) return 1;
                if (!b.expiryDate) return -1;
                return new Date(a.expiryDate) - new Date(b.expiryDate);
              });

              // Deduct from each stock in order
              for (const stock of boxItem.stocks) {
                if (remaining <= 0) break;
                const deduct = Math.min(remaining, stock.quantity);
                stock.quantity -= deduct;
                remaining -= deduct;
              }

              // Remove depleted stocks (quantity = 0)
              boxItem.stocks = boxItem.stocks.filter(s => s.quantity > 0);

              // Update legacy currentQty to match total stocks
              boxItem.currentQty = boxItem.stocks.reduce((sum, s) => sum + s.quantity, 0);
            } else {
              // Legacy: just deduct from currentQty
              boxItem.currentQty -= usage.quantity;
              if (boxItem.currentQty < 0) boxItem.currentQty = 0;
            }
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
