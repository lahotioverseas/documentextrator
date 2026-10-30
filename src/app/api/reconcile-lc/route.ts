import { aiRoute } from '@/server/http';
import { reconcileLC } from '@/server/extractors/reconcileLC';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = aiRoute('reconcile-lc', 'Reconciliation failed', reconcileLC);
