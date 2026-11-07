const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, seedCompany, login, auth, PASSWORD, DAY } = require('./helpers');
const FirstAidBox = require('../models/FirstAidBox');
const StockTransaction = require('../models/StockTransaction');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Incident = require('../models/Incident');
const { runCompanyChecks } = require('../services/monitoringService');

let api;
let A; // company A fixtures
let B; // company B fixtures
const tokens = {};

const future = (days) => new Date(Date.now() + days * DAY).toISOString();

before(async () => {
  api = await start();
  A = await seedCompany('ACME');
  B = await seedCompany('BETA');
  tokens.admin = await login(api, A.byRole('admin'));
  tokens.doctor = await login(api, A.byRole('doctor'));
  tokens.manager = await login(api, A.byRole('manager', 0)); // Production
  tokens.otherManager = await login(api, A.byRole('manager', 1)); // Administration
  tokens.employee = await login(api, A.byRole('employee'));
  tokens.bDoctor = await login(api, B.byRole('doctor'));
});

after(stop);

/** Create a class-B kit in the Production department, in charge of the certified employee. */
const createKit = async (boxId, extra = {}) => {
  const res = await api.post('/api/inventory/boxes').set(auth(tokens.doctor)).send({
    boxId, location: 'Assembly line', department: A.prod._id.toString(), classType: 'B', inCharge: A.byRole('employee')._id.toString(), ...extra
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
};
const bandageId = () => A.items[0]._id.toString();
const restock = (kitId, quantity, expiryDays = 400, token = tokens.doctor, extra = {}) => api
  .post(`/api/inventory/boxes/${kitId}/items/${bandageId()}/restock`).set(auth(token))
  .send({ quantity, expiryDate: future(expiryDays), batchNumber: `B-${quantity}-${expiryDays}`, ...extra });

describe('Authentication', () => {
  test('health check responds', async () => {
    const res = await api.get('/api/health');
    assert.equal(res.status, 200);
  });

  test('login rejects a wrong password with a generic message', async () => {
    const res = await api.post('/api/auth/login').send({ email: A.byRole('doctor').email, password: 'wrong-password1' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  test('login rejects NoSQL operator injection', async () => {
    const res = await api.post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  test('login response never contains the password hash', async () => {
    const res = await api.post('/api/auth/login').send({ email: A.byRole('doctor').email, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.data.password, undefined);
  });

  test('protected routes require a token', async () => {
    assert.equal((await api.get('/api/auth/me')).status, 401);
    assert.equal((await api.get('/api/auth/me').set('Authorization', 'Bearer not-a-token')).status, 401);
  });

  test('self sign-up requires a valid company code and always creates an employee', async () => {
    const bad = await api.post('/api/auth/signup').send({ name: 'New Person', email: 'new@test.com', password: 'Passw0rd!', companyCode: 'NOPE' });
    assert.equal(bad.status, 400);
    const weak = await api.post('/api/auth/signup').send({ name: 'New Person', email: 'new@test.com', password: 'short', companyCode: 'ACME' });
    assert.equal(weak.status, 400);
    const res = await api.post('/api/auth/signup').send({ name: 'New Person', email: 'New@Test.com', password: 'Passw0rd!', companyCode: 'acme', role: 'doctor' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.role, 'employee');
    assert.equal(res.body.data.email, 'new@test.com');
    const dup = await api.post('/api/auth/signup').send({ name: 'Again', email: 'new@test.com', password: 'Passw0rd!', companyCode: 'ACME' });
    assert.equal(dup.status, 409);
  });

  test('/register is no longer public', async () => {
    const anon = await api.post('/api/auth/register').send({ name: 'X', email: 'x@test.com', password: 'Passw0rd!', role: 'admin' });
    assert.equal(anon.status, 401);
    const emp = await api.post('/api/auth/register').set(auth(tokens.employee)).send({ name: 'X Y', email: 'x@test.com', password: 'Passw0rd!' });
    assert.equal(emp.status, 403);
  });

  test('demo quick-login is disabled unless explicitly enabled', async () => {
    const res = await api.post('/api/auth/quick-login').send({ email: A.byRole('admin').email });
    assert.equal(res.status, 404);
    assert.equal((await api.get('/api/auth/demo-accounts')).status, 404);
  });

  test('changing password invalidates old tokens and returns a new one', async () => {
    const user = A.users.find((u) => u.name === 'Olga Othermanager');
    const oldToken = await login(api, user);
    await new Promise((r) => setTimeout(r, 1100)); // token iat has 1-second resolution
    const res = await api.put('/api/auth/change-password').set(auth(oldToken)).send({ currentPassword: PASSWORD, newPassword: 'NewPassw0rd' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await api.get('/api/auth/me').set(auth(oldToken))).status, 401);
    assert.equal((await api.get('/api/auth/me').set(auth(res.body.token))).status, 200);
    // restore for other tests
    const back = await api.put('/api/auth/change-password').set(auth(res.body.token)).send({ currentPassword: 'NewPassw0rd', newPassword: PASSWORD });
    assert.equal(back.status, 200);
    tokens.otherManager = back.body.token;
  });
});

describe('Authorization & tenant isolation', () => {
  test('employees cannot manage inventory or list users', async () => {
    const item = await api.post('/api/inventory/items').set(auth(tokens.employee)).send({ name: 'Gauze', category: 'dressing', unit: 'pcs' });
    assert.equal(item.status, 403);
    assert.equal((await api.get('/api/users').set(auth(tokens.employee))).status, 403);
    assert.equal((await api.get('/api/audit-logs').set(auth(tokens.employee))).status, 403);
    assert.equal((await api.get('/api/treatments').set(auth(tokens.employee))).status, 403);
  });

  test('users of another company cannot see or change our kits', async () => {
    const kit = await createKit('ISO-1');
    assert.equal((await api.get(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.bDoctor))).status, 404);
    const r = await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/restock`).set(auth(tokens.bDoctor)).send({ quantity: 5 });
    assert.equal(r.status, 404);
    const list = await api.get('/api/inventory/boxes').set(auth(tokens.bDoctor));
    assert.ok(list.body.data.every((b) => b.boxId !== 'ISO-1'));
  });

  test('managers can only manage kits in their own department', async () => {
    const kit = await createKit('DEPT-1');
    const other = await restock(kit._id, 2, 400, tokens.otherManager);
    assert.equal(other.status, 403);
    const own = await restock(kit._id, 2, 400, tokens.manager);
    assert.equal(own.status, 200, JSON.stringify(own.body));
  });
});

describe('Inventory catalog CRUD', () => {
  let itemId;
  test('create, prevent duplicates, update, search', async () => {
    const res = await api.post('/api/inventory/items').set(auth(tokens.doctor)).send({ name: 'Burn Gel', category: 'medicine', unit: 'tubes', requiredQty: { classA: 1 } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    itemId = res.body.data._id;
    const dup = await api.post('/api/inventory/items').set(auth(tokens.doctor)).send({ name: 'burn gel', category: 'medicine', unit: 'tubes' });
    assert.equal(dup.status, 409);
    const invalid = await api.post('/api/inventory/items').set(auth(tokens.doctor)).send({ name: 'X', category: 'nonsense', unit: '' });
    assert.equal(invalid.status, 400);
    const upd = await api.put(`/api/inventory/items/${itemId}`).set(auth(tokens.doctor)).send({ unit: 'tube', requiredQty: { classC: 4 } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.unit, 'tube');
    assert.equal(upd.body.data.requiredQty.classA, 1, 'unchanged classes are kept');
    assert.equal(upd.body.data.requiredQty.classC, 4);
    const search = await api.get('/api/inventory/items?search=burn').set(auth(tokens.doctor));
    assert.equal(search.body.data.length, 1);
    assert.equal(search.body.data[0].stock.stockStatus, 'not_stocked');
  });

  test('an item used in a kit cannot be archived; an unused one can', async () => {
    await createKit('CAT-1');
    const blocked = await api.delete(`/api/inventory/items/${bandageId()}`).set(auth(tokens.doctor));
    assert.equal(blocked.status, 409);
    const ok = await api.delete(`/api/inventory/items/${itemId}`).set(auth(tokens.doctor));
    assert.equal(ok.status, 200);
    const list = await api.get('/api/inventory/items').set(auth(tokens.doctor));
    assert.ok(!list.body.data.some((i) => i._id === itemId));
  });
});

describe('Kits and stock management', () => {
  test('a new kit is populated from the class requirements and needs an inspection', async () => {
    const kit = await createKit('KIT-NEW');
    assert.equal(kit.items.length, 2);
    assert.equal(kit.items.find((i) => i.item._id === bandageId()).requiredQty, 4);
    assert.equal(kit.status, 'overdue_inspection');
    const dup = await api.post('/api/inventory/boxes').set(auth(tokens.doctor)).send({ boxId: 'kit-new', location: 'X Y', department: A.prod._id.toString() });
    assert.equal(dup.status, 409);
  });

  test('restock adds a batch, records a transaction and rejects invalid quantities', async () => {
    const kit = await createKit('KIT-STOCK');
    const ok = await restock(kit._id, 6);
    assert.equal(ok.status, 200);
    const item = ok.body.data.items.find((i) => i.item._id === bandageId());
    assert.equal(item.currentQty, 6);
    assert.equal(await StockTransaction.countDocuments({ box: kit._id, type: 'restock' }), 1);
    assert.equal((await restock(kit._id, -3)).status, 400);
    assert.equal((await restock(kit._id, 1.5)).status, 400);
    assert.equal((await restock(kit._id, 2, -10)).status, 400, 'expired stock must be rejected');
  });

  test('dispensing uses the earliest-expiring batch first and never goes negative', async () => {
    const kit = await createKit('KIT-FIFO');
    await restock(kit._id, 3, 300);
    await restock(kit._id, 2, 20);
    const over = await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/dispense`).set(auth(tokens.doctor)).send({ quantity: 9 });
    assert.equal(over.status, 409);
    const res = await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/dispense`).set(auth(tokens.doctor)).send({ quantity: 3 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const item = res.body.data.items.find((i) => i.item._id === bandageId());
    assert.equal(item.currentQty, 2);
    assert.equal(item.stocks.length, 1);
    assert.ok(new Date(item.stocks[0].expiryDate) > new Date(Date.now() + 200 * DAY), 'short-dated batch consumed first');
  });

  test('emptying an item keeps it at zero (no stock resurrected on save)', async () => {
    const kit = await createKit('KIT-ZERO');
    await restock(kit._id, 2, 300);
    const use = await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/dispense`).set(auth(tokens.doctor)).send({ quantity: 2 });
    assert.equal(use.status, 200);
    assert.equal(use.body.data.items.find((i) => i.item._id === bandageId()).currentQty, 0);
    // a later unrelated save of the kit must not bring the units back
    await api.put(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.doctor)).send({ floor: 'Ground' });
    const box = await FirstAidBox.findById(kit._id);
    assert.equal(FirstAidBox.itemQuantity(box.items.find((i) => String(i.item) === bandageId())), 0);
    // removing the only (expired) batch also leaves zero
    await FirstAidBox.updateOne({ _id: kit._id, 'items.item': A.items[0]._id }, { $push: { 'items.$.stocks': { quantity: 3, expiryDate: new Date(Date.now() - DAY) } } });
    const rm = await api.post(`/api/inventory/boxes/${kit._id}/remove-expired`).set(auth(tokens.doctor)).send({});
    assert.equal(rm.status, 200);
    assert.equal(rm.body.data.items.find((i) => i.item._id === bandageId()).currentQty, 0);
    assert.equal(rm.body.data.health.totalUnits, 0);
  });

  test('legacy kits (quantity without batches) are migrated, not lost', async () => {
    const kit = await createKit('KIT-LEGACY');
    await FirstAidBox.collection.updateOne({ _id: new (require('mongoose').Types.ObjectId)(kit._id), 'items.item': A.items[0]._id }, { $set: { 'items.$.currentQty': 5, 'items.$.stocks': [] } });
    const res = await restock(kit._id, 1);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.items.find((i) => i.item._id === bandageId()).currentQty, 6);
  });

  test('adjustments require a reason', async () => {
    const kit = await createKit('KIT-ADJ');
    const r = await restock(kit._id, 5);
    const stockId = r.body.data.items.find((i) => i.item._id === bandageId()).stocks[0]._id;
    const noReason = await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/adjust`).set(auth(tokens.doctor)).send({ stockId, quantity: 4 });
    assert.equal(noReason.status, 400);
    const ok = await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/adjust`).set(auth(tokens.doctor)).send({ stockId, quantity: 4, reason: 'Physical count' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.items.find((i) => i.item._id === bandageId()).currentQty, 4);
  });

  test('concurrent restocks of the same kit are all applied', async () => {
    const kit = await createKit('KIT-RACE');
    const results = await Promise.all(Array.from({ length: 8 }, () => restock(kit._id, 1)));
    results.forEach((r) => assert.equal(r.status, 200, JSON.stringify(r.body)));
    const box = await FirstAidBox.findById(kit._id);
    assert.equal(FirstAidBox.itemQuantity(box.items.find((i) => String(i.item) === bandageId())), 8);
    assert.equal(await StockTransaction.countDocuments({ box: kit._id }), 8, "one ledger entry per restock");
  });

  test('add and remove kit items, change required quantity', async () => {
    const kit = await createKit('KIT-CONTENTS', { classType: 'A' });
    const extra = await api.post('/api/inventory/items').set(auth(tokens.doctor)).send({ name: 'Eye Wash', category: 'equipment', unit: 'pcs' });
    const add = await api.post(`/api/inventory/boxes/${kit._id}/items`).set(auth(tokens.doctor)).send({ itemId: extra.body.data._id, requiredQty: 1 });
    assert.equal(add.status, 201);
    assert.equal((await api.post(`/api/inventory/boxes/${kit._id}/items`).set(auth(tokens.doctor)).send({ itemId: extra.body.data._id })).status, 409);
    const req = await api.put(`/api/inventory/boxes/${kit._id}/items/${extra.body.data._id}`).set(auth(tokens.doctor)).send({ requiredQty: 3 });
    assert.equal(req.body.data.items.find((i) => i.item._id === extra.body.data._id).requiredQty, 3);
    const del = await api.delete(`/api/inventory/boxes/${kit._id}/items/${extra.body.data._id}`).set(auth(tokens.doctor));
    assert.equal(del.status, 200);
    assert.ok(!del.body.data.items.some((i) => i.item._id === extra.body.data._id));
  });

  test('retiring a kit removes it from active lists', async () => {
    const kit = await createKit('KIT-RETIRE');
    assert.equal((await api.delete(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.manager))).status, 403);
    assert.equal((await api.delete(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.doctor))).status, 200);
    assert.equal((await api.get(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.doctor))).status, 404);
  });
});

describe('Low-stock alerts and the monitoring job', () => {
  test('dropping below the threshold raises one alert, and re-running checks does not duplicate it', async () => {
    const kit = await createKit('KIT-ALERT');
    await restock(kit._id, 4); // exactly the requirement
    const doctorId = A.byRole('doctor')._id;
    const lowKey = { recipient: doctorId, relatedId: kit._id, type: 'inventory_low' };
    assert.equal(await Notification.countDocuments(lowKey), 0);
    await api.post(`/api/inventory/boxes/${kit._id}/items/${bandageId()}/dispense`).set(auth(tokens.doctor)).send({ quantity: 2 });
    assert.equal(await Notification.countDocuments(lowKey), 1);
    await runCompanyChecks(A.company._id);
    await runCompanyChecks(A.company._id);
    assert.equal(await Notification.countDocuments(lowKey), 1, 'no duplicate alerts');
    // the production manager is notified too, the admin-department manager is not
    assert.equal(await Notification.countDocuments({ ...lowKey, recipient: A.byRole('manager', 0)._id }), 1);
    assert.equal(await Notification.countDocuments({ ...lowKey, recipient: A.byRole('manager', 1)._id }), 0);
    // the alert shows up in the doctor's dashboard
    const dash = await api.get('/api/dashboard').set(auth(tokens.doctor));
    assert.equal(dash.status, 200);
    assert.ok(dash.body.data.unreadNotifications > 0);
    assert.ok(dash.body.data.inventory.lowStockItems >= 1);
  });
});

describe('Expiry tracking', () => {
  test('batches are classified by days remaining and expired stock can be removed', async () => {
    const kit = await createKit('KIT-EXP');
    await restock(kit._id, 2, 5);
    await FirstAidBox.updateOne({ _id: kit._id }, { $push: { 'items.0.stocks': { batchNumber: 'OLD', quantity: 3, expiryDate: new Date(Date.now() - 2 * DAY) } } });
    const items = await api.get(`/api/expiry/items?box=${kit._id}`).set(auth(tokens.doctor));
    assert.equal(items.status, 200);
    const statuses = items.body.data.map((e) => e.status).sort();
    assert.deepEqual(statuses, ['critical', 'expired']);
    const expiredEntry = items.body.data.find((e) => e.status === 'expired');
    assert.ok(expiredEntry.daysRemaining < 0);

    const dash = await api.get(`/api/expiry/dashboard?box=${kit._id}`).set(auth(tokens.doctor));
    assert.equal(dash.body.data.summary.expiredUnits, 3);

    const rm = await api.post(`/api/inventory/boxes/${kit._id}/remove-expired`).set(auth(tokens.doctor)).send({});
    assert.equal(rm.status, 200, JSON.stringify(rm.body));
    assert.equal(await StockTransaction.countDocuments({ box: kit._id, type: 'expired_removal', quantityChange: -3 }), 1);
    assert.equal((await api.post(`/api/inventory/boxes/${kit._id}/remove-expired`).set(auth(tokens.doctor)).send({})).status, 400);
  });

  test('scheduled check raises expiry alerts once', async () => {
    const kit = await createKit('KIT-EXP2');
    await restock(kit._id, 4, 3);
    const filter = { relatedId: kit._id, type: 'expiry_alert', recipient: A.byRole('doctor')._id };
    const before = await Notification.countDocuments(filter);
    assert.equal(before, 1, 'raised immediately after the restock');
    await runCompanyChecks(A.company._id);
    assert.equal(await Notification.countDocuments(filter), 1);
  });
});

describe('Incidents', () => {
  test('supplies used in an incident are deducted exactly once across the workflow', async () => {
    const kit = await createKit('KIT-INC');
    await restock(kit._id, 5);
    const create = await api.post('/api/incidents').set(auth(tokens.employee)).send({
      severity: 'minor', description: 'Cut finger on the conveyor guard', location: 'Line 2', incidentType: 'injury',
      firstAidBoxUsed: kit._id, itemsUsed: [{ item: bandageId(), quantity: 2 }]
    });
    assert.equal(create.status, 201, JSON.stringify(create.body));
    const id = create.body.data._id;
    const qty = async () => FirstAidBox.itemQuantity((await FirstAidBox.findById(kit._id)).items.find((i) => String(i.item) === bandageId()));
    assert.equal(await qty(), 3);
    const confirm = await api.put(`/api/incidents/${id}/manager-confirm`).set(auth(tokens.manager)).send({ outcome: 'referred_to_doctor', notes: 'Seen on site' });
    assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
    const review = await api.put(`/api/incidents/${id}/doctor-review`).set(auth(tokens.doctor)).send({ notes: 'Dressed wound' });
    assert.equal(review.status, 200);
    assert.equal(await qty(), 3, 'no double deduction');
    assert.equal((await Incident.findById(id)).status, 'resolved');
  });

  test('employees only see their own incidents; managers only their department', async () => {
    const otherEmp = await api.post('/api/incidents').set(auth(tokens.doctor)).send({ severity: 'minor', description: 'Admin office slip', location: 'Office', department: A.admin._id.toString() });
    assert.equal(otherEmp.status, 201);
    const mine = await api.get('/api/incidents').set(auth(tokens.employee));
    assert.ok(mine.body.data.every((i) => i.reportedBy && i.reportedBy.name === 'Eve Employee'));
    assert.equal((await api.get(`/api/incidents/${otherEmp.body.data._id}`).set(auth(tokens.employee))).status, 404);
    const mgr = await api.get('/api/incidents').set(auth(tokens.manager));
    assert.ok(mgr.body.data.every((i) => i.department.name === 'Production'));
  });

  test('Form 18 PDF can be generated and marks the incident', async () => {
    const inc = await api.post('/api/incidents').set(auth(tokens.doctor)).send({ severity: 'fatal', description: 'Fatal fall from height', location: 'Roof', department: A.prod._id.toString() });
    assert.equal(inc.body.data.isReportable, true);
    const pdf = await api.get(`/api/incidents/${inc.body.data._id}/form18`).set(auth(tokens.doctor)).buffer(true);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers['content-type'], /application\/pdf/);
    assert.equal((await Incident.findById(inc.body.data._id)).form18Generated, true);
  });
});

describe('Inspections and compliance', () => {
  test('a stocked, inspected kit with a certified in-charge scores 100', async () => {
    const kit = await createKit('KIT-COMP');
    await restock(kit._id, 4);
    await api.post(`/api/inventory/boxes/${kit._id}/items/${A.items[1]._id}/restock`).set(auth(tokens.doctor)).send({ quantity: 2, expiryDate: future(400) });
    const before = await api.get(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.doctor));
    assert.equal(before.body.data.compliance.score, 80, 'only the inspection rule fails');
    const ins = await api.post('/api/inspections').set(auth(tokens.manager)).send({ firstAidBox: kit._id, overallNotes: 'All good' });
    assert.equal(ins.status, 201, JSON.stringify(ins.body));
    assert.equal(ins.body.data.complianceScore, 100);
    assert.equal(ins.body.data.status, 'adequate');
    const afterRes = await api.get(`/api/inventory/boxes/${kit._id}`).set(auth(tokens.doctor));
    assert.equal(afterRes.body.data.compliance.status, 'compliant');
    assert.equal(afterRes.body.data.status, 'adequate');
    assert.ok(new Date(afterRes.body.data.nextInspectionDue) > new Date(Date.now() + 29 * DAY));
  });

  test('deficiencies are recorded and can be resolved', async () => {
    const kit = await createKit('KIT-DEF');
    const ins = await api.post('/api/inspections').set(auth(tokens.doctor)).send({ firstAidBox: kit._id, status: 'failed', deficiencies: [{ description: 'Seal broken', severity: 'moderate' }] });
    assert.equal(ins.status, 201);
    assert.equal(ins.body.data.complianceStatus, 'non_compliant');
    const defId = ins.body.data.deficiencies[0]._id;
    const res = await api.put(`/api/inspections/${ins.body.data._id}/deficiencies/${defId}/resolve`).set(auth(tokens.doctor));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.deficiencies[0].resolved, true);
    const list = await api.get(`/api/inspections?firstAidBox=${kit._id}`).set(auth(tokens.doctor));
    assert.equal(list.body.total, 1);
  });

  test('company compliance is computed from real data', async () => {
    const res = await api.get('/api/compliance/company').set(auth(tokens.doctor));
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.ok(d.overallCompliance >= 0 && d.overallCompliance <= 100);
    assert.equal(d.summary.activeBoxes, await FirstAidBox.countDocuments({ company: A.company._id, isActive: true }));
    assert.ok(d.checks.find((c) => c.key === 'box_count'));
    const dept = await api.get('/api/compliance/departments').set(auth(tokens.manager));
    assert.ok(dept.body.data.departments.every((x) => x.department.name === 'Production'));
  });
});

describe('Notifications', () => {
  test('read/unread, read-all and archive work per user', async () => {
    const list = await api.get('/api/notifications').set(auth(tokens.doctor));
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length > 0);
    const id = list.body.data[0]._id;
    assert.equal((await api.put(`/api/notifications/${id}/read`).set(auth(tokens.doctor))).body.data.isRead, true);
    assert.equal((await api.put(`/api/notifications/${id}/read`).set(auth(tokens.doctor)).send({ isRead: false })).body.data.isRead, false);
    assert.equal((await api.put(`/api/notifications/${id}/read`).set(auth(tokens.employee))).status, 404, "can't touch another user's notification");
    await api.put('/api/notifications/read-all').set(auth(tokens.doctor));
    const after = await api.get('/api/notifications?unreadOnly=true').set(auth(tokens.doctor));
    assert.equal(after.body.unreadCount, 0);
    const arch = await api.put(`/api/notifications/${id}/archive`).set(auth(tokens.doctor));
    assert.equal(arch.status, 200);
    const archived = await api.get('/api/notifications?archived=true').set(auth(tokens.doctor));
    assert.ok(archived.body.data.some((n) => n._id === id));
  });
});

describe('User and role management', () => {
  test('doctor can create employees but not administrators', async () => {
    const ok = await api.post('/api/users').set(auth(tokens.doctor)).send({ name: 'New Hire', email: 'hire@test.com', password: 'Passw0rd!', role: 'employee', department: A.prod._id.toString() });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.ok(ok.body.data.employeeId);
    const admin = await api.post('/api/users').set(auth(tokens.doctor)).send({ name: 'Sneaky', email: 'sneaky@test.com', password: 'Passw0rd!', role: 'admin' });
    assert.equal(admin.status, 403);
    const byAdmin = await api.post('/api/users').set(auth(tokens.admin)).send({ name: 'Second Admin', email: 'admin2@test.com', password: 'Passw0rd!', role: 'admin' });
    assert.equal(byAdmin.status, 201);
  });

  test('users cannot change their own role; managers cannot assign roles', async () => {
    const self = await api.put(`/api/users/${A.byRole('doctor')._id}`).set(auth(tokens.doctor)).send({ role: 'admin' });
    assert.equal(self.status, 403);
    const mgr = await api.put(`/api/users/${A.byRole('employee')._id}`).set(auth(tokens.manager)).send({ role: 'doctor' });
    assert.equal(mgr.status, 403);
    const mgrEdit = await api.put(`/api/users/${A.byRole('employee')._id}`).set(auth(tokens.manager)).send({ designation: 'Line Lead' });
    assert.equal(mgrEdit.status, 200);
    assert.equal(mgrEdit.body.data.designation, 'Line Lead');
  });

  test('legacy profile endpoint no longer allows privilege escalation', async () => {
    const res = await api.put(`/api/employees/profile/${A.byRole('manager', 0)._id}`).set(auth(tokens.manager)).send({ role: 'doctor', isActive: false, company: B.company._id });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, 'manager');
  });

  test('deactivated users cannot sign in and their sessions end', async () => {
    const created = await api.post('/api/users').set(auth(tokens.doctor)).send({ name: 'Temp Worker', email: 'temp@test.com', password: 'Passw0rd!' });
    const token = (await api.post('/api/auth/login').send({ email: 'temp@test.com', password: 'Passw0rd!' })).body.token;
    assert.equal((await api.patch(`/api/users/${A.byRole('doctor')._id}/status`).set(auth(tokens.doctor)).send({ isActive: false })).status, 400, 'no self-deactivation');
    const off = await api.patch(`/api/users/${created.body.data._id}/status`).set(auth(tokens.doctor)).send({ isActive: false });
    assert.equal(off.status, 200);
    assert.equal((await api.post('/api/auth/login').send({ email: 'temp@test.com', password: 'Passw0rd!' })).status, 401);
    assert.equal((await api.get('/api/auth/me').set(auth(token))).status, 401);
  });
});

describe('Activity log', () => {
  test('important actions are logged with who and what', async () => {
    const res = await api.get('/api/audit-logs?entity=FirstAidBox').set(auth(tokens.doctor));
    assert.equal(res.status, 200);
    const created = res.body.data.find((l) => l.action === 'Created first aid kit');
    assert.ok(created);
    assert.ok(created.userName && created.entityLabel && created.createdAt);
  });

  test('log entries cannot be modified', async () => {
    assert.equal((await api.delete('/api/audit-logs/123').set(auth(tokens.admin))).status, 404);
    await assert.rejects(() => AuditLog.updateMany({}, { action: 'tampered' }));
    await assert.rejects(() => AuditLog.deleteMany({}));
  });
});

describe('Reports', () => {
  test('reports are available as JSON, CSV and PDF', async () => {
    const json = await api.get('/api/reports/inventory').set(auth(tokens.doctor));
    assert.equal(json.status, 200);
    assert.ok(json.body.data.rows.length >= 2);
    const csv = await api.get('/api/reports/low-stock?format=csv').set(auth(tokens.doctor));
    assert.equal(csv.status, 200);
    assert.match(csv.headers['content-type'], /text\/csv/);
    assert.match(csv.text, /Kit,Location,Department,Item/);
    const pdf = await api.get('/api/reports/compliance?format=pdf').set(auth(tokens.manager)).buffer(true);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers['content-type'], /application\/pdf/);
    assert.equal((await api.get('/api/reports/activity').set(auth(tokens.manager))).status, 403);
    assert.equal((await api.get('/api/reports/inventory').set(auth(tokens.employee))).status, 403);
  });
});
