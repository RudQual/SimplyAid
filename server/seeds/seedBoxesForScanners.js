require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Scanner = require('../models/Scanner');
const FirstAidBox = require('../models/FirstAidBox');
const InventoryItem = require('../models/InventoryItem');
const User = require('../models/User');

const seedBoxesForScanners = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB');

    const scanners = await Scanner.find({});
    if (scanners.length === 0) {
      console.log('❌ No scanners found. Please run seedScanners.js first.');
      process.exit(1);
    }

    const items = await InventoryItem.find({ isPrescribed: true });
    if (items.length === 0) {
      console.log('❌ No inventory items found.');
      process.exit(1);
    }

    const firstAider = await User.findOne({ email: 'firstaider@simplyaid.com' });
    const safetyOfficer = await User.findOne({ email: 'safety@simplyaid.com' });

    let createdCount = 0;

    for (const scanner of scanners) {
      // Check if a box already exists for this scanner's location/name
      // We will create a Box ID based on the Scanner ID (e.g. SCN-PROD-01 -> FAB-PROD-01)
      const boxId = scanner.scannerId.replace('SCN', 'FAB');
      
      const existing = await FirstAidBox.findOne({ boxId });
      if (existing) {
        console.log(`⏩ Box ${boxId} already exists, skipping.`);
        continue;
      }

      const classType = 'B'; // default
      const boxItems = items.map(item => {
        const reqQty = item.requiredQty[`class${classType}`] || 1;
        return {
          item: item._id,
          currentQty: reqQty,
          requiredQty: reqQty,
          stocks: [{
            batchNumber: `INIT-${Math.floor(Math.random() * 9000)+1000}`,
            quantity: reqQty,
            expiryDate: new Date(Date.now() + (90 + Math.floor(Math.random() * 180)) * 24 * 60 * 60 * 1000),
            supplier: 'Initial Setup'
          }]
        };
      });

      await FirstAidBox.create({
        boxId,
        company: scanner.company,
        department: scanner.department,
        location: scanner.location,
        floor: scanner.floor,
        classType,
        inCharge: (Math.random() > 0.5 ? firstAider?._id : safetyOfficer?._id) || scanner.company,
        items: boxItems,
        lastInspectionDate: new Date(),
        nextInspectionDue: new Date(Date.now() + 30*24*60*60*1000),
        status: 'adequate'
      });

      createdCount++;
      console.log(`✅ Created Box ${boxId} for Scanner ${scanner.scannerId}`);
    }

    console.log(`\n🎉 Successfully created ${createdCount} new First Aid Boxes to match Scanners.`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding boxes:', error);
    process.exit(1);
  }
};

seedBoxesForScanners();
