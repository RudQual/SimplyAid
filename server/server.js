const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files (uploads)
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/incidents', require('./routes/incidentRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.use('/api/employees', require('./routes/employeeRoutes'));

// Phase 2 Routes
app.use('/api/treatments', require('./routes/treatmentRoutes'));
app.use('/api/medical-profiles', require('./routes/medicalProfileRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));
app.use('/api/expiry', require('./routes/expiryRoutes'));
app.use('/api/compliance', require('./routes/complianceRoutes'));
app.use('/api/inspections', require('./routes/inspectionRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/scanners', require('./routes/scannerRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'SimplyAID API is running', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start expiry scheduler (persistent, global timing)
const { startExpiryScheduler } = require('./utils/expiryScheduler');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SimplyAID Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  // Start scheduler after server is up and DB is connected
  startExpiryScheduler();
});
