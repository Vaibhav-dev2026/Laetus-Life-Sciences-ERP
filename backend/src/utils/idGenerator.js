const Counter = require('../models/Counter');

// Atomic, zero-padded sequential IDs: CUST-000001, SUPP-000001, PRD-000001, BAT-000001 ...
// Uses atomic $inc/upsert pattern and optional model verification to ensure sequence
// numbers never collide with pre-existing or seeded records.
async function nextSequence(key, session) {
  const options = { new: true, upsert: true };
  if (session) options.session = session;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    options
  );
  return counter.value;
}

async function generateId(prefix, key, padLength = 6, session, model) {
  let seq = await nextSequence(key, session);
  let id = `${prefix}-${String(seq).padStart(padLength, '0')}`;

  if (model) {
    let query = model.findOne({ id });
    if (session) query = query.session(session);
    let exists = await query;
    while (exists) {
      seq = await nextSequence(key, session);
      id = `${prefix}-${String(seq).padStart(padLength, '0')}`;
      let q = model.findOne({ id });
      if (session) q = q.session(session);
      exists = await q;
    }
  }

  return id;
}

module.exports = { generateId, nextSequence };
