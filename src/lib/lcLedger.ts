import { LCDetails, LCLedgerEntry, LCShipmentItemUse, LCShipmentRecord } from '../types';
import { lcGoodsItems } from './documentGenerators';

/**
 * LC ledger: one LC number -> many shipments (commercial invoices).
 * Every shipment draws down the LC quantity and value; the balance is what
 * can still be shipped (within the 39A tolerance) before the LC is exhausted.
 */

export function normalizeLCNumber(lcNo: string): string {
  return (lcNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Parses SWIFT YYMMDD, ISO, and Indian dd/mm/yyyy, dd.mm.yyyy, dd-mm-yyyy, dd/mm/yy dates. */
export function parseTradeDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) return new Date(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(year, Number(m[2]) - 1, Number(m[1]));
  }
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export interface LCUtilization {
  currency: string;
  lcAmount: number;
  maxAmount: number; // amount incl. + tolerance
  lcQuantity: number | null;
  maxQuantity: number | null;
  quantityUom: string;
  shippedAmount: number;
  shippedQuantity: number;
  shipmentCount: number;
  balanceAmount: number; // against the face amount
  balanceAmountWithTolerance: number;
  balanceQuantity: number | null;
  balanceQuantityWithTolerance: number | null;
  utilizationPct: number;
  items: LCItemUtilization[]; // per 45A product, when the LC lists more than one
}

export interface LCItemUtilization {
  index: number;
  label: string; // first line of the product in 45A, e.g. "NE 30/1, 100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR"
  unitPrice: number;
  uom: string;
  lcQuantity: number;
  maxQuantity: number;
  shippedQuantity: number;
  shippedAmount: number;
  balanceQuantity: number;
  balanceQuantityWithTolerance: number;
}

export function computeLCUtilization(
  lc: LCDetails,
  shipments: LCShipmentRecord[],
  excludeInvoiceNo?: string
): LCUtilization {
  const counted = shipments.filter(s => !excludeInvoiceNo || s.invoiceNo !== excludeInvoiceNo);
  const plus = Number(lc.tolerancePercentage?.positive) || 0;
  const lcAmount = Number(lc.amount) || 0;
  const products = lcGoodsItems(lc);
  const productTotal = products.reduce((t, p) => t + p.quantity, 0);
  const lcQuantity = products.length > 1 && productTotal > 0
    ? round3(productTotal)
    : lc.goodsQuantity != null && Number(lc.goodsQuantity) > 0 ? Number(lc.goodsQuantity) : null;

  const shippedAmount = round2(counted.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const shippedQuantity = round3(counted.reduce((s, r) => s + (Number(r.quantity) || 0), 0));
  const maxAmount = round2(lcAmount * (1 + plus / 100));
  const maxQuantity = lcQuantity != null ? round3(lcQuantity * (1 + plus / 100)) : null;

  return {
    currency: lc.currency || 'USD',
    lcAmount,
    maxAmount,
    lcQuantity,
    maxQuantity,
    quantityUom: lc.goodsQuantityUom || '',
    shippedAmount,
    shippedQuantity,
    shipmentCount: counted.length,
    balanceAmount: round2(lcAmount - shippedAmount),
    balanceAmountWithTolerance: round2(maxAmount - shippedAmount),
    balanceQuantity: lcQuantity != null ? round3(lcQuantity - shippedQuantity) : null,
    balanceQuantityWithTolerance: maxQuantity != null ? round3(maxQuantity - shippedQuantity) : null,
    utilizationPct: lcAmount > 0 ? round2((shippedAmount / lcAmount) * 100) : 0,
    items: products.length > 1
      ? products.map((p, index) => {
        const uses = counted.flatMap(r => (r.items || []).filter(u => u.lcItemIndex === index));
        const shippedQ = round3(uses.reduce((t, u) => t + (Number(u.quantity) || 0), 0));
        const maxQ = round3(p.quantity * (1 + plus / 100));
        return {
          index,
          label: p.description.split('\n')[0],
          unitPrice: p.unitPrice,
          uom: p.uom,
          lcQuantity: p.quantity,
          maxQuantity: maxQ,
          shippedQuantity: shippedQ,
          shippedAmount: round2(uses.reduce((t, u) => t + (Number(u.amount) || 0), 0)),
          balanceQuantity: round3(p.quantity - shippedQ),
          balanceQuantityWithTolerance: round3(maxQ - shippedQ)
        };
      })
      : []
  };
}

export interface ShipmentCheck {
  errors: string[]; // would cause the bank to refuse the documents
  warnings: string[]; // needs a human look
}

/**
 * Validates one shipment (invoice) against the LC and the shipments already made under it.
 * Re-checking an invoice that is already in the ledger replaces its earlier figures.
 */
export function checkShipmentAgainstLC(
  lc: LCDetails,
  existing: LCShipmentRecord[],
  candidate: { invoiceNo: string; quantity: number; amount: number; shipmentDate?: string; items?: LCShipmentItemUse[] }
): ShipmentCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const u = computeLCUtilization(lc, existing, candidate.invoiceNo);
  const cur = u.currency;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (candidate.amount > u.balanceAmountWithTolerance + 0.005) {
    errors.push(
      `Invoice value ${cur} ${fmt(candidate.amount)} exceeds the LC balance ${cur} ${fmt(u.balanceAmountWithTolerance)} ` +
      `(LC ${cur} ${fmt(u.lcAmount)} + tolerance, already used ${cur} ${fmt(u.shippedAmount)}).`
    );
  }
  if (u.balanceQuantityWithTolerance != null && candidate.quantity > u.balanceQuantityWithTolerance + 0.0005) {
    errors.push(
      `Quantity ${candidate.quantity.toLocaleString('en-US')} ${u.quantityUom} exceeds the LC balance ` +
      `${u.balanceQuantityWithTolerance.toLocaleString('en-US')} ${u.quantityUom}.`
    );
  }

  // Several 45A products: each has its own quantity limit
  for (const use of candidate.items || []) {
    const it = u.items[use.lcItemIndex];
    if (it && use.quantity > it.balanceQuantityWithTolerance + 0.0005) {
      errors.push(
        `${it.label.replace(/[,\s]+$/, '')}: quantity ${use.quantity.toLocaleString('en-US')} ${it.uom} exceeds the balance for this product ` +
        `${it.balanceQuantityWithTolerance.toLocaleString('en-US')} ${it.uom} (LC ${it.lcQuantity.toLocaleString('en-US')} ${it.uom}).`
      );
    }
  }
  if (u.items.length > 1 && candidate.quantity > 0 && !(candidate.items || []).length) {
    warnings.push('The LC lists several products in 45A, but this invoice could not be matched to one of them. Check the description / yarn count.');
  }

  const partialNotAllowed = /NOT\s+ALLOWED|PROHIBITED/i.test(lc.partialShipment || '');
  if (partialNotAllowed) {
    if (u.shipmentCount > 0) {
      warnings.push(
        `LC field 43P says partial shipments NOT ALLOWED, but ${u.shipmentCount} shipment(s) already exist under this LC. ` +
        `Confirm an amendment or that the shipments qualify as one shipment (UCP 600 art. 31) before presenting.`
      );
    } else if (u.lcQuantity != null) {
      const minQty = u.lcQuantity * (1 - (Number(lc.tolerancePercentage?.negative) || 0) / 100);
      if (candidate.quantity < minQty) {
        warnings.push(
          `LC field 43P says partial shipments NOT ALLOWED, but this shipment (${candidate.quantity.toLocaleString('en-US')} ${u.quantityUom}) ` +
          `is below the LC quantity less tolerance (${round3(minQty).toLocaleString('en-US')} ${u.quantityUom}).`
        );
      }
    }
  }

  const shipDate = parseTradeDate(candidate.shipmentDate);
  const latest = parseTradeDate(lc.latestShipmentDate);
  const expiry = parseTradeDate(lc.expiryDate);
  if (shipDate && latest && shipDate > latest) {
    errors.push(`Shipment date ${candidate.shipmentDate} is after the LC latest shipment date ${lc.latestShipmentDate} (44C).`);
  }
  if (shipDate && expiry && shipDate > expiry) {
    errors.push(`Shipment date ${candidate.shipmentDate} is after the LC expiry ${lc.expiryDate} (31D).`);
  }
  if (!shipDate && expiry && new Date() > expiry) {
    errors.push(`LC expired on ${lc.expiryDate} (31D).`);
  }

  return { errors, warnings };
}

export function presentationDeadline(lc: LCDetails, shipmentDate?: string): Date | null {
  const ship = parseTradeDate(shipmentDate);
  if (!ship) return null;
  const days = lc.presentationPeriodDays || lc.periodForPresentationDays || 21;
  const deadline = new Date(ship.getTime() + days * 86400000);
  const expiry = parseTradeDate(lc.expiryDate);
  return expiry && expiry < deadline ? expiry : deadline;
}

export function upsertShipmentRecord(entry: LCLedgerEntry, record: LCShipmentRecord): LCLedgerEntry {
  const others = entry.shipments.filter(s => s.invoiceNo !== record.invoiceNo);
  return {
    ...entry,
    shipments: [...others, record].sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo)),
    updatedAt: new Date().toISOString()
  };
}

// ---- client API (server keeps the ledger in data/lc-ledger.json) ----

async function ledgerRequest<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  if (res.status === 404) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Ledger request failed (${res.status})`);
  }
  return json.data as T;
}

export function fetchLedgerEntry(lcNumber: string): Promise<LCLedgerEntry | null> {
  return ledgerRequest<LCLedgerEntry>(`/api/ledger/${encodeURIComponent(normalizeLCNumber(lcNumber))}`);
}

export function listLedgerEntries(): Promise<LCLedgerEntry[] | null> {
  return ledgerRequest<LCLedgerEntry[]>('/api/ledger');
}

export function saveLedgerLC(lcDetails: LCDetails, contractData?: unknown): Promise<LCLedgerEntry | null> {
  return ledgerRequest<LCLedgerEntry>(`/api/ledger/${encodeURIComponent(normalizeLCNumber(lcDetails.lcNumber))}`, {
    method: 'PUT',
    body: JSON.stringify({ lcDetails, contractData })
  });
}

export function recordLedgerShipment(lcNumber: string, record: LCShipmentRecord): Promise<LCLedgerEntry | null> {
  return ledgerRequest<LCLedgerEntry>(`/api/ledger/${encodeURIComponent(normalizeLCNumber(lcNumber))}/shipments`, {
    method: 'POST',
    body: JSON.stringify(record)
  });
}

export function deleteLedgerShipment(lcNumber: string, invoiceNo: string): Promise<LCLedgerEntry | null> {
  return ledgerRequest<LCLedgerEntry>(
    `/api/ledger/${encodeURIComponent(normalizeLCNumber(lcNumber))}/shipments?invoiceNo=${encodeURIComponent(invoiceNo)}`,
    { method: 'DELETE' }
  );
}
