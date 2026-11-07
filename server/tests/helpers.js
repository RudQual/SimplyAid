process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-0123456789abcdef';
process.env.JWT_EXPIRE = '1h';
delete process.env.ENABLE_DEMO_LOGIN;

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const createApp = require('../app');
const { runMigrations } = require('../config/migrations');
const Company = require('../models/Company');
const Department = require('../models/Department');
const User = require('../models/User');
const InventoryItem = require('../models/InventoryItem');

const PASSWORD = 'Test@1234';
const DAY = 86400000;

let mongod;

const start = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('simplyaid_test'));
  await runMigrations();
  return request(createApp());
};

const stop = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

/** Create a company with two departments, one user per role and a small catalog. */
const seedCompany = async (code = 'ACME') => {
  const company = await Company.create({ name: `${code} Industries`, code, totalWorkers: 50 });
  const [prod, admin] = await Department.create([
    { name: 'Production', code: 'PROD', company: company._id },
    { name: 'Administration', code: 'ADMIN', company: company._id }
  ]);
  const mk = (name, role, department, extra = {}) => ({
    name, email: `${name.toLowerCase().replace(/\s+/g, '.')}.${code.toLowerCase()}@test.com`, password: PASSWORD,
    role, company: company._id, department: department._id, ...extra
  });
  const users = await User.create([
    mk('Ada Admin', 'admin', admin),
    mk('Doc Holliday', 'doctor', admin),
    mk('Max Manager', 'manager', prod),
    mk('Olga Othermanager', 'manager', admin),
    mk('Eve Employee', 'employee', prod, { employeeId: `${code}-E1`, firstAidCertified: true, certificationExpiry: new Date(Date.now() + 365 * DAY) })
  ]);
  const items = await InventoryItem.create([
    { name: `Bandage ${code}`, category: 'bandage', unit: 'rolls', company: company._id, isMandatory: true, requiredQty: { classA: 2, classB: 4, classC: 6 } },
    { name: `Antiseptic ${code}`, category: 'antiseptic', unit: 'bottles', company: company._id, isMandatory: true, requiredQty: { classA: 1, classB: 2, classC: 3 } }
  ]);
  const byRole = (role, i = 0) => users.filter((u) => u.role === role)[i];
  return { company, prod, admin, users, items, byRole };
};

const login = async (api, user) => {
  const res = await api.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { start, stop, seedCompany, login, auth, PASSWORD, DAY };
