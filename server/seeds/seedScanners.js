/**
 * Seed Scanners — creates sample scanners across all departments.
 * Run: node server/seeds/seedScanners.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Scanner = require('../models/Scanner');
const Department = require('../models/Department');
const Company = require('../models/Company');

const SCANNER_NAMES = [
  { suffix: 'Main Gate Scanner', floor: 'Ground' },
  { suffix: 'Assembly Line Scanner', floor: '1st Floor' },
  { suffix: 'Welding Bay Scanner', floor: '1st Floor' },
  { suffix: 'Packaging Area Scanner', floor: 'Ground' },
  { suffix: 'Lab Entrance Scanner', floor: '2nd Floor' },
  { suffix: 'Loading Dock Scanner', floor: 'Ground' },
  { suffix: 'Break Room Scanner', floor: '1st Floor' },
  { suffix: 'Storage Facility Scanner', floor: 'Basement' },
  { suffix: 'Quality Check Scanner', floor: '2nd Floor' },
  { suffix: 'Office Lobby Scanner', floor: 'Ground' },
  { suffix: 'Furnace Area Scanner', floor: '1st Floor' },
  { suffix: 'Chemical Store Scanner', floor: 'Basement' },
];

const LOCATIONS = [
  'Building A, Near Fire Exit',
  'Building A, Central Corridor',
  'Building B, West Wing',
  'Building B, East Entrance',
  'Building C, Near Elevator',
  'Building C, South Exit',
  'Main Hall, Reception Desk',
  'Warehouse, Aisle 3',
  'Canteen, Main Door',
  'Admin Block, 2nd Floor Landing',
  'Workshop, Tool Room Entrance',
  'Loading Bay, Gate 2',
];

async function seedScanners() {
  try {
    await connectDB();

    const company = await Company.findOne({});
    if (!company) {
      console.log('❌ No company found. Please seed companies first.');
      process.exit(1);
    }

    const departments = await Department.find({ company: company._id, isActive: true });
    if (departments.length === 0) {
      console.log('❌ No departments found. Please seed departments first.');
      process.exit(1);
    }

    // Remove existing scanners
    await Scanner.deleteMany({ company: company._id });
    console.log('🗑️  Cleared existing scanners');

    const scanners = [];
    let scannerIndex = 0;

    // Give 2-3 scanners per department
    departments.forEach((dept, deptIdx) => {
      const scannerCount = 2 + (deptIdx % 2); // 2 or 3 scanners

      for (let i = 0; i < scannerCount; i++) {
        const nameEntry = SCANNER_NAMES[scannerIndex % SCANNER_NAMES.length];
        const location = LOCATIONS[scannerIndex % LOCATIONS.length];
        const scannerId = `SCN-${dept.code}-${String(i + 1).padStart(2, '0')}`;

        scanners.push({
          scannerId,
          name: `${dept.name} - ${nameEntry.suffix}`,
          department: dept._id,
          location,
          floor: nameEntry.floor,
          company: company._id,
          isActive: true
        });

        scannerIndex++;
      }
    });

    const created = await Scanner.insertMany(scanners);
    console.log(`✅ Created ${created.length} scanners across ${departments.length} departments`);

    created.forEach(s => {
      console.log(`   📡 ${s.scannerId} — ${s.name} (${s.location})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedScanners();
