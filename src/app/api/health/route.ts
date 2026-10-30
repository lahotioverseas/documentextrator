import { NextResponse } from 'next/server';
import { CANDIDATE_MODELS, getConfiguredApiKeys, keyStatuses } from '@/server/gemini/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    configuredKeysCount: getConfiguredApiKeys().length,
    keys: keyStatuses(),
    models: CANDIDATE_MODELS
  });
}
