// LC ledger: every LC with its shipments (storage: src/server/ledger/store.ts)
import { NextResponse } from 'next/server';
import { ledgerRoute } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = ledgerRoute(async store => NextResponse.json({ success: true, data: await store.list() }));
