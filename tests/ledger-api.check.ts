// Exercises the LC ledger HTTP API on a running server: npx tsx tests/ledger-api.check.ts
import { lc } from './fixtures/lol0138';
import { computeLCUtilization } from '../src/lib/lcLedger';

const base = process.env.BASE_URL || 'http://localhost:3000';
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json() };
};
const ship = (invoiceNo: string, quantity: number, amount: number) =>
  ({ invoiceNo, invoiceDate: '11/06/2026', quantity, quantityUom: 'YARDS', amount, status: 'shipped', transportDocNo: '26554', transportDocDate: '20/06/2026' });

const lcKey = encodeURIComponent('033026020021');
console.log('lookup before upload ->', (await call('GET', `/api/ledger/${lcKey}`)).status);
console.log('register LC ->', (await call('PUT', `/api/ledger/${lcKey}`, { lcDetails: lc })).status);
await call('POST', `/api/ledger/${lcKey}/shipments`, ship('LOL/0138/26-27', 21210.57, 21422.68));
await call('POST', `/api/ledger/${lcKey}/shipments`, ship('LOL/0138/26-27', 21210.57, 21422.68)); // re-save: no double count
const second = await call('POST', `/api/ledger/${lcKey}/shipments`, ship('LOL/0149/26-27', 50000, 50500));
let u = computeLCUtilization(second.json.data.lcDetails, second.json.data.shipments);
console.log('after 2 invoices -> count', u.shipmentCount, 'shipped', u.shippedAmount, 'balance', u.balanceAmount, 'balance qty', u.balanceQuantity);

// Re-uploading the LC (e.g. after an amendment) keeps the shipments
const amended = await call('PUT', `/api/ledger/${lcKey}`, { lcDetails: { ...lc, amount: 200000 } });
u = computeLCUtilization(amended.json.data.lcDetails, amended.json.data.shipments);
console.log('after amendment -> count', u.shipmentCount, 'balance', u.balanceAmount);

// Typing the LC number with spaces / dashes finds the same LC
console.log('lookup "0330 2602-0021" ->', (await call('GET', `/api/ledger/${encodeURIComponent('0330 2602-0021')}`)).json.data?.lcNumber);

// Same invoice under a different LC is refused
await call('PUT', '/api/ledger/999', { lcDetails: { ...lc, lcNumber: '999' } });
const clash = await call('POST', '/api/ledger/999/shipments', ship('LOL/0138/26-27', 1, 1));
console.log('duplicate invoice on other LC ->', clash.status, clash.json.error);

const del = await call('DELETE', `/api/ledger/${lcKey}/shipments?invoiceNo=${encodeURIComponent('LOL/0149/26-27')}`);
console.log('after delete -> count', del.json.data.shipments.length);
