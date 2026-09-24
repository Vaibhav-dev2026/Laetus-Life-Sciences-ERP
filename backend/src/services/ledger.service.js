const { CustomerLedger, SupplierLedger, Customer, Supplier } = require('../models');
const { round2 } = require('../utils/money');

// Ledgers are append-only. Each post reads the party's last running balance,
// applies debit/credit, and writes the new balance forward — so historical
// rows are never mutated and the closing balance is always the sum of a
// traceable, ordered sequence of entries.
//
// We sort by `_id: -1` (or `_id: 1` ascending) because MongoDB ObjectIds
// are guaranteed to be monotonically increasing in insertion order even
// within the same millisecond inside a transaction.

async function lastCustomerEntry(partyId, session) {
  const query = CustomerLedger.findOne({ partyId }).sort({ _id: -1 });
  if (session) query.session(session);
  return query;
}

async function lastCustomerBalance(partyId, session) {
  const last = await lastCustomerEntry(partyId, session);
  if (last) return last.balance;
  const custQuery = Customer.findOne({ id: partyId });
  if (session) custQuery.session(session);
  const customer = await custQuery;
  return customer ? round2(customer.openingOutstanding || 0) : 0;
}

async function postCustomerEntry({ partyId, date, type, refId, refNo, debit = 0, credit = 0, session }) {
  const last = await lastCustomerEntry(partyId, session);
  const prevBalance = last ? last.balance : await (async () => {
    const custQuery = Customer.findOne({ id: partyId });
    if (session) custQuery.session(session);
    const customer = await custQuery;
    return customer ? round2(customer.openingOutstanding || 0) : 0;
  })();
  const balance = round2(prevBalance + debit - credit);
  const opts = session ? { session } : {};
  const [entry] = await CustomerLedger.create([{ partyId, date, type, refId, refNo, debit, credit, balance }], opts);
  return entry;
}

async function lastSupplierEntry(partyId, session) {
  const query = SupplierLedger.findOne({ partyId }).sort({ _id: -1 });
  if (session) query.session(session);
  return query;
}

async function lastSupplierBalance(partyId, session) {
  const last = await lastSupplierEntry(partyId, session);
  if (last) return last.balance;
  const suppQuery = Supplier.findOne({ id: partyId });
  if (session) suppQuery.session(session);
  const supplier = await suppQuery;
  return supplier ? round2(supplier.openingPayable || 0) : 0;
}

async function postSupplierEntry({ partyId, date, type, refId, refNo, debit = 0, credit = 0, session }) {
  const last = await lastSupplierEntry(partyId, session);
  const prevBalance = last ? last.balance : await (async () => {
    const suppQuery = Supplier.findOne({ id: partyId });
    if (session) suppQuery.session(session);
    const supplier = await suppQuery;
    return supplier ? round2(supplier.openingPayable || 0) : 0;
  })();
  const balance = round2(prevBalance + credit - debit);
  const opts = session ? { session } : {};
  const [entry] = await SupplierLedger.create([{ partyId, date, type, refId, refNo, debit, credit, balance }], opts);
  return entry;
}

module.exports = { postCustomerEntry, postSupplierEntry, lastCustomerBalance, lastSupplierBalance };
