const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const { validateEnv } = require('./config/env');
const connectDB = require('./config/db');
const { runMigrations } = require('./config/migrations');
const createApp = require('./app');
const { startScheduler, stopScheduler } = require('./services/monitoringService');

const start = async () => {
  validateEnv();
  await connectDB();
  // Indexes are built here (autoIndex is off) so conflicts with older index definitions are handled.
  await runMigrations();

  const app = createApp();
  const PORT = Number(process.env.PORT) || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 SimplyAID API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    if (process.env.DISABLE_SCHEDULER !== 'true') startScheduler();
  });

  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down`);
    stopScheduler();
    server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

start().catch((err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
