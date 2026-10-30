import { aiRoute } from '@/server/http';
import { extractPreShipment } from '@/server/extractors/preShipment';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = aiRoute('extract-preshipment', 'Pre-shipment invoice extraction failed', extractPreShipment);
