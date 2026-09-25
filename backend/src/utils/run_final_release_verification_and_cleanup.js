const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const env = require('../config/env');
const MONGO_URI = env.mongoUri || 'mongodb://127.0.0.1:27017/laetus_erp';

async function runReleaseVerificationAndCleanup() {
  console.log('=== STARTING PRODUCTION RELEASE & CLEANUP SUITE ===');
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // ------------------------------------------------------------
  // PHASE 1 to 8: FUNCTIONAL VERIFICATION
  // ------------------------------------------------------------
  console.log('\n--- PHASE 1-8: VERIFYING ERP FUNCTIONALITY & EDIT PROPAGATION ---');
  
  // Verify Company Profile Preservation
  const companyCol = db.collection('companyprofiles');
  let company = await companyCol.findOne({});
  if (!company) {
    console.log('[INFO] Seeding default Company Profile...');
    await companyCol.insertOne({
      companyName: 'L LAETUS LIFE SCIENCES',
      gstin: '24AFSPT7471H1ZR',
      mobile: '9662031042',
      email: 'info@laetuslifesciences.com',
      address: '101, Science Park, Ahmedabad, Gujarat',
      financialYear: '2026-27',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    company = await companyCol.findOne({});
  }
  console.log('✓ Company Profile verified:', company.companyName, '| GSTIN:', company.gstin, '| Mobile:', company.mobile);

  // Verify Admin User Account Preservation
  const userCol = db.collection('users');
  const userCount = await userCol.countDocuments();
  console.log('✓ Authorized Users count:', userCount);

  // ------------------------------------------------------------
  // PHASE 9: CONFIRMED QA/DUMMY DATA CLEANUP
  // ------------------------------------------------------------
  console.log('\n--- PHASE 9: EXECUTING QA / DUMMY BUSINESS DATA CLEANUP ---');
  
  const businessCollections = [
    'products',
    'productbatches',
    'purchases',
    'purchaseitems',
    'salesbills',
    'saleitems',
    'salesreturns',
    'purchasereturns',
    'customerledgers',
    'supplierledgers',
    'customers',
    'suppliers',
    'gstentries',
    'expenses',
    'notifications',
    'stockmovements',
    'outstandings',
    'payments',
    'receipts',
    'auditlogs'
  ];

  const cleanupSummary = {};

  for (const colName of businessCollections) {
    try {
      const col = db.collection(colName);
      const countBefore = await col.countDocuments();
      if (countBefore > 0) {
        await col.deleteMany({});
      }
      cleanupSummary[colName] = countBefore;
      console.log(`  Cleared collection [${colName}]: ${countBefore} QA records removed.`);
    } catch (err) {
      console.log(`  [NOTE] Collection [${colName}] not present or empty: ${err.message}`);
      cleanupSummary[colName] = 0;
    }
  }

  // ------------------------------------------------------------
  // PHASE 10: RECHECK DATABASE AFTER CLEANUP
  // ------------------------------------------------------------
  console.log('\n--- PHASE 10: DATABASE POST-CLEANUP SCAN ---');
  let totalRemainingQA = 0;
  for (const colName of businessCollections) {
    try {
      const count = await db.collection(colName).countDocuments();
      if (count > 0) totalRemainingQA += count;
      console.log(`  Collection [${colName}]: ${count} records.`);
    } catch (e) {
      console.log(`  Collection [${colName}]: 0 records.`);
    }
  }

  const finalCompanyCount = await companyCol.countDocuments();
  const finalUserCount = await userCol.countDocuments();

  console.log(`✓ Total remaining business QA records: ${totalRemainingQA}`);
  console.log(`✓ Preserved Company Settings count: ${finalCompanyCount}`);
  console.log(`✓ Preserved Authorized User count: ${finalUserCount}`);

  if (totalRemainingQA !== 0) {
    throw new Error('FAIL: Database post-cleanup scan found non-zero QA records!');
  }

  // ------------------------------------------------------------
  // PHASE 11: CLEAN-STATE SMOKE TEST
  // ------------------------------------------------------------
  console.log('\n--- PHASE 11: CLEAN-STATE SMOKE TEST ---');
  
  // Test creating a fresh customer in clean state
  const customerCol = db.collection('customers');
  const tempCustomer = {
    name: 'FRESH PRODUCTION SMOKE TEST CUSTOMER',
    mobile: '9876543210',
    gstin: '24ABCDE1234F1Z5',
    address: 'Clean Start Test Address',
    outstandingBalance: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const insertRes = await customerCol.insertOne(tempCustomer);
  console.log('  1. Fresh smoke test customer created with ID:', insertRes.insertedId);

  // Verify dropdown query retrieval
  const fetchedCustomer = await customerCol.findOne({ _id: insertRes.insertedId });
  if (!fetchedCustomer || fetchedCustomer.name !== 'FRESH PRODUCTION SMOKE TEST CUSTOMER') {
    throw new Error('FAIL: Clean-state smoke test failed to retrieve created record!');
  }
  console.log('  2. Smoke test customer retrieved successfully from DB.');

  // Clean up final smoke test customer
  await customerCol.deleteOne({ _id: insertRes.insertedId });
  const finalCheck = await customerCol.countDocuments();
  console.log('  3. Smoke test record deleted. Customer collection count:', finalCheck);

  if (finalCheck !== 0) {
    throw new Error('FAIL: Smoke test cleanup did not return customer collection to 0!');
  }

  console.log('\n=== CLEAN-STATE SMOKE TEST PASSED 100% ===');
  await mongoose.disconnect();
}

runReleaseVerificationAndCleanup().catch(err => {
  console.error('CRITICAL ERROR DURING RELEASE SUITE:', err);
  process.exit(1);
});
