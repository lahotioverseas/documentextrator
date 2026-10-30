// One LC, keyed by normalized LC number
import { NextResponse } from 'next/server';
import { fail, ledgerRoute, normalizeLCKey } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ lcNo: string }> };

export const GET = ledgerRoute<Ctx>(async (store, _req, _body, { params }) => {
  const entry = await store.get(normalizeLCKey((await params).lcNo));
  if (!entry) return fail(404, 'LC not found in ledger');
  return NextResponse.json({ success: true, data: entry });
});

// Create or refresh the LC (e.g. after re-upload or amendment); shipments are kept.
export const PUT = ledgerRoute<Ctx>(async (store, _req, body, { params }) => {
  const { lcDetails, contractData } = body || {};
  const key = normalizeLCKey((await params).lcNo);
  if (!key || !lcDetails || normalizeLCKey(lcDetails.lcNumber) !== key) {
    return fail(400, 'lcDetails.lcNumber must match the URL LC number');
  }
  return NextResponse.json({ success: true, data: await store.upsertLC(key, lcDetails, contractData) });
});
