const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Company = require('../models/Company');
const Department = require('../models/Department');
const User = require('../models/User');
const InventoryItem = require('../models/InventoryItem');
const FirstAidBox = require('../models/FirstAidBox');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Clear existing data
    await Company.deleteMany({});
    await Department.deleteMany({});
    await User.deleteMany({});
    await InventoryItem.deleteMany({});
    await FirstAidBox.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // 1. Create Company
    const company = await Company.create({
      name: 'Demo Manufacturing Pvt Ltd',
      code: 'DMPL',
      registrationNumber: 'MH-2024-FA-0012',
      factoryLicenseNumber: 'FL/MH/2024/1234',
      address: { street: '123 Industrial Area', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' },
      contactPerson: { name: 'Rajesh Kumar', email: 'rajesh@demo-mfg.com', phone: '9876543210' },
      totalWorkers: 320,
      industry: 'Manufacturing'
    });
    console.log('🏭 Company created');

    // 2. Create Departments
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

    // 3. Create Users
    const safetyDept = depts.find(d => d.code === 'SAFETY');
    const prodDept = depts.find(d => d.code === 'PROD');
    const adminDept = depts.find(d => d.code === 'ADMIN');

    const users = await User.create([
      { name: 'Admin User', email: 'admin@simplyaid.com', password: 'Admin@123', role: 'doctor', company: company._id, department: adminDept._id, employeeId: 'EMP001', phone: '9876543210', designation: 'Factory Manager' },
      { name: 'Suresh Patil', email: 'safety@simplyaid.com', password: 'Safety@123', role: 'employee', company: company._id, department: safetyDept._id, employeeId: 'EMP002', phone: '9876543211', firstAidCertified: true, certificationExpiry: new Date('2027-06-15'), designation: 'Safety Officer' },
      { name: 'Meena Sharma', email: 'firstaider@simplyaid.com', password: 'First@123', role: 'employee', company: company._id, department: prodDept._id, employeeId: 'EMP003', phone: '9876543212', firstAidCertified: true, certificationExpiry: new Date('2027-03-20'), designation: 'First Aider' },
      { name: 'Vikram Singh', email: 'depthead@simplyaid.com', password: 'Dept@123', role: 'employee', company: company._id, department: prodDept._id, employeeId: 'EMP004', phone: '9876543213', designation: 'Production Manager' },
      { name: 'Priya Desai', email: 'employee@simplyaid.com', password: 'Emp@123', role: 'employee', company: company._id, department: prodDept._id, employeeId: 'EMP005', phone: '9876543214', designation: 'Machine Operator' }
    ]);
    console.log('👥 Users created');

    // 4. Create Inventory Items (Indian Factories Rules — Prescribed Contents)
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

    // 5. Create First Aid Boxes (1 per 150 workers, need 3 for 320 workers)
    const sureshPatil = users.find(u => u.name === 'Suresh Patil');
    const meenaSharma = users.find(u => u.name === 'Meena Sharma');
    const classType = 'B';

    const boxItems = items.map(item => ({
      item: item._id,
      currentQty: item.requiredQty[`class${classType}`],
      requiredQty: item.requiredQty[`class${classType}`]
    }));

    await FirstAidBox.insertMany([
      { boxId: 'FAB-PROD-001', company: company._id, department: prodDept._id, location: 'Production Floor - Near Assembly Line', floor: 'Ground', classType, inCharge: meenaSharma._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-MAINT-001', company: company._id, department: depts.find(d => d.code === 'MAINT')._id, location: 'Maintenance Workshop - Tool Room', floor: 'Ground', classType, inCharge: sureshPatil._id, items: boxItems, lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' },
      { boxId: 'FAB-ADMIN-001', company: company._id, department: adminDept._id, location: 'Main Office - Reception Area', floor: '1st', classType: 'A', inCharge: sureshPatil._id, items: items.map(item => ({ item: item._id, currentQty: item.requiredQty.classA, requiredQty: item.requiredQty.classA })), lastInspectionDate: new Date(), nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000), status: 'adequate' }
    ]);
    console.log('🩹 First Aid Boxes created (3 boxes)');

    console.log('\n✅ Seed complete! Login credentials:');
    console.log('   Admin:    admin@simplyaid.com / Admin@123');
    console.log('   Employee: employee@simplyaid.com / Emp@123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDB();
