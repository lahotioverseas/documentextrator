// Shared wrappers for the API route handlers.
import 'server-only';
import { NextResponse } from 'next/server';
import { formatApiError, isKeyExhaustionError } from './gemini/client';
import { getLedgerStore, LedgerStore } from './ledger/store';

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** POST handler for an AI extraction: { success, data } or the formatted Gemini error. */
export function aiRoute(name: string, fallbackMessage: string, run: (body: any) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const data = await run(await readJson(req));
      return NextResponse.json({ success: true, data });
    } catch (error: any) {
      console.error(`Error in /api/${name}:`, error);
      return NextResponse.json(formatApiError(error, fallbackMessage), {
        status: isKeyExhaustionError(error?.message || '') ? 429 : 500
      });
    }
  };
}

export const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

export function normalizeLCKey(lcNo: string): string {
  return String(lcNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** LC ledger handler: 503 when the database is unreachable, 500 on a storage error. */
export function ledgerRoute<C>(run: (store: LedgerStore, req: Request, body: any, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    let store: LedgerStore;
    try {
      store = await getLedgerStore();
    } catch (err: any) {
      // Don't fall back to the local file: LC balances would split between two stores
      console.error('LC ledger: cannot connect to MongoDB (check MONGODB_URI and Atlas network access):', err?.message || err);
      return fail(503, 'LC ledger database is not reachable. Check MONGODB_URI and restart the server.');
    }
    try {
      const body = req.method === 'PUT' || req.method === 'POST' ? await readJson(req) : undefined;
      return await run(store, req, body, ctx);
    } catch (err: any) {
      console.error(`LC ledger ${req.method} ${new URL(req.url).pathname} failed:`, err);
      return fail(500, 'LC ledger storage error: ' + (err?.message || 'unknown'));
    }
  };
}
