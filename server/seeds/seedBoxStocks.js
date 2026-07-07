/**
 * Seed Box Stocks — populates all FirstAidBox items with multiple stock batches
 * having varied expiry dates for testing expiry tracking.
 * Run: node server/seeds/seedBoxStocks.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const FirstAidBox = require('../models/FirstAidBox');
const InventoryItem = require('../models/InventoryItem');

// Generate a random date between now and daysAhead
function futureDate(daysAhead) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
}
function pastDate(daysAgo) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

const SUPPLIERS = [
  'MedTech India Pvt Ltd',
  'Cipla Healthcare',
  'Dhanwantari Surgical',
  'SafeGuard Medical Supplies',
  'Apollo MedEquip',
  'LifeCare Pharma'
];

const BATCH_PREFIXES = ['BT', 'MFG', 'LOT', 'STK', 'PH'];

function randomBatch() {
  const prefix = BATCH_PREFIXES[Math.floor(Math.random() * BATCH_PREFIXES.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  const year = 2025 + Math.floor(Math.random() * 2);
  return `${prefix}-${year}-${num}`;
}

function randomSupplier() {
  return SUPPLIERS[Math.floor(Math.random() * SUPPLIERS.length)];
}

async function seedBoxStocks() {
  try {
    await connectDB();

    const boxes = await FirstAidBox.find({}).populate('items.item', 'name category');

    if (boxes.length === 0) {
      console.log('❌ No boxes found. Run seedData.js first.');
      process.exit(1);
    }

    console.log(`📦 Found ${boxes.length} boxes. Adding stock batches...\n`);

    // Expiry distribution — gives variety for testing
    // Some expired, some expiring soon, some healthy
    const expiryProfiles = [
      { label: 'Expired 10 days ago', days: -10 },
      { label: 'Expired 3 days ago',  days: -3  },
      { label: 'Expiring in 2 days',  days: 2   },
      { label: 'Expiring in 5 days',  days: 5   },
      { label: 'Expiring in 15 days', days: 15  },
      { label: 'Expiring in 25 days', days: 25  },
      { label: 'Expiring in 45 days', days: 45  },
      { label: 'Expiring in 60 days', days: 60  },
      { label: 'Expiring in 120 days', days: 120 },
      { label: 'Expiring in 200 days', days: 200 },
      { label: 'Expiring in 365 days', days: 365 },
    ];

    let totalStocks = 0;

    for (const box of boxes) {
      console.log(`🩹 Box: ${box.boxId} (${box.location})`);

      box.items.forEach((item, itemIdx) => {
        // Give each item 1-3 stock batches
        const numStocks = 1 + (itemIdx % 3); // cycles 1, 2, 3, 1, 2, 3...
        const stocks = [];

        for (let s = 0; s < numStocks; s++) {
          // Pick an expiry profile that varies per item+stock combo
          const profileIdx = (itemIdx * 3 + s * 7 + box.items.indexOf(item)) % expiryProfiles.length;
          const profile = expiryProfiles[profileIdx];
          const expiryDays = profile.days;

          const expiryDate = expiryDays >= 0 ? futureDate(expiryDays) : pastDate(Math.abs(expiryDays));

          // Split the required quantity across stocks
          const qty = Math.max(1, Math.ceil(item.requiredQty / numStocks));

          stocks.push({
            batchNumber: randomBatch(),
            quantity: qty,
            expiryDate: expiryDate,
            manufacturingDate: pastDate(365 + Math.floor(Math.random() * 180)),
            supplier: randomSupplier(),
            purchaseDate: pastDate(60 + Math.floor(Math.random() * 90)),
            addedAt: pastDate(Math.floor(Math.random() * 30))
          });

          totalStocks++;
        }

        item.stocks = stocks;
        // Update currentQty to sum of all stock quantities
        item.currentQty = stocks.reduce((sum, s) => sum + s.quantity, 0);
      });

      await box.save();
      console.log(`   ✅ ${box.items.length} items updated with stocks`);
    }

    console.log(`\n✅ Done! ${totalStocks} stock batches created across ${boxes.length} boxes.`);
    console.log('\nExpiry distribution includes:');
    console.log('  🔴 Expired items (past dates)');
    console.log('  🟠 Critical items (expiring within 7 days)');
    console.log('  🟡 Warning items (expiring within 30 days)');
    console.log('  🔵 Upcoming items (expiring within 90 days)');
    console.log('  🟢 Healthy items (90+ days left)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedBoxStocks();
