// Shipments (invoices) drawn under one LC
import { NextResponse } from 'next/server';
import { fail, ledgerRoute, normalizeLCKey } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ lcNo: string }> };

// Add or replace one shipment (invoice). An invoice number may belong to only one LC.
export const POST = ledgerRoute<Ctx>(async (store, _req, body, { params }) => {
  const key = normalizeLCKey((await params).lcNo);
  const record = body || {};
  if (!record.invoiceNo) return fail(400, 'invoiceNo is required');
  if (!(await store.get(key))) return fail(404, 'LC not found in ledger');
  const clash = await store.findInvoiceOwner(record.invoiceNo, key);
  if (clash) return fail(409, `Invoice ${record.invoiceNo} is already recorded under LC ${clash.lcNumber}`);
  const entry = await store.putShipment(key, record);
  if (!entry) return fail(404, 'LC not found in ledger');
  return NextResponse.json({ success: true, data: entry });
});

export const DELETE = ledgerRoute<Ctx>(async (store, req, _body, { params }) => {
  const invoiceNo = new URL(req.url).searchParams.get('invoiceNo') || '';
  const entry = await store.removeShipment(normalizeLCKey((await params).lcNo), invoiceNo);
  if (!entry) return fail(404, 'LC not found in ledger');
  return NextResponse.json({ success: true, data: entry });
});
