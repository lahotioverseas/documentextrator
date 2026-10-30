import { aiRoute } from '@/server/http';
import { extractContract } from '@/server/extractors/contract';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = aiRoute('extract-contract', 'Contract extraction failed', extractContract);
