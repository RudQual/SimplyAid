const ExpirySchedule = require('../models/ExpirySchedule');
const FirstAidBox = require('../models/FirstAidBox');
const { notifySafetyTeam } = require('./notificationService');
const Company = require('../models/Company');

/**
 * Expiry Scheduler — runs expiry checks on a global timer.
 * Persists last-run time to DB so it survives server restarts.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour if it's time to run

async function runExpiryCheck() {
  try {
    const companies = await Company.find({});
    const now = new Date();

    const alertThresholds = [
      { days: 0, label: 'EXPIRED', severity: 'critical' },
      { days: 7, label: 'expiring in 7 days', severity: 'critical' },
      { days: 30, label: 'expiring in 30 days', severity: 'warning' },
      { days: 90, label: 'expiring in 90 days', severity: 'info' }
    ];

    let totalAlerts = 0;
    let totalBoxes = 0;

    for (const company of companies) {
      const boxes = await FirstAidBox.find({ company: company._id, isActive: true })
        .populate('items.item', 'name category');

      totalBoxes += boxes.length;

      const alerts = [];

      boxes.forEach(box => {
        box.items.forEach(item => {
          // Check stocks array first, then fallback to legacy single field
          const expiryEntries = [];

          if (item.stocks && item.stocks.length > 0) {
            item.stocks.forEach(stock => {
              if (stock.expiryDate) {
                expiryEntries.push({
                  expiryDate: stock.expiryDate,
                  batchNumber: stock.batchNumber,
                  quantity: stock.quantity
                });
              }
            });
          } else if (item.expiryDate) {
            expiryEntries.push({
              expiryDate: item.expiryDate,
              batchNumber: item.batchNumber,
              quantity: item.currentQty
            });
          }

          expiryEntries.forEach(entry => {
            const exp = new Date(entry.expiryDate);
            const daysRemaining = Math.ceil((exp - now) / (24 * 60 * 60 * 1000));

            for (const threshold of alertThresholds) {
              if (daysRemaining <= threshold.days) {
                alerts.push({
                  type: 'expiry_alert',
                  title: `${item.item?.name || 'Item'} — ${threshold.label}`,
                  message: `${item.item?.name} in box ${box.boxId} (${box.location}) is ${threshold.label}. Batch: ${entry.batchNumber || 'N/A'}, Qty: ${entry.quantity}`,
                  severity: threshold.severity,
                  relatedModel: 'FirstAidBox',
                  relatedId: box._id
                });
                break;
              }
            }
          });
        });
      });

      if (alerts.length) {
        for (const alert of alerts) {
          await notifySafetyTeam(company._id, alert);
        }
      }
      totalAlerts += alerts.length;
    }

    // Update schedule record
    await ExpirySchedule.findOneAndUpdate(
      { key: 'expiry_check' },
      {
        lastRunAt: now,
        alertsGeneratedLastRun: totalAlerts,
        boxesCheckedLastRun: totalBoxes
      },
      { upsert: true, new: true }
    );

    console.log(`⏰ Expiry scheduler: ${totalAlerts} alerts generated across ${totalBoxes} boxes`);
    return { totalAlerts, totalBoxes };
  } catch (error) {
    console.error('❌ Expiry scheduler error:', error.message);
  }
}

async function shouldRun() {
  try {
    let schedule = await ExpirySchedule.findOne({ key: 'expiry_check' });

    if (!schedule) {
      // First run ever — create record and run immediately
      schedule = await ExpirySchedule.create({ key: 'expiry_check' });
      return true;
    }

    if (!schedule.lastRunAt) return true;

    const hoursSinceLastRun = (Date.now() - new Date(schedule.lastRunAt).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastRun >= schedule.intervalHours;
  } catch (error) {
    console.error('Expiry schedule check error:', error.message);
    return false;
  }
}

async function tick() {
  const shouldRunNow = await shouldRun();
  if (shouldRunNow) {
    await runExpiryCheck();
  }
}

/**
 * Start the expiry scheduler. Call this once after DB connection.
 */
function startExpiryScheduler() {
  console.log('⏰ Expiry scheduler initialized (checks every hour, runs every 24h)');

  // Check immediately on startup
  tick();

  // Then check every hour
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { startExpiryScheduler, runExpiryCheck };
