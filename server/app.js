const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const { notFound } = require('./middleware/errorHandler');
const { sanitizeBody, apiLimiter } = require('./middleware/security');

const createApp = () => {
  const app = express();
  const env = process.env.NODE_ENV || 'development';

  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.disable('x-powered-by');

  // Security headers
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

  // CORS — comma-separated list of allowed origins
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => (!origin || origins.includes(origin) ? cb(null, true) : cb(null, false)),
    credentials: true
  }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitizeBody);

  if (env === 'development') app.use(morgan('dev'));
  else if (env === 'production') app.use(morgan('combined'));

  // Uploaded profile photos
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false }));

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'SimplyAID API is running', timestamp: new Date().toISOString() });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/dashboard', require('./routes/dashboardRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/companies', require('./routes/companyRoutes'));
  app.use('/api/departments', require('./routes/departmentRoutes'));
  app.use('/api/incidents', require('./routes/incidentRoutes'));
  app.use('/api/inventory', require('./routes/inventoryRoutes'));
  app.use('/api/reports', require('./routes/reportRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/employees', require('./routes/employeeRoutes'));
  app.use('/api/treatments', require('./routes/treatmentRoutes'));
  app.use('/api/medical-profiles', require('./routes/medicalProfileRoutes'));
  app.use('/api/audit-logs', require('./routes/auditLogRoutes'));
  app.use('/api/expiry', require('./routes/expiryRoutes'));
  app.use('/api/compliance', require('./routes/complianceRoutes'));
  app.use('/api/inspections', require('./routes/inspectionRoutes'));
  app.use('/api/analytics', require('./routes/analyticsRoutes'));
  app.use('/api/scanners', require('./routes/scannerRoutes'));

  app.use('/api', notFound);

  // Serve the built client in production (single deployable)
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (env === 'production' && process.env.SERVE_CLIENT !== 'false') {
    app.use(express.static(clientDist, { index: false }));
    app.get(/^\/(?!api|uploads).*/, (req, res, next) => {
      res.sendFile(path.join(clientDist, 'index.html'), (err) => (err ? next() : undefined));
    });
  }

  app.use(errorHandler);
  return app;
};

module.exports = createApp;
