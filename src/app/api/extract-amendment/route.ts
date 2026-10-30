import { aiRoute } from '@/server/http';
import { extractAmendment } from '@/server/extractors/amendment';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = aiRoute('extract-amendment', 'Amendment extraction failed', extractAmendment);
