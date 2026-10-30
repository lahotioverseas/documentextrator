import { aiRoute } from '@/server/http';
import { classifyClauses } from '@/server/extractors/classifyClauses';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = aiRoute('classify-clauses', 'Clause classification failed', classifyClauses);
