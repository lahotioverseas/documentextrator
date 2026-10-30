import { aiRoute } from '@/server/http';
import { extractLC } from '@/server/extractors/lc';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = aiRoute('extract-lc', 'LC extraction failed', extractLC);
