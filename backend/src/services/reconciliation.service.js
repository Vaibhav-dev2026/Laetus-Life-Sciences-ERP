const { Sale, Purchase, Payment, Customer, Supplier } = require('../models');
const { round2 } = require('../utils/money');

/**
 * Reconcile a single customer's payments and sales idempotently.
 * Applies payments in chronological order:
 *  - Priority invoice if specified in payment.invoiceId
 *  - FIFO across oldest debts (opening balance if present, then open sales)
 * Updates Sale.amountReceived, Sale.balance, Sale.paymentStatus
 * Updates Payment.allocations, Payment.isAllocated
 */
async function reconcileCustomer(customerId, session = null) {
  const opts = session ? { session } : {};

  const customer = await Customer.findOne({ id: customerId }, null, opts);
  if (!customer) return { customerId, updatedSales: 0, updatedPayments: 0 };

  const sales = await Sale.find({ customerId, status: 'Active' }, null, opts).sort({ date: 1, _id: 1 });
  const payments = await Payment.find({ partyId: customerId, partyType: 'Customer' }, null, opts).sort({ date: 1, _id: 1 });

  let openingDebt = round2(customer.openingOutstanding || 0);

  // Initialize fresh tracking state for each active sale
  const saleState = new Map();
  for (const s of sales) {
    saleState.set(s.id, {
      sale: s,
      grandTotal: s.grandTotal,
      amountReceived: 0,
      balance: s.grandTotal,
    });
  }

  let updatedPayments = 0;

  for (const payment of payments) {
    let paymentRemaining = round2(payment.amount);
    const allocations = [];

    // 1. If explicit invoice was requested, apply to it first
    if (payment.invoiceId) {
      // Support matching by internal ID (INV-...) or display invoiceNo (LLS/...)
      const target = Array.from(saleState.values()).find(
        (st) => st.sale.id === payment.invoiceId || st.sale.invoiceNo === payment.invoiceId
      );

      if (target && target.balance > 0.009) {
        const apply = Math.min(paymentRemaining, target.balance);
        if (apply > 0.009) {
          target.amountReceived = round2(target.amountReceived + apply);
          target.balance = round2(target.grandTotal - target.amountReceived);
          paymentRemaining = round2(paymentRemaining - apply);
          allocations.push({
            invoiceId: target.sale.id,
            invoiceNo: target.sale.invoiceNo,
            appliedAmount: apply,
          });
        }
      }
    }

    // 2. FIFO: Settle opening balance first (if general receipt without specific invoice)
    if (!payment.invoiceId && openingDebt > 0.009 && paymentRemaining > 0.009) {
      const applyToOpening = Math.min(paymentRemaining, openingDebt);
      if (applyToOpening > 0.009) {
        openingDebt = round2(openingDebt - applyToOpening);
        paymentRemaining = round2(paymentRemaining - applyToOpening);
        allocations.push({
          invoiceId: 'OPENING',
          invoiceNo: 'OPENING',
          appliedAmount: applyToOpening,
        });
      }
    }

    // 3. FIFO across open sales (oldest date/ID first)
    if (paymentRemaining > 0.009) {
      for (const st of saleState.values()) {
        if (paymentRemaining <= 0.009) break;
        if (st.balance <= 0.009) continue;

        const apply = Math.min(paymentRemaining, st.balance);
        if (apply <= 0.009) continue;

        st.amountReceived = round2(st.amountReceived + apply);
        st.balance = round2(st.grandTotal - st.amountReceived);
        paymentRemaining = round2(paymentRemaining - apply);
        allocations.push({
          invoiceId: st.sale.id,
          invoiceNo: st.sale.invoiceNo,
          appliedAmount: apply,
        });
      }
    }

    // Persist allocation details on payment document
    payment.allocations = allocations;
    payment.isAllocated = true;
    await payment.save(opts);
    updatedPayments += 1;
  }

  // Persist final reconciled state on all sales
  let updatedSales = 0;
  for (const st of saleState.values()) {
    const s = st.sale;
    s.amountReceived = st.amountReceived;
    s.balance = st.balance;
    s.paymentStatus = st.balance <= 0.009 ? 'Paid' : (st.amountReceived > 0 ? 'Partial' : 'Unpaid');
    await s.save(opts);
    updatedSales += 1;
  }

  return { customerId, updatedSales, updatedPayments };
}

/**
 * Reconcile a single supplier's payments and purchases idempotently.
 */
async function reconcileSupplier(supplierId, session = null) {
  const opts = session ? { session } : {};

  const supplier = await Supplier.findOne({ id: supplierId }, null, opts);
  if (!supplier) return { supplierId, updatedPurchases: 0, updatedPayments: 0 };

  const purchases = await Purchase.find({ supplierId, status: 'Active' }, null, opts).sort({ purchaseDate: 1, _id: 1 });
  const payments = await Payment.find({ partyId: supplierId, partyType: 'Supplier' }, null, opts).sort({ date: 1, _id: 1 });

  let openingDebt = round2(supplier.openingPayable || 0);

  const purchaseState = new Map();
  for (const p of purchases) {
    purchaseState.set(p.id, {
      purchase: p,
      grandTotal: p.grandTotal,
      amountPaid: 0,
      balance: p.grandTotal,
    });
  }

  let updatedPayments = 0;

  for (const payment of payments) {
    let paymentRemaining = round2(payment.amount);
    const allocations = [];

    // 1. Priority invoice if specified
    if (payment.invoiceId) {
      const target = Array.from(purchaseState.values()).find(
        (st) => st.purchase.id === payment.invoiceId ||
                st.purchase.purchaseInvoiceNo === payment.invoiceId ||
                st.purchase.supplierInvoiceNo === payment.invoiceId
      );

      if (target && target.balance > 0.009) {
        const apply = Math.min(paymentRemaining, target.balance);
        if (apply > 0.009) {
          target.amountPaid = round2(target.amountPaid + apply);
          target.balance = round2(target.grandTotal - target.amountPaid);
          paymentRemaining = round2(paymentRemaining - apply);
          allocations.push({
            invoiceId: target.purchase.id,
            invoiceNo: target.purchase.purchaseInvoiceNo,
            appliedAmount: apply,
          });
        }
      }
    }

    // 2. FIFO: Settle opening payable first (if general payment)
    if (!payment.invoiceId && openingDebt > 0.009 && paymentRemaining > 0.009) {
      const applyToOpening = Math.min(paymentRemaining, openingDebt);
      if (applyToOpening > 0.009) {
        openingDebt = round2(openingDebt - applyToOpening);
        paymentRemaining = round2(paymentRemaining - applyToOpening);
        allocations.push({
          invoiceId: 'OPENING',
          invoiceNo: 'OPENING',
          appliedAmount: applyToOpening,
        });
      }
    }

    // 3. FIFO across open purchases
    if (paymentRemaining > 0.009) {
      for (const st of purchaseState.values()) {
        if (paymentRemaining <= 0.009) break;
        if (st.balance <= 0.009) continue;

        const apply = Math.min(paymentRemaining, st.balance);
        if (apply <= 0.009) continue;

        st.amountPaid = round2(st.amountPaid + apply);
        st.balance = round2(st.grandTotal - st.amountPaid);
        paymentRemaining = round2(paymentRemaining - apply);
        allocations.push({
          invoiceId: st.purchase.id,
          invoiceNo: st.purchase.purchaseInvoiceNo,
          appliedAmount: apply,
        });
      }
    }

    payment.allocations = allocations;
    payment.isAllocated = true;
    await payment.save(opts);
    updatedPayments += 1;
  }

  let updatedPurchases = 0;
  for (const st of purchaseState.values()) {
    const p = st.purchase;
    p.amountPaid = st.amountPaid;
    p.balance = st.balance;
    p.paymentStatus = st.balance <= 0.009 ? 'Paid' : (st.amountPaid > 0 ? 'Partial' : 'Unpaid');
    await p.save(opts);
    updatedPurchases += 1;
  }

  return { supplierId, updatedPurchases, updatedPayments };
}

/**
 * Reconcile all customers and suppliers across the system.
 * Completely idempotent and safe to run on startup or on demand.
 */
async function reconcileAllFinancialAllocations() {
  const [customerPayments, salesCusts] = await Promise.all([
    Payment.distinct('partyId', { partyType: 'Customer' }),
    Sale.distinct('customerId', { status: 'Active' }),
  ]);
  const allCustIds = Array.from(new Set([...customerPayments, ...salesCusts]));

  let totalCustReconciled = 0;
  for (const cid of allCustIds) {
    if (cid) {
      await reconcileCustomer(cid);
      totalCustReconciled += 1;
    }
  }

  const [supplierPayments, purchaseSupps] = await Promise.all([
    Payment.distinct('partyId', { partyType: 'Supplier' }),
    Purchase.distinct('supplierId', { status: 'Active' }),
  ]);
  const allSuppIds = Array.from(new Set([...supplierPayments, ...purchaseSupps]));

  let totalSuppReconciled = 0;
  for (const sid of allSuppIds) {
    if (sid) {
      await reconcileSupplier(sid);
      totalSuppReconciled += 1;
    }
  }

  return {
    reconciledCustomers: totalCustReconciled,
    reconciledSuppliers: totalSuppReconciled,
  };
}

module.exports = {
  reconcileCustomer,
  reconcileSupplier,
  reconcileAllFinancialAllocations,
};
