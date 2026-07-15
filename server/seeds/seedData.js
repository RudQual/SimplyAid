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

    const dept = (code) => depts.find(d => d.code === code);
    const PASS = 'Demo@123';

    // ══════════════════════════════════════════════
    //  3. CREATE ALL USERS
    //  Hierarchy: Employee → Manager (Head Manager) → Doctor (Head Doctor)
    // ══════════════════════════════════════════════

    const users = await User.create([

      // ════════════════════════════════════════════
      //  DOCTORS (3) — Medical staff across factory
      // ════════════════════════════════════════════

      // Head Doctor — Chief Medical Officer, oversees all medical operations
      {
        name: 'Dr. Arun Desai', email: 'arun@simplyaid.com', password: PASS,
        role: 'doctor', company: company._id, department: dept('ADMIN')._id,
        employeeId: 'DOC001', phone: '9876543208', designation: 'Head Doctor',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2028-03-15')
      },
      // Factory Doctor — handles Safety & EHS department medical needs
      {
        name: 'Dr. Meena Iyer', email: 'meena@simplyaid.com', password: PASS,
        role: 'doctor', company: company._id, department: dept('SAFETY')._id,
        employeeId: 'DOC002', phone: '9876543207', designation: 'Factory Doctor',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2028-01-10')
      },
      // Occupational Health Doctor — covers Production & Maintenance floors
      {
        name: 'Dr. Priya Kapoor', email: 'priya@simplyaid.com', password: PASS,
        role: 'doctor', company: company._id, department: dept('PROD')._id,
        employeeId: 'DOC003', phone: '9876543209', designation: 'Occupational Health Doctor',
        factoryLocation: 'Building A - Medical Room', shiftTiming: 'Morning (6AM-2PM)',
        firstAidCertified: true, certificationExpiry: new Date('2028-06-20')
      },

      // ════════════════════════════════════════════
      //  MANAGERS (5) — One per major department + Head Manager
      // ════════════════════════════════════════════

      // Head Manager — oversees the entire factory
      {
        name: 'Rajesh Gupta', email: 'rajesh@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('ADMIN')._id,
        employeeId: 'MGR001', phone: '9876543210', designation: 'Head Manager',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)'
      },
      // Production Manager — manages all production employees
      {
        name: 'Vikram Patel', email: 'vikram@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('PROD')._id,
        employeeId: 'MGR002', phone: '9876543205', designation: 'Production Manager',
        factoryLocation: 'Building A', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },
      // Maintenance Manager — manages maintenance team
      {
        name: 'Deepak Joshi', email: 'deepak@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('MAINT')._id,
        employeeId: 'MGR003', phone: '9876543206', designation: 'Maintenance Manager',
        factoryLocation: 'Building B', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },
      // QC Manager — manages quality control team
      {
        name: 'Neha Kulkarni', email: 'neha@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('QC')._id,
        employeeId: 'MGR004', phone: '9876543211', designation: 'QC Manager',
        factoryLocation: 'Building A', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },
      // Logistics Manager — manages warehouse & logistics staff
      {
        name: 'Sanjay Tiwari', email: 'sanjay@simplyaid.com', password: PASS,
        role: 'manager', company: company._id, department: dept('LOG')._id,
        employeeId: 'MGR005', phone: '9876543212', designation: 'Logistics Manager',
        factoryLocation: 'Building C', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — PRODUCTION DEPARTMENT (6)
      //  Reports to: Vikram Patel (Production Manager)
      //  Medical: Dr. Priya Kapoor (Occupational Health)
      // ════════════════════════════════════════════

      {
        name: 'Ravi Kumar', email: 'ravi@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP001', phone: '9876543201', designation: 'Machine Operator',
        factoryLocation: 'Building A', shiftTiming: 'Morning (6AM-2PM)',
        reportingManager: 'Vikram Patel'
      },
      {
        name: 'Anita Sharma', email: 'anita@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP002', phone: '9876543202', designation: 'Floor Supervisor',
        factoryLocation: 'Building A', shiftTiming: 'Morning (6AM-2PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-06-15'),
        reportingManager: 'Vikram Patel'
      },
      {
        name: 'Mohan Rao', email: 'mohan@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP003', phone: '9876543213', designation: 'Welder',
        factoryLocation: 'Building A', shiftTiming: 'Afternoon (2PM-10PM)',
        reportingManager: 'Vikram Patel'
      },
      {
        name: 'Lakshmi Devi', email: 'lakshmi@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP004', phone: '9876543214', designation: 'Assembly Line Worker',
        factoryLocation: 'Building A', shiftTiming: 'Morning (6AM-2PM)',
        reportingManager: 'Vikram Patel'
      },
      {
        name: 'Ramesh Patil', email: 'ramesh@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP005', phone: '9876543215', designation: 'CNC Operator',
        factoryLocation: 'Building A', shiftTiming: 'Afternoon (2PM-10PM)',
        reportingManager: 'Vikram Patel'
      },
      {
        name: 'Pooja Bhat', email: 'pooja.b@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('PROD')._id,
        employeeId: 'EMP006', phone: '9876543216', designation: 'Production Helper',
        factoryLocation: 'Building A', shiftTiming: 'Night (10PM-6AM)',
        reportingManager: 'Vikram Patel'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — MAINTENANCE DEPARTMENT (4)
      //  Reports to: Deepak Joshi (Maintenance Manager)
      //  Medical: Dr. Priya Kapoor (Occupational Health)
      // ════════════════════════════════════════════

      {
        name: 'Sunil Yadav', email: 'sunil@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('MAINT')._id,
        employeeId: 'EMP007', phone: '9876543203', designation: 'Technician',
        factoryLocation: 'Building B', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Deepak Joshi'
      },
      {
        name: 'Arvind Mishra', email: 'arvind@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('MAINT')._id,
        employeeId: 'EMP008', phone: '9876543217', designation: 'Electrician',
        factoryLocation: 'Building B', shiftTiming: 'Morning (6AM-2PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-11-10'),
        reportingManager: 'Deepak Joshi'
      },
      {
        name: 'Ganesh Bhosle', email: 'ganesh@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('MAINT')._id,
        employeeId: 'EMP009', phone: '9876543218', designation: 'Plumber',
        factoryLocation: 'Building B', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Deepak Joshi'
      },
      {
        name: 'Dinesh Sawant', email: 'dinesh@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('MAINT')._id,
        employeeId: 'EMP010', phone: '9876543219', designation: 'HVAC Technician',
        factoryLocation: 'Building B', shiftTiming: 'Afternoon (2PM-10PM)',
        reportingManager: 'Deepak Joshi'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — QUALITY CONTROL (3)
      //  Reports to: Neha Kulkarni (QC Manager)
      //  Medical: Dr. Meena Iyer (Factory Doctor)
      // ════════════════════════════════════════════

      {
        name: 'Sunita Kadam', email: 'sunita@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('QC')._id,
        employeeId: 'EMP011', phone: '9876543220', designation: 'Quality Inspector',
        factoryLocation: 'Building A', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Neha Kulkarni'
      },
      {
        name: 'Ajay Chavan', email: 'ajay@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('QC')._id,
        employeeId: 'EMP012', phone: '9876543221', designation: 'Lab Technician',
        factoryLocation: 'Building A', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Neha Kulkarni'
      },
      {
        name: 'Meghna Jain', email: 'meghna@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('QC')._id,
        employeeId: 'EMP013', phone: '9876543222', designation: 'Testing Analyst',
        factoryLocation: 'Building A', shiftTiming: 'Morning (6AM-2PM)',
        reportingManager: 'Neha Kulkarni'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — SAFETY & EHS (2)
      //  Reports to: Rajesh Gupta (Head Manager — no dedicated safety manager)
      //  Medical: Dr. Meena Iyer (Factory Doctor)
      // ════════════════════════════════════════════

      {
        name: 'Kavita Nair', email: 'kavita@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('SAFETY')._id,
        employeeId: 'EMP014', phone: '9876543204', designation: 'Safety Inspector',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-09-20'),
        reportingManager: 'Rajesh Gupta'
      },
      {
        name: 'Nitin Pawar', email: 'nitin@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('SAFETY')._id,
        employeeId: 'EMP015', phone: '9876543223', designation: 'Fire Safety Officer',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-08-05'),
        reportingManager: 'Rajesh Gupta'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — LOGISTICS & WAREHOUSE (3)
      //  Reports to: Sanjay Tiwari (Logistics Manager)
      //  Medical: Dr. Arun Desai (Head Doctor)
      // ════════════════════════════════════════════

      {
        name: 'Prakash Gaikwad', email: 'prakash@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('LOG')._id,
        employeeId: 'EMP016', phone: '9876543224', designation: 'Warehouse Supervisor',
        factoryLocation: 'Building C', shiftTiming: 'General (9AM-6PM)',
        firstAidCertified: true, certificationExpiry: new Date('2027-12-01'),
        reportingManager: 'Sanjay Tiwari'
      },
      {
        name: 'Rekha Mane', email: 'rekha@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('LOG')._id,
        employeeId: 'EMP017', phone: '9876543225', designation: 'Dispatch Coordinator',
        factoryLocation: 'Building C', shiftTiming: 'Morning (6AM-2PM)',
        reportingManager: 'Sanjay Tiwari'
      },
      {
        name: 'Vishal Kale', email: 'vishal@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('LOG')._id,
        employeeId: 'EMP018', phone: '9876543226', designation: 'Forklift Operator',
        factoryLocation: 'Building C', shiftTiming: 'Afternoon (2PM-10PM)',
        reportingManager: 'Sanjay Tiwari'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — STORES & WAREHOUSE (2)
      //  Reports to: Sanjay Tiwari (Logistics Manager — covers stores too)
      //  Medical: Dr. Arun Desai (Head Doctor)
      // ════════════════════════════════════════════

      {
        name: 'Ashok Jadhav', email: 'ashok@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('STORE')._id,
        employeeId: 'EMP019', phone: '9876543227', designation: 'Store Keeper',
        factoryLocation: 'Building C', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Sanjay Tiwari'
      },
      {
        name: 'Seema Patil', email: 'seema@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('STORE')._id,
        employeeId: 'EMP020', phone: '9876543228', designation: 'Inventory Clerk',
        factoryLocation: 'Building C', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Sanjay Tiwari'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — HR (2)
      //  Reports to: Rajesh Gupta (Head Manager)
      //  Medical: Dr. Arun Desai (Head Doctor)
      // ════════════════════════════════════════════

      {
        name: 'Pooja Mehta', email: 'pooja@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('HR')._id,
        employeeId: 'EMP021', phone: '9876543229', designation: 'HR Executive',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },
      {
        name: 'Amit Thakur', email: 'amit@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('HR')._id,
        employeeId: 'EMP022', phone: '9876543230', designation: 'Payroll Officer',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },

      // ════════════════════════════════════════════
      //  EMPLOYEES — ADMINISTRATION (2)
      //  Reports to: Rajesh Gupta (Head Manager)
      //  Medical: Dr. Arun Desai (Head Doctor)
      // ════════════════════════════════════════════

      {
        name: 'Sneha Deshpande', email: 'sneha@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('ADMIN')._id,
        employeeId: 'EMP023', phone: '9876543231', designation: 'Admin Executive',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      },
      {
        name: 'Rohit Shinde', email: 'rohit@simplyaid.com', password: PASS,
        role: 'employee', company: company._id, department: dept('ADMIN')._id,
        employeeId: 'EMP024', phone: '9876543232', designation: 'Office Assistant',
        factoryLocation: 'Main Office', shiftTiming: 'General (9AM-6PM)',
        reportingManager: 'Rajesh Gupta'
      }
    ]);

    const totalEmployees = users.filter(u => u.role === 'employee').length;
    const totalManagers = users.filter(u => u.role === 'manager').length;
    const totalDoctors = users.filter(u => u.role === 'doctor').length;
    console.log(`👥 Users created: ${users.length} total (${totalEmployees} employees, ${totalManagers} managers, ${totalDoctors} doctors)`);

    // ── Set Department Heads ──
    const findUser = (name) => users.find(u => u.name === name);

    await Department.findByIdAndUpdate(dept('ADMIN')._id, { headOfDepartment: findUser('Rajesh Gupta')._id });
    await Department.findByIdAndUpdate(dept('PROD')._id, { headOfDepartment: findUser('Vikram Patel')._id });
    await Department.findByIdAndUpdate(dept('MAINT')._id, { headOfDepartment: findUser('Deepak Joshi')._id });
    await Department.findByIdAndUpdate(dept('QC')._id, { headOfDepartment: findUser('Neha Kulkarni')._id });
    await Department.findByIdAndUpdate(dept('LOG')._id, { headOfDepartment: findUser('Sanjay Tiwari')._id });
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
    const classType = 'B';
    const boxItems = items.map(item => ({
      item: item._id,
      currentQty: item.requiredQty[`class${classType}`],
      requiredQty: item.requiredQty[`class${classType}`]
    }));

    await FirstAidBox.insertMany([
      { boxId: 'FAB-PROD-001', company: company._id, department: dept('PROD')._id, location: 'Production Floor - Near Assembly Line', floor: 'Ground', classType, inCharge: findUser('Anita Sharma')._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-MAINT-001', company: company._id, department: dept('MAINT')._id, location: 'Maintenance Workshop - Tool Room', floor: 'Ground', classType, inCharge: findUser('Arvind Mishra')._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-ADMIN-001', company: company._id, department: dept('ADMIN')._id, location: 'Main Office - Reception Area', floor: '1st', classType: 'A', inCharge: findUser('Kavita Nair')._id, items: items.map(item => ({ item: item._id, currentQty: item.requiredQty.classA, requiredQty: item.requiredQty.classA })), lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-LOG-001', company: company._id, department: dept('LOG')._id, location: 'Warehouse - Loading Dock', floor: 'Ground', classType, inCharge: findUser('Prakash Gaikwad')._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' }
    ]);
    console.log('🩹 First Aid Boxes created (4 boxes)');

    // ── Summary ──
    console.log('\n✅ Seed complete! All accounts created.');
    console.log('   Password for ALL accounts: Demo@123\n');

    console.log('   ═══ DOCTORS (3) ═══');
    console.log('   Dr. Arun Desai    arun@simplyaid.com      (⭐ Head Doctor — Administration)');
    console.log('   Dr. Meena Iyer    meena@simplyaid.com     (Factory Doctor — Safety & EHS)');
    console.log('   Dr. Priya Kapoor  priya@simplyaid.com     (Occupational Health — Production)');

    console.log('\n   ═══ MANAGERS (5) ═══');
    console.log('   Rajesh Gupta      rajesh@simplyaid.com    (⭐ Head Manager — Administration)');
    console.log('   Vikram Patel      vikram@simplyaid.com    (Production Manager)');
    console.log('   Deepak Joshi      deepak@simplyaid.com    (Maintenance Manager)');
    console.log('   Neha Kulkarni     neha@simplyaid.com      (QC Manager)');
    console.log('   Sanjay Tiwari     sanjay@simplyaid.com    (Logistics Manager)');

    console.log('\n   ═══ EMPLOYEES (24) ═══');
    console.log('   Production (6):   Ravi, Anita, Mohan, Lakshmi, Ramesh, Pooja B. → reports to Vikram');
    console.log('   Maintenance (4):  Sunil, Arvind, Ganesh, Dinesh → reports to Deepak');
    console.log('   QC (3):           Sunita, Ajay, Meghna → reports to Neha');
    console.log('   Safety (2):       Kavita, Nitin → reports to Rajesh');
    console.log('   Logistics (3):    Prakash, Rekha, Vishal → reports to Sanjay');
    console.log('   Stores (2):       Ashok, Seema → reports to Sanjay');
    console.log('   HR (2):           Pooja M., Amit → reports to Rajesh');
    console.log('   Admin (2):        Sneha, Rohit → reports to Rajesh\n');

    console.log(`   TOTAL: ${users.length} accounts\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDB();
