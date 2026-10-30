// Checks the MongoDB LC ledger store against a throwaway database, then drops it.
// Run: npx tsx tests/ledger-store.mongo.check.ts   (needs MONGODB_URI in .env)
import 'dotenv/config';
import { lc } from './fixtures/lol0138';
import { createLedgerStore } from '../src/server/ledger/store';
import { computeLCUtilization } from '../src/lib/lcLedger';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set');
const testDb = 'lahoti_export_docs_check';
process.env.MONGODB_DB = testDb;

let failed = 0;
const check = (label: string, ok: boolean, detail: unknown = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' -> ' + JSON.stringify(detail)}`);
  if (!ok) failed++;
};
const ship = (invoiceNo: string, quantity: number, amount: number) =>
  ({ invoiceNo, invoiceDate: '11/06/2026', quantity, quantityUom: 'YARDS', amount, status: 'shipped' });

const store = await createLedgerStore();
try {
  check('uses MongoDB', store.kind === 'mongodb', store.kind);
  const imported = await store.list(); // whatever data/lc-ledger.json held, copied in at startup
  const key = 'CHECKLC0001';
  const testLc = { ...lc, lcNumber: key };
  check('unknown LC -> null', (await store.get(key)) === null);
  await store.upsertLC(key, testLc, { contractNo: 'S/0403/25-26' });
  await store.putShipment(key, ship('LOL/0138/26-27', 21210.57, 21422.68));
  await store.putShipment(key, ship('LOL/0138/26-27', 21210.57, 21422.68));
  let e = await store.putShipment(key, ship('LOL/0149/26-27', 50000, 50500));
  let u = computeLCUtilization(e.lcDetails, e.shipments);
  check('two invoices, re-save not double counted', u.shipmentCount === 2 && Math.abs(u.balanceAmount - 102807.32) < 0.01, u);
  check('shipments sorted by invoice', e.shipments.map((s: any) => s.invoiceNo).join() === 'LOL/0138/26-27,LOL/0149/26-27');

  e = await store.upsertLC(key, { ...testLc, amount: 200000 }, undefined);
  check('LC refresh keeps shipments and contract', e.shipments.length === 2 && e.contractData?.contractNo === 'S/0403/25-26' && e.lcDetails.amount === 200000, e);

  await store.upsertLC('999', { ...lc, lcNumber: '999' }, undefined);
  check('invoice owner found on another LC', (await store.findInvoiceOwner('LOL/0138/26-27', '999'))?.lcNumber === key);
  check('own LC is not a clash', (await store.findInvoiceOwner('LOL/0138/26-27', key)) === null);

  e = await store.removeShipment(key, 'LOL/0149/26-27');
  check('delete shipment', e.shipments.length === 1);
  check('list returns both LCs', (await store.list()).length === imported.length + 2);
  check('missing LC -> putShipment null', (await store.putShipment('NOPE', ship('X', 1, 1))) === null);
} finally {
  const client = new MongoClient(uri);
  await client.connect();
  await client.db(testDb).dropDatabase();
  await client.close();
}
console.log(failed ? `\n${failed} failed` : '\nall MongoDB ledger checks passed');
process.exit(failed ? 1 : 0);
