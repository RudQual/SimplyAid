const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Company = require('../models/Company');
const Department = require('../models/Department');
const User = require('../models/User');
const InventoryItem = require('../models/InventoryItem');
const FirstAidBox = require('../models/FirstAidBox');
const Incident = require('../models/Incident');
const TreatmentRecord = require('../models/TreatmentRecord');
const Notification = require('../models/Notification');
const QrScanLog = require('../models/QrScanLog');
const Inspection = require('../models/Inspection');
const AuditLog = require('../models/AuditLog');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // ── Clear ALL data ──
    await Company.deleteMany({});
    await Department.deleteMany({});
    await User.deleteMany({});
    await InventoryItem.deleteMany({});
    await FirstAidBox.deleteMany({});
    await Incident.deleteMany({});
    await TreatmentRecord.deleteMany({});
    await Notification.deleteMany({});
    await QrScanLog.deleteMany({});
    await Inspection.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('🗑️  Cleared ALL existing data');

    // ── 1. Create Company ──
    const company = await Company.create({
      name: 'Demo Manufacturing Pvt Ltd',
      code: 'DMPL',
      registrationNumber: 'MH-2024-FA-0012',
      factoryLicenseNumber: 'FL/MH/2024/1234',
      address: { street: '123 Industrial Area', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' },
      contactPerson: { name: 'Rajesh Gupta', email: 'rajesh@simplyaid.com', phone: '9876543210' },
      totalWorkers: 320,
      industry: 'Manufacturing'
    });
    console.log('🏭 Company created');

    // ── 2. Create Departments ──
    const depts = await Department.insertMany([
      { name: 'Production', code: 'PROD', company: company._id, location: 'Building A', workerCount: 120, riskLevel: 'high' },
      { name: 'Maintenance', code: 'MAINT', company: company._id, location: 'Building B', workerCount: 40, riskLevel: 'high' },
      { name: 'Quality Control', code: 'QC', company: company._id, location: 'Building A', workerCount: 30, riskLevel: 'medium' },
      { name: 'Stores & Warehouse', code: 'STORE', company: company._id, location: 'Building C', workerCount: 25, riskLevel: 'medium' },
      { name: 'Administration', code: 'ADMIN', company: company._id, location: 'Main Office', workerCount: 35, riskLevel: 'low' },
      { name: 'Safety & EHS', code: 'SAFETY', company: company._id, location: 'Main Office', workerCount: 10, riskLevel: 'low' },
      { name: 'Human Resources', code: 'HR', company: company._id, location: 'Main Office', workerCount: 15, riskLevel: 'low' },
      { name: 'Logistics', code: 'LOG', company: company._id, location: 'Building C', workerCount: 45, riskLevel: 'medium' }
    ]);
    console.log('🏢 Departments created');

    // Helpers
    const dept = (code) => depts.find(d => d.code === code);

    // ── 3. Create Users (10 demo accounts) ──
    // Password for ALL accounts: Demo@123
    const PASS = 'Demo@123';

    const users = await User.create([
      // ─── Employees (4) ───
      {
        name: 'Ravi Kumar', email: 'ravi@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP001', phone: '9876543201', designation: 'Machine Operator',
        factoryLocation: 'Building A', shiftTiming: 'Morning (6AM-2PM)'
      },
      {
        name: 'Anita Sharma', email: 'anita@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP002', phone: '9876543202', designation: 'Floor Supervisor',
        factoryLocation: 'Building A', shiftTiming: 'Morning (6AM-2PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-06-15')
      },
      {
        name: 'Sunil Yadav', email: 'sunil@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('MAINT')._id,
        employeeId: 'EMP003', phone: '9876543203', designation: 'Technician',
        factoryLocation: 'Building B', shiftTiming: 'General (9AM-6PM)'
      },
      {
        name: 'Kavita Nair', email: 'kavita@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('SAFETY')._id,
        employeeId: 'EMP004', phone: '9876543204', designation: 'Safety Inspector',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-09-20')
      },

      // ─── Managers (3, including Head Manager) ───
      {
        name: 'Vikram Patel', email: 'vikram@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('PROD')._id,
        employeeId: 'MGR001', phone: '9876543205', designation: 'Production Manager',
        factoryLocation: 'Building A', shiftTiming: 'General (9AM-6PM)'
      },
      {
        name: 'Deepak Joshi', email: 'deepak@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('MAINT')._id,
        employeeId: 'MGR002', phone: '9876543206', designation: 'Maintenance Manager',
        factoryLocation: 'Building B', shiftTiming: 'General (9AM-6PM)'
      },
      {
        name: 'Rajesh Gupta', email: 'rajesh@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('ADMIN')._id,
        employeeId: 'MGR003', phone: '9876543210', designation: 'Head Manager',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)'
      },

      // ─── Doctors (2, including Head Doctor) ───
      {
        name: 'Dr. Meena Iyer', email: 'meena@simplyaid.com', password: PASS,
        role: 'doctor', company: company._id, department: dept('SAFETY')._id,
        employeeId: 'DOC001', phone: '9876543207', designation: 'Factory Doctor',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2028-01-10')
      },
      {
        name: 'Dr. Arun Desai', email: 'arun@simplyaid.com', password: PASS,
        role: 'doctor', company: company._id, department: dept('ADMIN')._id,
        employeeId: 'DOC002', phone: '9876543208', designation: 'Head Doctor',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2028-03-15')
      }
    ]);
    console.log('👥 Users created (10 demo accounts)');

    // Set Head of Department for Admin → Rajesh (Head Manager)
    const rajesh = users.find(u => u.name === 'Rajesh Gupta');
    await Department.findByIdAndUpdate(dept('ADMIN')._id, { headOfDepartment: rajesh._id });

    // Set Head of Department for PROD → Vikram
    const vikram = users.find(u => u.name === 'Vikram Patel');
    await Department.findByIdAndUpdate(dept('PROD')._id, { headOfDepartment: vikram._id });

    // Set Head of Department for MAINT → Deepak
    const deepak = users.find(u => u.name === 'Deepak Joshi');
    await Department.findByIdAndUpdate(dept('MAINT')._id, { headOfDepartment: deepak._id });

    console.log('🏢 Department heads assigned');

    // ── 4. Create Inventory Items (Indian Factories Rules) ──
    const items = await InventoryItem.insertMany([
      { name: 'Sterilized Dressing (Small)', nameHi: 'विसंक्रमित ड्रेसिंग (छोटा)', category: 'dressing', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 6, classB: 12, classC: 24 }, isGlobal: true },
      { name: 'Sterilized Dressing (Medium)', nameHi: 'विसंक्रमित ड्रेसिंग (मध्यम)', category: 'dressing', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 4, classB: 8, classC: 16 }, isGlobal: true },
      { name: 'Sterilized Dressing (Large)', nameHi: 'विसंक्रमित ड्रेसिंग (बड़ा)', category: 'dressing', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 4, classB: 8, classC: 16 }, isGlobal: true },
      { name: 'Sterilized Burn Dressing', nameHi: 'विसंक्रमित जले का ड्रेसिंग', category: 'dressing', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 2, classB: 4, classC: 8 }, isGlobal: true },
      { name: 'Roller Bandage (5cm)', nameHi: 'रोलर बैंडेज (5 सेमी)', category: 'bandage', unit: 'rolls', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 6, classB: 12, classC: 24 }, isGlobal: true },
      { name: 'Roller Bandage (10cm)', nameHi: 'रोलर बैंडेज (10 सेमी)', category: 'bandage', unit: 'rolls', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 6, classB: 12, classC: 24 }, isGlobal: true },
      { name: 'Triangular Bandage', nameHi: 'तिकोना बैंडेज', category: 'bandage', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 4, classB: 8, classC: 16 }, isGlobal: true },
      { name: 'Adhesive Plaster Roll', nameHi: 'चिपकने वाला प्लास्टर रोल', category: 'bandage', unit: 'rolls', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 2, classC: 4 }, isGlobal: true },
      { name: 'Cetrimide Solution (1%)', nameHi: 'सेट्रिमाइड सॉल्यूशन (1%)', category: 'antiseptic', unit: 'bottles', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 2, classC: 4 }, isGlobal: true },
      { name: 'Cotton Wool Packets', nameHi: 'कॉटन वूल पैकेट', category: 'dressing', unit: 'packets', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 4, classB: 8, classC: 16 }, isGlobal: true },
      { name: 'Aspirin Tablets (300mg)', nameHi: 'एस्पिरिन गोलियाँ (300mg)', category: 'medicine', unit: 'strips', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 2, classB: 4, classC: 8 }, isGlobal: true },
      { name: 'Sterilized Eye Pads', nameHi: 'विसंक्रमित आई पैड', category: 'dressing', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 4, classB: 4, classC: 8 }, isGlobal: true },
      { name: 'Eye Wash Bottle (500cc)', nameHi: 'आई वॉश बोतल (500cc)', category: 'equipment', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 2 }, isGlobal: true },
      { name: 'Scissors (Pair)', nameHi: 'कैंची (जोड़ी)', category: 'equipment', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 1 }, isGlobal: true },
      { name: 'Safety Pins', nameHi: 'सेफ्टी पिन', category: 'equipment', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 6, classB: 12, classC: 24 }, isGlobal: true },
      { name: 'Kidney Tray', nameHi: 'किडनी ट्रे', category: 'equipment', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 1 }, isGlobal: true },
      { name: 'Snake Bite Lancet', nameHi: 'सांप काटने का लैंसेट', category: 'equipment', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 1 }, isGlobal: true },
      { name: 'Tourniquet', nameHi: 'टूर्निकेट', category: 'equipment', unit: 'pcs', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 2 }, isGlobal: true },
      { name: 'Splints (Set)', nameHi: 'स्प्लिंट्स (सेट)', category: 'equipment', unit: 'sets', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 2 }, isGlobal: true },
      { name: 'First Aid Leaflet (DGFASLI)', nameHi: 'प्राथमिक चिकित्सा पत्रक (DGFASLI)', category: 'other', unit: 'copies', isPrescribed: true, prescribedBy: 'Factories Act 1948, Section 45', requiredQty: { classA: 1, classB: 1, classC: 1 }, isGlobal: true }
    ]);
    console.log('📦 Inventory items created (20 prescribed items)');

    // ── 5. Create First Aid Boxes ──
    const kavita = users.find(u => u.name === 'Kavita Nair');
    const anita = users.find(u => u.name === 'Anita Sharma');
    const classType = 'B';

    const boxItems = items.map(item => ({
      item: item._id,
      currentQty: item.requiredQty[`class${classType}`],
      requiredQty: item.requiredQty[`class${classType}`]
    }));

    await FirstAidBox.insertMany([
      { boxId: 'FAB-PROD-001', company: company._id, department: dept('PROD')._id, location: 'Production Floor - Near Assembly Line', floor: 'Ground', classType, inCharge: anita._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-MAINT-001', company: company._id, department: dept('MAINT')._id, location: 'Maintenance Workshop - Tool Room', floor: 'Ground', classType, inCharge: kavita._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-ADMIN-001', company: company._id, department: dept('ADMIN')._id, location: 'Main Office - Reception Area', floor: '1st', classType: 'A', inCharge: kavita._id, items: items.map(item => ({ item: item._id, currentQty: item.requiredQty.classA, requiredQty: item.requiredQty.classA })), lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' }
    ]);
    console.log('🩹 First Aid Boxes created (3 boxes)');

    // ── Summary ──
    console.log('\n✅ Seed complete! All 10 demo accounts created.');
    console.log('   Password for ALL accounts: Demo@123\n');
    console.log('   ── Employees ──');
    console.log('   Ravi Kumar        ravi@simplyaid.com      (Production - Machine Operator)');
    console.log('   Anita Sharma      anita@simplyaid.com     (Production - Floor Supervisor)');
    console.log('   Sunil Yadav       sunil@simplyaid.com     (Maintenance - Technician)');
    console.log('   Kavita Nair       kavita@simplyaid.com    (Safety - Safety Inspector)');
    console.log('   ── Managers ──');
    console.log('   Vikram Patel      vikram@simplyaid.com    (Production Manager)');
    console.log('   Deepak Joshi      deepak@simplyaid.com    (Maintenance Manager)');
    console.log('   Rajesh Gupta      rajesh@simplyaid.com    (⭐ Head Manager)');
    console.log('   ── Doctors ──');
    console.log('   Dr. Meena Iyer    meena@simplyaid.com     (Factory Doctor)');
    console.log('   Dr. Arun Desai    arun@simplyaid.com      (⭐ Head Doctor)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDB();
