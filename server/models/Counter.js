const mongoose = require('mongoose');

/**
 * Atomic sequence counters used for human-readable IDs (INC-2026-0001, ...).
 * Replaces the previous `countDocuments() + 1` approach, which produced duplicate
 * IDs under concurrent requests and after deletions.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { versionKey: false });

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Return the next value of a sequence.
 * @param {string} key - counter key, e.g. `incident:<companyId>:2026`
 * @param {() => Promise<number>} [initialValue] - computes the starting value the
 *        first time a counter is used (so existing records are never duplicated).
 */
Counter.next = async (key, initialValue) => {
  const exists = await Counter.exists({ _id: key });
  if (!exists) {
    const base = initialValue ? await initialValue() : 0;
    try {
      await Counter.updateOne({ _id: key }, { $setOnInsert: { seq: base } }, { upsert: true });
    } catch (err) {
      if (err.code !== 11000) throw err; // another request initialised it first
    }
  }
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
  return doc.seq;
};

/**
 * Generate the next yearly sequential ID such as `INC-2026-0007` for a model.
 * Initialises from the highest existing ID for that prefix/year.
 */
Counter.nextYearlyId = async ({ prefix, model, field, companyId }) => {
  const year = new Date().getFullYear();
  const key = `${prefix}:${companyId || 'global'}:${year}`;
  const seq = await Counter.next(key, async () => {
    const Model = mongoose.model(model);
    const filter = { [field]: { $regex: `^${prefix}-${year}-\\d+$` } };
    if (companyId) filter.company = companyId;
    const docs = await Model.find(filter).select(field).lean();
    return docs.reduce((max, d) => {
      const n = parseInt(String(d[field]).split('-')[2], 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
  });
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
};

module.exports = Counter;
