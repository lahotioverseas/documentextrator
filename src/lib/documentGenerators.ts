import {
  SaleContractData,
  ExportData,
  LCDetails,
  LCAmendment,
  FinalDocumentSet,
  ComplianceChecklist,
  BankProfile,
  LCClause,
  AppliedClauseTrace,
  BeneficiaryCertFinal,
  ExporterParty,
  ExportLineItem,
  PreShipmentInvoiceData,
  ShipmentTransportDetails,
  PreShipmentItem,
  BillOfLadingFinal,
  ContractLineItem
} from '../types';
import { sampleBankProfiles } from '../data/samplePresets';
import { inferPackageKind } from './packageConstants';
import { parseTradeDate, presentationDeadline } from './lcLedger';

export function cleanPackingText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bIN\s+IN\b/gi, 'IN')
    .replace(/\bPACKING\s+IN\s+IN\b/gi, 'PACKING IN')
    .replace(/\bPACKING\s+PACKING\b/gi, 'PACKING')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips out OCR/SWIFT table column header artifacts and row number prefixes from Field 45A,
 * returning the clean, verbatim product description (e.g. fiber composition, yarn details, specifications, brand, trade terms).
 */
export function cleanGoodsDescriptionVerbatim(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.trim();

  // Strip table column header strings from OCR / SWIFT MT700 45A
  cleaned = cleaned.replace(/(?:Pos\.?\s*(?:No\.?)?|os\.?\s*)?Sales\s*contract\s*(?:No\.?)?\s*Specification\s*Quantity\s*(?:in\s*k[ge])?\s*Price\s*(?:\/\s*k[ge])?\s*(?:in\s*USD)?\s*total\s*Amount(?:\s*mount)?\s*(?:in\s*USDt?)?,?/gi, '');
  cleaned = cleaned.replace(/Pos\.\s*No\.?\s*Sales\s*Contract\s*No\.?\s*Description\s*of\s*Goods\s*Quantity\s*Rate\s*Amount/gi, '');
  cleaned = cleaned.replace(/Pos\.\s*\d+\s*Sales\s*contract\s*No\.?\s*[\w\/-]+\s*Specification\s*:\s*/gi, '');

  // Strip leading table row markers
  cleaned = cleaned.replace(/^\s*\d+\.\s+[A-Z0-9\/-]+\s+(?:(?:Ne|NE)\s+\d+(?:\/\d+)?\s+)?[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+/gim, '');
  cleaned = cleaned.replace(/Quantity\s+in\s+kg\s*:\s*[\d.,]+\s+Price\/kg\s+in\s+USD\s*:\s*[\d.,]+\s+total\s+Amount\s+in\s+USD\s*:\s*[\d.,]+/gi, '');

  // Strip 46A / 47A document requirement blocks if they were concatenated onto Field 45A
  const docReqMatch = cleaned.match(/(?:\n|^)\s*(?:SIGNED\s+COMMERCIAL\s+INVOICE|FULL\s+SET\s+PLUS|TRUCK\s+RECEIPT|BENEFICIARY['’]?S?\s+CERTIFICATE|INSURANCE\s+AT\s+BUYER|ONE\s+COMPLETE\s+SET|OUR\s+L\/C\s+NUMBER|COUNTRY\s+OF\s+ORIGIN\s+TO\s+BE\s+MENTIONED|ALL\s+DOCUMENTS\s+TO\s+BE\s+PREPARED|BENEFICIARY\s+MUST\s+SEND|ALL\s+DOCUMENTS\s+SHOULD\s+BE\s+SIGNED|FOB\s+VALUE\s+AND\s+FREIGHT|THIS\s+L\/C\s+IS\s+OPENED\s+UNDER\s+BOND|DOCUMENTS\s+REQUIRED|ADDITIONAL\s+CONDITIONS)/i);
  if (docReqMatch && docReqMatch.index != null && docReqMatch.index > 15) {
    cleaned = cleaned.substring(0, docReqMatch.index).trim();
  }

  // Clean any leading punctuation or orphan symbols left by header stripping
  cleaned = cleaned.replace(/^[,\s.:;\-–—]+/, '').replace(/\n{3,}/g, '\n\n').trim();

  return cleaned || rawText.trim();
}

/**
 * A contract item's description is printed on two (or more) lines, e.g.
 *   "NE 30/1 CARDED PHYSICAL BCI"  (the row with Qty / UOM / price)
 *   "100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING."  (the line under it)
 * The AI may return them in separate fields; keep every line, in order, in one description.
 */
export function mergeContractItemDescription<T extends ContractLineItem>(item: T): T {
  const lines: string[] = [];
  [item.description, item.specification, item.composition, item.yarnDetails]
    .flatMap(part => (part || '').split('\n'))
    .map(l => l.trim())
    .filter(Boolean)
    .forEach(l => {
      const key = l.toUpperCase().replace(/\s+/g, ' ');
      if (!lines.some(x => x.toUpperCase().replace(/\s+/g, ' ').includes(key))) lines.push(l);
    });
  return { ...item, description: lines.join('\n'), specification: undefined, composition: undefined, yarnDetails: undefined };
}

export function cleanPort(port: string): string {
  if (!port) return '';
  return port.replace(/^(?:CPT|CFR|CIF|FOB|EXW|DAP|DPU|FCA|CIP)\s+/i, '').trim();
}

export function cleanMarksAndNos(text?: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const u = line.toUpperCase();

    // Do NOT strip TOTAL GROSS WT or TOTAL NET WT if it contains text or weight
    // Only omit orphan header labels like "CONTAINER NO/SEAL NO :" at the end of string when empty
    if ((u === 'CONTAINER NO/SEAL NO :' || u === 'CONTAINER NO / SEAL NO :' || u === 'CONTAINER NO :') && i === lines.length - 1) {
      continue;
    }

    resultLines.push(line);
  }

  return resultLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}


export function formatAddressMultiline(addr?: string): string {
  if (!addr) return '';
  if (addr.includes('\n')) return addr;
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length <= 2) return addr;
  const lines = [];
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = parts.slice(i, i + 2).join(', ');
    lines.push(chunk + (i + 2 < parts.length ? ',' : ''));
  }
  return lines.join('\n');
}


export function generateInvoiceNumber(contractNo?: string): string {
  let seq = '0403';
  if (contractNo) {
    // Extract 4 digit number from contract string like S/0403/25-26 -> '0403'
    const match = contractNo.match(/(?:\/|^[A-Za-z]?\/?)(\d{4})(?:\/|$)/) || contractNo.match(/\b(\d{4})\b/) || contractNo.match(/\d{4}/);
    if (match) {
      seq = match[1] || match[0];
    } else {
       const cleaned = contractNo.replace(/[^a-zA-Z0-9]/g, '');
       if (cleaned) {
          seq = cleaned.slice(-4).padStart(4, '0');
       }
    }
  }
  
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  
  // Financial year in India runs April to March
  let startYear = year;
  if (month < 3) {
    startYear = year - 1;
  }
  
  const yy1 = startYear.toString().slice(-2);
  const yy2 = (startYear + 1).toString().slice(-2);
  
  return `LOL/${seq}/${yy1}-${yy2}`;
}

export function cleanConsignee(consignee: string): string {
  if (!consignee) return 'TO ORDER';
  const lines = consignee
    .split(/[\r\n]+/)
    .map(line => line
      .replace(/^consignee\s*:?\s*/i, '')
      .replace(/^consigned\s+to\s*:?\s*/i, '')
      .replace(/^made\s+out\s+to\s*:?\s*/i, '')
      .replace(/(?:[\s,.-]*)(?:INDIAN\s+ORIGIN|INDIA\s+ORIGIN|COUNTRY\s+OF\s+ORIGIN[:\s]+INDIA)/gi, '')
      .trim()
    )
    .filter(Boolean);

  if (lines.length === 0) return 'TO ORDER';

  if (/^to\s+(?:the\s+)?order\s+of\s*/i.test(lines[0])) {
    lines[0] = lines[0].replace(/^to\s+(the\s+)?order\s+of\s*/i, (_m: string, the?: string) => (the ? 'TO THE ORDER OF ' : 'TO ORDER OF ')).trim();
  } else if (/^to\s+(?:the\s+)?order$/i.test(lines[0])) {
    lines[0] = 'TO ORDER';
  }

  return lines.join('\n');
}

export function buildBankConsignee(
  issuingBank?: { name?: string; address?: string; city?: string; country?: string },
  consigneeClauseText?: string,
  draftConsignee?: string,
  applicant?: { name?: string; address?: string; country?: string; bin?: string }
): string {
  let bankName = issuingBank?.name || '';
  let bankAddr = issuingBank?.address || '';
  let bankCity = issuingBank?.city || '';
  let bankCountry = issuingBank?.country || '';

  if (consigneeClauseText) {
    const raw = consigneeClauseText;
    const bankMatch = raw.match(
      /(?:consigned\s+to\s*(?:the\s+order\s+of)?|made\s+out\s+to\s+(?:the\s+)?order\s+of|to\s+(?:the\s+)?order\s+of)\s+([^,;.]+?(?:bank|plc|ltd|limited|corporation|inc|n\.?a\.?|co\.)[^,;.]*)/i
    );
    if (bankMatch) {
      const party = bankMatch[1].trim();
      if (!/issuing\s+bank/i.test(party)) {
        bankName = party;
      }
    }
  }

  if (bankName) {
    const cleanBank = bankName.replace(/^to\s+order\s+of\s*/i, '').trim().toUpperCase();
    const lines = [`TO ORDER OF\n${cleanBank}`];

    const addrParts: string[] = [];
    if (bankAddr) {
      if (bankAddr.includes('\n')) {
        bankAddr.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean).forEach(l => addrParts.push(l));
      } else if (bankAddr.includes(',')) {
        bankAddr.split(',').map(p => p.trim()).filter(Boolean).forEach(p => addrParts.push(p));
      } else {
        addrParts.push(bankAddr.trim());
      }
    }
    if (bankCity && !addrParts.some(p => p.toUpperCase().includes(bankCity.toUpperCase()))) {
      addrParts.push(bankCity.trim());
    }
    if (bankCountry && !addrParts.some(p => p.toUpperCase().includes(bankCountry.toUpperCase()))) {
      addrParts.push(bankCountry.trim());
    }
    if (addrParts.length > 0) {
      lines.push(addrParts.join('\n'));
    }
    return lines.join('\n');
  }

  if (draftConsignee && draftConsignee.trim() && draftConsignee.trim() !== 'TO ORDER') {
    return cleanConsignee(draftConsignee);
  }

  return 'TO ORDER';
}

/**
 * Main-carriage mode. The transport document the LC calls for in 46A decides it (truck receipt /
 * bill of lading / air waybill); otherwise the route. Pre-carriage is the inland leg to the port
 * (often "BY TRUCK" on sea shipments), so it is deliberately not considered.
 */
export function detectTransportMode(
  portOfLoading: string,
  portOfDischarge: string,
  vessel = '',
  lc?: Pick<LCDetails, 'field46AClauses'> | null
): { modeLabel: string; isRoad: boolean } {
  const transportDoc = (lc?.field46AClauses || []).map(c => c.verbatimText).join(' ').toUpperCase();
  if (/TRUCK\s+RECEIPT|LORRY\s+RECEIPT|ROAD\s+TRANSPORT\s+DOCUMENT|\bL\/R\b/.test(transportDoc)) {
    return { modeLabel: 'By Road/Truck', isRoad: true };
  }
  if (/AIR\s*WAY\s*BILL|AIRWAY\s*BILL|\bAWB\b/.test(transportDoc)) return { modeLabel: 'By Air', isRoad: false };
  if (/BILLS?\s+OF\s+LADING|\bB\/L\b/.test(transportDoc)) return { modeLabel: 'By Sea', isRoad: false };

  const combined = `${portOfLoading} ${portOfDischarge} ${vessel}`.toUpperCase();
  if (
    combined.includes('PETRAPOLE') ||
    combined.includes('BENAPOLE') ||
    combined.includes('LAND PORT') ||
    combined.includes('BY ROAD') ||
    combined.includes('TRUCK') ||
    combined.includes('BORDER')
  ) {
    return { modeLabel: 'By Road/Truck', isRoad: true };
  }
  if (combined.includes('AIR') || combined.includes('FLIGHT') || combined.includes('AIRPORT')) {
    return { modeLabel: 'By Air', isRoad: false };
  }
  return { modeLabel: 'By Sea', isRoad: false };
}

export function numberToWords(num: number, currency = 'USD'): string {
  if (num === undefined || num === null || isNaN(num)) return '';

  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  const convertBelowThousand = (n: number): string => {
    let s = '';
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + ' HUNDRED ';
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        s += ones[n] + ' ';
      } else {
        s += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] + ' ' : ' ');
      }
    }
    return s.trim();
  };

  const inWordsInternational = (n: number): string => {
    if (n === 0) return 'ZERO';
    let res = '';

    const billions = Math.floor(n / 1000000000);
    n %= 1000000000;
    const millions = Math.floor(n / 1000000);
    n %= 1000000;
    const thousands = Math.floor(n / 1000);
    n %= 1000;
    const remainder = n;

    if (billions > 0) {
      res += convertBelowThousand(billions) + ' BILLION ';
    }
    if (millions > 0) {
      res += convertBelowThousand(millions) + ' MILLION ';
    }
    if (thousands > 0) {
      res += convertBelowThousand(thousands) + ' THOUSAND ';
    }
    if (remainder > 0) {
      res += convertBelowThousand(remainder) + ' ';
    }
    return res.trim();
  };

  const inWordsIndian = (n: number): string => {
    if (n === 0) return 'ZERO';
    let res = '';
    if (n >= 10000000) {
      res += inWordsIndian(Math.floor(n / 10000000)) + ' CRORE ';
      n %= 10000000;
    }
    if (n >= 100000) {
      res += convertBelowThousand(Math.floor(n / 100000)) + ' LAKH ';
      n %= 100000;
    }
    if (n >= 1000) {
      res += convertBelowThousand(Math.floor(n / 1000)) + ' THOUSAND ';
      n %= 1000;
    }
    if (n >= 100) {
      res += ones[Math.floor(n / 100)] + ' HUNDRED ';
      n %= 100;
    }
    if (n > 0) {
      if (n < 20) {
        res += ones[n] + ' ';
      } else {
        res += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] + ' ' : ' ');
      }
    }
    return res.trim();
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const currUpper = (currency || 'USD').toUpperCase();
  const isINR = currUpper === 'INR';

  // Lahoti format: "US DOLLAR TWENTY ONE THOUSAND ... AND SIXTY EIGHT CENTS ONLY"
  const prefix = currUpper === 'USD' ? 'US DOLLAR ' : currUpper === 'INR' ? 'INR ' : currUpper + ' ';
  const mainWords = isINR ? inWordsIndian(integerPart) : inWordsInternational(integerPart);

  let words = prefix + mainWords;
  if (decimalPart > 0) {
    const decWords = convertBelowThousand(decimalPart);
    if (currUpper === 'INR') {
      words += ' AND PAISE ' + decWords;
    } else if (currUpper === 'GBP') {
      words += ' AND ' + decWords + ' PENCE';
    } else {
      words += ' AND ' + decWords + ' CENTS';
    }
  }

  return words.trim() + ' ONLY';
}

/**
 * Lahoti's own fixed company particulars (printed on every document). Values read from an
 * uploaded document always win over these.
 */
export const LAHOTI_EXPORTER: ExporterParty = {
  name: 'LAHOTI OVERSEAS LIMITED',
  address: '307, ARUN CHAMBERS,\nTARDEO ROAD,\nMUMBAI-400034, INDIA.',
  tel: '91-22-40500100 TO 40500199',
  fax: '91-22-40500150',
  email: 'umesh@lahotioverseas.com',
  web: 'www.lahotioverseas.com',
  cin: 'L74999MH1995PLC087643',
  gstin: '27AAACL2578H1ZE',
  taxId: '27AAACL2578H1ZE',
  pan: 'AAACL2578H'
};

export const LAHOTI_DOCS_EMAIL = 'docs1@lahotioverseas.com';

const INVOICE_DECLARATION =
  'We declare that this invoice shows the actual price of the goods\ndescribed and that all particulars are true and correct';

/**
 * Fallback draft when only the sale contract is available. Shipment facts (packages, weights,
 * marks, freight) are NOT in a contract, so they are left empty for the pre-shipment invoice to fill.
 */
export function draftExportDocumentsFromContract(contract: SaleContractData): ExportData {
  const totalQty = contract.items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const totalAmount = contract.totalValue || contract.items.reduce((acc, it) => acc + (it.netValue || 0), 0);
  const currency = contract.orderCurrency || 'USD';
  const buyerNameAddr = [contract.buyer?.name, contract.buyer?.address].filter(Boolean).join('\n');

  return {
    exporter: mergeExporter(contract.exporter),
    invoiceNo: '',
    invoiceDate: '',
    exporterRef: '',
    irnno: '',
    buyersOrderNo: contract.contractNo || '',
    buyersOrderDate: contract.contractDate || '',
    otherReference: '',
    consignee: 'TO ORDER',
    buyerIfOtherThanConsignee: buyerNameAddr,
    countryOfOrigin: 'INDIAN ORIGIN',
    countryOfFinalDestination: contract.buyer?.country || '',
    termsOfDelivery: contract.deliveryTerms || '',
    preCarriageBy: '',
    placeOfReceiptByPreCarrier: '',
    vesselFlightNo: '',
    portOfLoading: cleanPort(contract.portOfLoading || ''),
    portOfDischarge: cleanPort(contract.portOfDelivery || ''),
    finalDestination: cleanPort(contract.portOfDelivery || ''),
    termsOfDeliveryAndPayment: [contract.deliveryTerms, contract.paymentTerms].filter(Boolean).join('\n'),
    lineItems: contract.items.map(item => ({
      marksAndNos: '',
      noAndKindOfPkg: '',
      description: [item.description, item.specification, item.composition, item.yarnDetails].filter(Boolean).join('\n'),
      quantity: item.quantity || 0,
      uom: item.uom || '',
      rate: item.unitPrice || 0,
      amount: item.netValue || Math.round((item.quantity || 0) * (item.unitPrice || 0) * 100) / 100,
      packageKind: inferPackageKind(contract.packingType || item.uom)
    })),
    packingRows: [],
    totalQuantity: totalQty,
    totalNetWtKg: null,
    totalGrossWtKg: null,
    totalAmount,
    currency,
    amountInWords: totalAmount ? numberToWords(totalAmount, currency) : '',
    declarationText: INVOICE_DECLARATION,
    rexNumber: contract.exporter?.rexNo || ''
  };
}

export const draftExportDataFromContract = draftExportDocumentsFromContract;

function mergeExporter(src?: Partial<ExporterParty> & { gstin?: string } | null): ExporterParty {
  const out: ExporterParty = { ...LAHOTI_EXPORTER };
  if (!src) return out;
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'string' && v.trim()) (out as any)[k] = v.trim();
  }
  if (src.gstin && !src.taxId) out.taxId = src.gstin;
  return out;
}

function singularUom(uom: string): string {
  const u = (uom || '').trim().toUpperCase();
  if (/^YARDS?$|^YDS?$/.test(u)) return 'YARD';
  if (/^M(?:E)?T(?:E)?RS?$|^METERS?$/.test(u)) return 'MTR';
  if (/^KGS?$|^KILOGRAMS?$/.test(u)) return 'KG';
  if (/^PCS$|^PIECES?$/.test(u)) return 'PC';
  return u.replace(/S$/, '');
}

function pluralUom(uom: string): string {
  const s = singularUom(uom);
  if (s === 'YARD') return 'YARDS';
  if (s === 'MTR') return 'MTRS';
  if (s === 'KG') return 'KGS';
  if (s === 'PC') return 'PCS';
  return s ? `${s}S` : '';
}

/**
 * Maps the uploaded pre-shipment invoice (one shipment) into the editable export draft.
 * The LC supplies the commercial unit rate; the pre-shipment supplies everything physical.
 */
export function exportDataFromPreShipment(
  pre: PreShipmentInvoiceData,
  lc?: LCDetails | null,
  contract?: SaleContractData | null
): ExportData {
  const currency = pre.currency || lc?.currency || contract?.orderCurrency || 'USD';
  const qty = Number(pre.goodsQuantity) || 0;
  const amount = Number(pre.totalAmount) || 0;
  const uom = singularUom(pre.goodsQuantityUom || lc?.goodsQuantityUom || contract?.items?.[0]?.uom || '');
  const rate = Number(lc?.unitPrice) || Number(contract?.items?.[0]?.unitPrice) || (qty > 0 ? Math.round((amount / qty) * 10000) / 10000 : 0);
  // Several LC products: each line takes the price of the LC product it matches (yarn count / price / wording)
  const preItems = (pre.items || []).filter(it => Number(it.quantity) > 0 || it.description);
  const lcItems = lc ? lcGoodsItems(lc) : [];
  const matched = matchLcItems(lcItems, preItems.map((it, k) => ({ description: it.description, marks: it.marksAndNos || (k === 0 ? pre.marksAndNos : ''), rate: Number(it.rate) })));
  const itemRate = (it: PreShipmentItem, k: number) =>
    (matched[k] >= 0 && lcItems[matched[k]].unitPrice)
    || (lcItems.length > 1 ? Number(it.rate) : 0)
    || rate
    || Number(it.rate)
    || 0;
  const kind = (pre.packageKind || '').toUpperCase() || inferPackageKind(pre.marksAndNos);
  const count = Number(pre.packageCount) || 0;
  const pkgText = count ? `${count} ${kind}` : kind;
  const marks = (pre.marksAndNos || '').trim();
  const firstMarkLine = marks.split('\n')[0]?.trim() || '';
  const buyerBlock = pre.buyer?.trim()
    || (lc?.applicant?.name
      ? [lc.applicant.name, lc.applicant.address].filter(Boolean).join('\n')
      : [contract?.buyer?.name, contract?.buyer?.address].filter(Boolean).join('\n'));
  const val = (v?: string | null) => (v || '').trim();
  const portOfLoading = val(pre.portOfLoading) || cleanPort(lc?.portOfLoading || contract?.portOfLoading || '');
  const portOfDischarge = val(pre.portOfDischarge) || cleanPort(lc?.portOfDischarge || contract?.portOfDelivery || '');
  // Land-port routes (Petrapole -> Benapole) move by truck, so a blank vessel box can still be filled
  const isRoad = detectTransportMode(portOfLoading, portOfDischarge, val(pre.vesselFlightNo), lc).isRoad;
  const terms = val(pre.termsOfDeliveryAndPayment)
    || (lc ? buildLcTerms(lc).block : [contract?.deliveryTerms, contract?.paymentTerms].filter(Boolean).join('\n'));

  return {
    exporter: mergeExporter(pre.exporter),
    invoiceNo: pre.invoiceNo || '',
    invoiceDate: pre.invoiceDate || '',
    exporterRef: '',
    irnno: val(pre.irnNo),
    buyersOrderNo: pre.buyersOrderNo || contract?.contractNo || '',
    buyersOrderDate: val(pre.buyersOrderDate) || contract?.contractDate || '',
    otherReference: val(pre.otherReference),
    consignee: val(pre.consignee) || (lc ? buildLcConsignee(lc) : 'TO ORDER'),
    buyerIfOtherThanConsignee: buyerBlock,
    countryOfOrigin: val(pre.countryOfOrigin) || 'INDIAN ORIGIN',
    countryOfFinalDestination: val(pre.countryOfFinalDestination) || lc?.applicant?.country || contract?.buyer?.country || '',
    termsOfDelivery: terms,
    preCarriageBy: val(pre.preCarriageBy),
    placeOfReceiptByPreCarrier: val(pre.placeOfReceipt),
    vesselFlightNo: val(pre.vesselFlightNo) || (isRoad ? 'BY ROAD' : ''),
    portOfLoading,
    portOfDischarge,
    finalDestination: val(pre.finalDestination) || portOfDischarge,
    termsOfDeliveryAndPayment: terms,
    lineItems: preItems.length > 1
      ? preItems.map((it, k) => ({
        marksAndNos: it.marksAndNos || (k === 0 ? marks : ''),
        noAndKindOfPkg: it.packageCount ? `${it.packageCount} ${(it.packageKind || kind).toUpperCase()}` : (k === 0 ? pkgText : ''),
        noOfCartons: it.packageCount || (k === 0 ? count : 0),
        packageKind: (it.packageKind || kind).toUpperCase(),
        cartonOption: (it.packageKind || kind).toUpperCase(),
        itemDescription1: (it.marksAndNos || '').split('\n')[0] || (k === 0 ? firstMarkLine : ''),
        description: it.description || '',
        quantity: Number(it.quantity) || 0,
        uom: singularUom(it.uom || uom),
        unitOfRate: singularUom(it.uom || uom),
        rate: itemRate(it, k),
        amount: Number(it.amount) || 0,
        hsCode: pre.hsnCode || '',
        grossWt: it.grossWeightKg ?? undefined,
        netWt: it.netWeightKg ?? undefined
      }))
      : [{
        marksAndNos: marks,
        noAndKindOfPkg: pkgText,
        noOfCartons: count,
        packageKind: kind,
        cartonOption: kind,
        itemDescription1: firstMarkLine,
        description: preItems[0]?.description || pre.customsDescription || '',
        quantity: qty,
        uom,
        unitOfRate: uom,
        rate: preItems[0] ? itemRate(preItems[0], 0) : rate,
        amount,
        hsCode: pre.hsnCode || '',
        grossWt: pre.grossWeightKg ?? undefined,
        netWt: pre.netWeightKg ?? undefined
      }],
    packingRows: [{
      lotNo: '01',
      count: '',
      noOfUnits: pkgText,
      containerSealNo: '',
      netWtKg: pre.netWeightKg ?? null,
      grossWtKg: pre.grossWeightKg ?? null
    }],
    totalQuantity: qty,
    totalNetWtKg: pre.netWeightKg ?? null,
    totalGrossWtKg: pre.grossWeightKg ?? null,
    totalCartons: count,
    totalAmount: amount,
    currency,
    amountInWords: amount ? numberToWords(amount, currency) : '',
    declarationText: INVOICE_DECLARATION,
    rexNumber: '',
    freightAmount: pre.freightAmount ?? undefined,
    insuranceAmount: pre.insuranceAmount ?? undefined,
    exchangeRate: pre.exchangeRate ?? undefined
  };
}

// ---------------------------------------------------------------------------
// LC text helpers
// ---------------------------------------------------------------------------

function allLCClauses(lc: LCDetails, amendments: LCAmendment[] = []): LCClause[] {
  const base = [...(lc.field46AClauses || []), ...(lc.field47AClauses || [])];
  const patched = amendments.flatMap(a => a.patchedClauses || []);
  if (!patched.length) return base;
  const byId = new Map(base.map(c => [c.id, c]));
  patched.forEach(p => byId.set(p.id, { ...(byId.get(p.id) || {}), ...p } as LCClause));
  return Array.from(byId.values());
}

/** SWIFT style YYMMDD as printed on the LC ("260416"). */
export function toSwiftDate(raw?: string): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\d{6}$/.test(s)) return s;
  const d = parseTradeDate(s);
  if (!d) return s;
  return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** dd{sep}mm{sep}yyyy (or yy). Returns the input unchanged when it cannot be parsed. */
export function formatTradeDate(raw: string | undefined, sep = '/', shortYear = false): string {
  if (!raw) return '';
  const d = parseTradeDate(raw);
  if (!d) return raw;
  const yyyy = String(d.getFullYear());
  return [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), shortYear ? yyyy.slice(-2) : yyyy].join(sep);
}

const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface LCIdentifiers {
  hsCode: string;
  tin: string;
  irc: string;
  applicantBin: string;
  issuingBankBin: string;
}

/** Pulls H.S. code, TIN, IRC and the applicant / issuing-bank BIN numbers out of the LC text. */
export function extractLCIdentifiers(lc: LCDetails, clauses: LCClause[] = allLCClauses(lc)): LCIdentifiers {
  const text = [lc.goodsDescriptionVerbatim, ...clauses.map(c => c.verbatimText)].filter(Boolean).join('\n');
  const hs = text.match(/H\.?\s*S\.?\s*CODE\s*(?:NO\.?)?\s*[:\-]?\s*(\d{4}(?:\.\d{2}){1,3}|\d{6,10})/i);
  const tin = text.match(/\bTIN\s*(?:NO\.?)?\s*[:\-]?\s*(\d[\d\-]{5,}\d)/i);
  const irc = text.match(/\bIRC\s*(?:NO\.?)?\s*[:\-]?\s*((?:[A-Z]{1,4}-?)?\d{4,})/i);

  let applicantBin = '';
  const bins: string[] = [];
  const binRe = /\bBIN\s*(?:NO\.?)?\s*[:\-]?\s*(\d{6,}-\d{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = binRe.exec(text))) {
    bins.push(m[1]);
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    if (!applicantBin && /\b(?:TIN|IRC)\b|APPLICANT/i.test(before) && !/\bBANK\b/i.test(before.split(/\(\s*i+\s*\)|;/i).pop() || '')) {
      applicantBin = m[1];
    }
  }
  // "VAT REGISTRATION NO(BIN) OF L/C APPLICANT 000495263-0403 AND ... OF L/C ISSUING BANK 000000248-0002"
  const byRole = (role: string) => text.match(new RegExp(String.raw`\bBIN\s*\)?\s*(?:NO\.?)?\s*OF\s+(?:THE\s+)?(?:L\/C\s+)?${role}\s*[:\-]?\s*(\d{6,}-\d{2,})`, 'i'))?.[1] || '';
  const roleApplicant = byRole('APPLICANT');
  const roleBank = byRole('ISSUING\\s+BANK');
  applicantBin = roleApplicant || applicantBin || (lc.applicant?.bin || '').replace(/^BIN\s*(?:NO\.?)?\s*[:\-]?\s*/i, '') || '';
  const issuingBankBin = roleBank || bins.find(b => b !== applicantBin) || '';

  return {
    hsCode: hs?.[1] || '',
    tin: tin?.[1] || lc.applicant?.tin || '',
    irc: irc?.[1] || '',
    applicantBin,
    issuingBankBin
  };
}

/**
 * The LC reference block Sonali/Bangladesh LCs require "in all documents"
 * (L/C no. & date, H.S. code, TIN, IRC, BIN, "opened under bond").
 */
/** What the LC requires to be quoted on every document, field by field. */
export interface LcReferenceParts {
  lcLine: string; // "LETTER OF CREDIT NUMBER 033026020021 DATE 260416"
  hsCode: string;
  tin: string;
  irc: string;
  bin: string;
  underBond: boolean;
  coverNote: string; // "UIC/MCK/MC-0109/03/2026 DATED 12.03.2026"
  exportLcSc: string; // "ATL/ALDI/26/006 DATED 25.02.2026, ..."
  vatApplicant: string;
  vatIssuingBank: string;
}

export function lcReferenceParts(lc: LCDetails, ids: LCIdentifiers, clauses: LCClause[]): LcReferenceParts {
  const allText = clauses.map(c => c.verbatimText).join(' ').replace(/\s+/g, ' ');
  const roleBins = /BIN\s*\)?\s*(?:NO\.?)?\s*OF\s+(?:THE\s+)?(?:L\/C\s+)?ISSUING\s+BANK/i.test(allText);
  // An H.S. code already written in 45A is not repeated in the reference block
  const hsIn45A = /H\.?\s*S\.?\s*CODE/i.test(lc.goodsDescriptionVerbatim || '');
  const exportLc = allText.match(/EXPORT\s+L\/?C\s*\/?\s*S\/?C\s*NO\.?\s*(.*?)\s*MUST\s+BE\s+MENTIONED/i);
  const coverClause = clauses.map(c => c.verbatimText.replace(/\s+/g, ' ')).find(t => /MENTIONED\s+IN\s+ALL\s+DOCUMENTS/i.test(t) && /COVER\s*NOTE/i.test(t)) || '';
  const cover = coverClause.match(/COVER\s*NOTE\s*(?:NO\.?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]+)\s*,?\s*(?:DTD\.?|DATED)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  return {
    lcLine: `LETTER OF CREDIT NUMBER ${lc.lcNumber} DATE ${toSwiftDate(lc.issueDate)}`,
    hsCode: hsIn45A ? '' : ids.hsCode,
    tin: ids.tin,
    irc: ids.irc,
    bin: roleBins ? '' : ids.applicantBin,
    underBond: clauses.some(c => /OPENED\s+UNDER\s+BOND/i.test(c.verbatimText)),
    coverNote: cover ? `${cover[1]} DATED ${cover[2]}` : '',
    exportLcSc: exportLc ? exportLc[1].replace(/\s+(?=[A-Z]{2,}\/)/g, ', ').trim() : '',
    vatApplicant: roleBins ? ids.applicantBin : '',
    vatIssuingBank: roleBins ? ids.issuingBankBin : ''
  };
}

/** "H.S.CODE NO. 5209.12.00, TIN NO. 714245426517," / "IRC NO. BA-0169290, BIN NO. 000358148-0303." */
export function formatIdLines(p: { hsCode?: string; tin?: string; irc?: string; bin?: string }): string[] {
  const parts = [
    p.hsCode && `H.S.CODE NO. ${p.hsCode}`,
    p.tin && `TIN NO. ${p.tin}`,
    p.irc && `IRC NO. ${p.irc}`,
    p.bin && `BIN NO. ${p.bin}`
  ].filter(Boolean) as string[];
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    lines.push(parts.slice(i, i + 2).join(', ') + (i + 2 >= parts.length ? '.' : ','));
  }
  return lines;
}

/** The lines after the LC number line, in the order Lahoti prints them. */
function referenceTailLines(p: Omit<LcReferenceParts, 'lcLine'>): string[] {
  return [
    ...formatIdLines(p),
    p.underBond ? 'THIS L/C IS OPENED UNDER BOND.' : '',
    p.coverNote ? `INSURANCE COVER NOTE NO. ${p.coverNote}` : '',
    p.exportLcSc ? `EXPORT LC/S/C NO. ${p.exportLcSc}` : '',
    p.vatApplicant ? `VAT REG. NO. (BIN) OF L/C APPLICANT: ${p.vatApplicant}` : '',
    p.vatIssuingBank ? `VAT REG. NO. (BIN) OF L/C ISSUING BANK: ${p.vatIssuingBank}` : ''
  ].filter(Boolean);
}

/**
 * The LC reference block the LC requires "in all documents"
 * (L/C no. & date, H.S. code, TIN, IRC, BIN, "opened under bond", cover note, export LC/SC, VAT BINs).
 */
export function buildLcReferenceLines(lc: LCDetails, ids: LCIdentifiers, clauses: LCClause[]): string[] {
  const p = lcReferenceParts(lc, ids, clauses);
  return [p.lcLine, ...referenceTailLines(p)];
}

const INCOTERM_RE = /\b(?:CPT|CFR|CIF|FOB|FCA|CIP|DAP|DPU|EXW|DDP)\s+[^\n]*?\(\s*INCOTERMS?\s*:?\s*\d{4}\s*\)/i;

export function extractIncotermLine(lc: LCDetails): string {
  const src = lc.goodsDescriptionVerbatim || '';
  const m = src.match(INCOTERM_RE) || src.match(/\b(?:CPT|CFR|CIF|FOB|FCA|CIP|DAP|DPU|EXW|DDP)\s+[A-Z][A-Z ,]+/);
  if (!m) return '';
  return m[0].replace(/\s*,\s*/g, ', ').replace(/\s*\(\s*/g, ' (').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
}

/**
 * Turns the LC 45A text (written for the whole LC) into the description for ONE shipment:
 * the LC-level "QTY ... RATE ..." and "TOTAL ... USD ..." statements are replaced by the
 * quantity actually shipped. Everything else stays verbatim as the LC wrote it.
 */
// "QTY 173,000 YARDS RATE 1.0100/YARD." / "QUANTITY: 63,957.60 KG, UNIT PRICE: 2.700 PER KGS"
const LC_QTY_SRC = String.raw`\bQ(?:UANTITY|TY|NTY)\b\.?\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*(YARDS?|YDS?|KGS?|KILOGRAMS?|MTRS?|METERS?|METRES?|PCS|PIECES|LBS|SQ\.?\s*M(?:TR|ETERS?)?S?)\b\.?(?:\s*,?\s*(?:@|AT)?\s*(?:UNIT\s+)?(?:RATE|PRICE)\s*[:\-]?\s*(?:[A-Z]{3}\s*)?([\d.,]+)\s*(?:(?:\/|PER)\s*[A-Z]+)?\.?)?`;
const LC_TOTAL_RE = /\bTOTAL\b[^\n]*?\b(?:USD|EUR|GBP)\s*[\d,]+(?:\.\d+)?\s*(?:\(\s*INCLUDING[^)]*\))?\.?/i;
const num = (s?: string) => Number(String(s || '').replace(/,/g, '')) || 0;
const fmtQty = (q: number, uom: string) => `QUANTITY: ${q.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${pluralUom(uom)}`;

/** One product found in the 45A text: its own lines, plus the quantity/price the LC states for it. */
export interface LcGoodsBlock {
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
}

/**
 * Splits 45A into its products and the text shared by all of them (end-use statement, proforma
 * invoice numbers, H.S. code, terms of delivery). Each product ends with its own quantity line.
 * Returns null when 45A lists a single product.
 */
export function splitLcGoods(raw45A: string): { blocks: LcGoodsBlock[]; common: string } | null {
  const text = cleanGoodsDescriptionVerbatim(raw45A || '').replace(/\r/g, '');
  const matches = Array.from(text.matchAll(new RegExp(LC_QTY_SRC, 'gi')));
  if (matches.length < 2) return null;
  const blocks: LcGoodsBlock[] = [];
  let prevEnd = 0;
  for (const m of matches) {
    blocks.push({
      description: text.slice(prevEnd, m.index).split('\n').map(l => l.trim()).filter(Boolean).join('\n'),
      quantity: num(m[1]),
      uom: singularUom(m[2]),
      unitPrice: num(m[3])
    });
    prevEnd = m.index! + m[0].length;
  }
  return { blocks, common: text.slice(prevEnd).replace(LC_TOTAL_RE, '\n') };
}

/** The LC's products: AI-extracted goodsItems when it found several, else parsed from the 45A text. */
export function lcGoodsItems(lc: LCDetails): LcGoodsBlock[] {
  const parsed = splitLcGoods(lc.goodsDescriptionVerbatim || '');
  if (parsed) return parsed.blocks;
  if ((lc.goodsItems?.length || 0) > 1) {
    return lc.goodsItems!.map(g => ({ description: g.description, quantity: Number(g.quantity) || 0, uom: singularUom(g.uom), unitPrice: Number(g.unitPrice) || 0 }));
  }
  return [];
}

/**
 * How Lahoti types LC text onto its documents. The wording stays the LC's; only the typing changes:
 * '' -> ", BENEFICIARY'S -> BENEFICIARYS, a space after commas, before brackets and after "NO.",
 * and yarn counts spaced out ("20OE X 20KW+70D" -> "20 OE X 20 KW + 70D").
 */
export function typesetLcLine(line: string): string {
  return line
    .replace(/''/g, '"')
    .replace(/(\w)['’]S\b/gi, '$1S')
    .replace(/,(?=[A-Z])/gi, ', ')
    .replace(/([A-Z])\(/gi, '$1 (')
    .replace(/\bNO\.(?=[A-Z0-9])/g, 'NO. ')
    .replace(/(\d)(OE|KW|KH|CW|CH|CD|CM|CC)\b/g, '$1 $2')
    .replace(/([A-Z])\+(\d+D)\b/g, '$1 + $2')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Lahoti's description column holds about 55 characters; sentences are re-broken to that width. */
export const DESC_LINE_WIDTH = 55;
export function wrapLine(text: string, width = DESC_LINE_WIDTH): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ').filter(Boolean)) {
    if (cur && cur.length + 1 + word.length > width) {
      out.push(cur);
      cur = word;
    } else {
      cur = cur ? `${cur} ${word}` : word;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// Helvetica advance widths (1/1000 em) for the characters used on the documents
const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '.': 278, ',': 278, ':': 278, ';': 278, '/': 278, '-': 333, '(': 333, ')': 333, "'": 191, '"': 355, '%': 889, '+': 584, '&': 667
};
const textEm = (s: string) => [...s].reduce((t, ch) => t + (HELVETICA_WIDTHS[ch] ?? (/\d/.test(ch) ? 556 : 500)), 0) / 1000;
/** The invoice description column: 69 mm of 6.2 pt Helvetica. */
const INVOICE_DESC_EM = 69 / (6.2 * 0.35278);

/** Breaks a sentence where the invoice description column (69 mm) runs out, as the printed invoice does. */
export function wrapToInvoiceColumn(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textEm(next) > INVOICE_DESC_EM) {
      out.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** LC wraps sentences at its column width; rejoin a line onto the previous one when that was cut short. */
function rejoinWrapped(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/[ \t]+/g, ' ').replace(/^\.(?=\S)/, '').trim();
    if (!line || line === '.') continue;
    const prev = out[out.length - 1];
    if (prev && prev.length >= 50 && !/[.:;)]$/.test(prev) && !/^[A-Z][A-Z .\/&]{1,30}:/.test(line)) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

const COUNT_RE = /\bNE\s*(\d+)\s*\/\s*(\d+)/i;
const words = (s: string) => new Set((s.toUpperCase().match(/[A-Z]{3,}/g) || []));

/**
 * Which LC product each shipped line is. Yarn count (NE 30/1), then price, then wording decide.
 * Returns the LC product index per shipped line (-1 when the LC lists one product or none fits).
 */
export function matchLcItems(lcItems: LcGoodsBlock[], shipped: Array<{ description?: string; marks?: string; rate?: number }>): number[] {
  if (lcItems.length < 2) return shipped.map(() => -1);
  return shipped.map(s => {
    const text = `${s.description || ''}\n${s.marks || ''}`;
    const count = text.match(COUNT_RE);
    const sw = words(text);
    let best = -1;
    let bestScore = -Infinity;
    lcItems.forEach((it, i) => {
      let score = 0;
      const ic = it.description.match(COUNT_RE);
      if (count && ic) score += count[1] === ic[1] && count[2] === ic[2] ? 10 : -10;
      if (s.rate && it.unitPrice && Math.abs(s.rate - it.unitPrice) < 0.0005) score += 5;
      const iw = words(it.description);
      score += (3 * [...iw].filter(w => sw.has(w)).length) / Math.max(iw.size, 1);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  });
}

export interface ShippedLcItem {
  lcIndex: number;
  quantity: number;
  amount: number;
  uom: string;
  unitPrice: number; // the LC's price for this product
}

/** For an LC with several 45A products: what this shipment ships of each (grouped by LC product). Empty otherwise. */
export function shippedLcItems(lc: LCDetails, draft: Pick<ExportData, 'lineItems'>): ShippedLcItem[] {
  const items = lcGoodsItems(lc);
  if (items.length < 2) return [];
  const lines = (draft.lineItems || []).filter(li => Number(li.quantity) > 0);
  const idx = matchLcItems(items, lines.map(li => ({ description: li.description, marks: li.marksAndNos, rate: Number(li.rate) })));
  if (!lines.length || idx.some(i => i < 0)) return [];
  const out: ShippedLcItem[] = [];
  lines.forEach((li, k) => {
    const existing = out.find(o => o.lcIndex === idx[k]);
    const quantity = Number(li.quantity) || 0;
    const amount = Number(li.amount) || 0;
    if (existing) {
      existing.quantity += quantity;
      existing.amount += amount;
    } else {
      out.push({ lcIndex: idx[k], quantity, amount, uom: singularUom(li.uom || items[idx[k]].uom), unitPrice: items[idx[k]].unitPrice || Number(li.rate) || 0 });
    }
  });
  return out.sort((a, b) => a.lcIndex - b.lcIndex);
}

/**
 * 45A for ONE shipment of a multi-product LC: only the products shipped (each with the quantity
 * shipped), followed by the lines 45A states for all products.
 */
export function buildMultiItemGoodsDescription(lc: LCDetails, shipped: Array<{ lcIndex: number; quantity: number; uom: string }>): { perItem: string[]; common: string[] } | null {
  const parsed = splitLcGoods(lc.goodsDescriptionVerbatim || '');
  let blocks: LcGoodsBlock[];
  let common: string;
  if (parsed) {
    ({ blocks, common } = parsed);
  } else if ((lc.goodsItems?.length || 0) > 1) {
    // Table-style 45A ("1 S/0467/25-26 Ne 16/1 1.680,00 2,85 4.788,00"): products come from the
    // AI's goodsItems; shared lines are whatever is neither a product line nor a table row.
    blocks = lcGoodsItems(lc);
    const itemLines = new Set(blocks.flatMap(b => b.description.split('\n').map(l => l.trim().toUpperCase())));
    common = cleanGoodsDescriptionVerbatim(lc.goodsDescriptionVerbatim || '')
      .split('\n')
      .filter(l => l.trim() && !itemLines.has(l.trim().toUpperCase()) && (l.match(/\d[\d.,]*/g) || []).length < 3)
      .join('\n')
      .replace(LC_TOTAL_RE, '\n');
  } else {
    return null;
  }
  const perItem = shipped
    .filter(s => blocks[s.lcIndex])
    .map(s => [
      ...blocks[s.lcIndex].description.split('\n').map(typesetLcLine).filter(Boolean),
      s.quantity > 0 ? fmtQty(s.quantity, s.uom || blocks[s.lcIndex].uom) : ''
    ].filter(Boolean).join('\n'));
  return { perItem, common: rejoinWrapped(common).flatMap(l => wrapLine(typesetLcLine(l))) };
}

export function buildShipmentGoodsDescription(raw45A: string, quantity: number, uom: string): string {
  let text = cleanGoodsDescriptionVerbatim(raw45A || '').replace(/\r/g, '');
  const qtyLine = quantity > 0 ? fmtQty(quantity, uom) : '';

  const qtyRe = new RegExp(LC_QTY_SRC, 'i');
  const totalRe = LC_TOTAL_RE;

  text = text.replace(totalRe, '\n');
  if (qtyRe.test(text)) {
    text = text.replace(qtyRe, qtyLine ? `\n${qtyLine}\n` : '\n');
  } else if (qtyLine) {
    const specIdx = text.search(/SPECIFICATION\s*,\s*QUALITY/i);
    text = specIdx > 0 ? `${text.slice(0, specIdx)}\n${qtyLine}\n${text.slice(specIdx)}` : `${text}\n${qtyLine}`;
  }
  text = text.replace(/\s*(SPECIFICATION\s*,\s*QUALITY)/i, '\n$1');

  // The product lines above QUANTITY are kept as the LC lays them out; below it the LC only
  // wraps sentences at its column width, so rejoin each sentence onto one line.
  const lines = text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const qtyIdx = lines.findIndex(l => l.startsWith('QUANTITY:'));
  const head = lines.slice(0, qtyIdx + 1).map(typesetLcLine);
  const tail: string[] = [];
  let sentence = '';
  for (const line of lines.slice(qtyIdx + 1)) {
    sentence = sentence ? `${sentence} ${line}` : line;
    if (/\.\s*$/.test(line)) {
      tail.push(sentence);
      sentence = '';
    }
  }
  if (sentence) tail.push(sentence);
  return [...head, ...tail.flatMap(t => wrapLine(typesetLcLine(t)))].join('\n');
}

/** "MAHANA, DUPTARA, RUPGONJ, NARAYANGONJ, BANGLADESH" -> ["MAHANA, DUPTARA, RUPGONJ,", "NARAYANGONJ, BANGLADESH."] */
export function formatAddressLines(address: string, country?: string): string[] {
  const raw = (address || '').trim();
  if (!raw) return [];
  let lines: string[];
  if (raw.includes('\n')) {
    lines = raw.split('\n').map(l => l.trim().replace(/\s*,\s*/g, ', ').replace(/,\s*$/, ',')).filter(Boolean);
  } else {
    const parts = raw.replace(/[.\s]+$/, '').split(',').map(p => p.trim()).filter(Boolean);
    if (country && !parts.some(p => p.toUpperCase().includes(country.toUpperCase()))) parts.push(country.toUpperCase());
    if (parts.length <= 2) {
      lines = [parts.join(', ')];
    } else {
      lines = [parts.slice(0, -2).join(', ') + ',', parts.slice(-2).join(', ')];
    }
  }
  if (country && !lines.some(l => l.toUpperCase().includes(country.toUpperCase()))) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,\s]+$/, '') + `, ${country.toUpperCase()}`;
  }
  const last = lines.length - 1;
  if (!/[.,]$/.test(lines[last])) lines[last] += '.';
  return lines;
}

/** Splits "SONALI BANK PLC.,LOCAL OFFICE, MOTIJHEEL C/A,DHAKA" into name + address lines. */
function formatPartyBlock(party: string, country?: string): string[] {
  const text = party.replace(/\s+/g, ' ').trim().replace(/[.,;\s]+$/, '');
  const nameMatch = text.match(/^(.*?\b(?:PLC|LTD|LIMITED|N\.A)\b\.?)(\s*,)?\s*(.*)$/i) || text.match(/^(.*?\bBANK\b)(\s*,)?\s*(.*)$/i);
  if (!nameMatch) return formatAddressLines(text, country);
  const name = nameMatch[1].trim();
  const rest = nameMatch[3].trim();
  if (!rest) return [name];
  return [name + (nameMatch[2] ? ',' : ''), ...formatAddressLines(rest, country)];
}

function applicantBlockLines(lc: LCDetails, bin: string, country: string): string[] {
  const lines = [lc.applicant?.name || '', ...formatAddressLines(lc.applicant?.address || '', country)].filter(Boolean);
  if (bin) lines.push(`BIN NO. ${bin}`);
  return lines;
}

function findConsigneeParty(clauses: LCClause[]): string {
  for (const c of clauses) {
    const m = c.verbatimText.match(/(?:CONSIGNEE\s*[:\-]?\s*|CONSIGNED\s+|MADE\s+OUT\s+)TO\s+(?:THE\s+)?ORDER\s+OF\s+([\s\S]*?)(?=\s+MARKED\b|\s*,?\s*NOTIFY|\s+SHOWING\b|\s+BLANK\s+ENDORSED|$)/i);
    if (m) return m[1].trim();
  }
  return '';
}

function findNotifyParts(clauses: LCClause[]): string[] {
  const c = clauses.find(cl => /NOTIFY/i.test(cl.verbatimText));
  if (!c) return [];
  const after = c.verbatimText.slice(c.verbatimText.search(/NOTIFY/i)).replace(/^NOTIFY(?:ING)?\s*[:\-]*\s*/i, '');
  const parts = after
    .split(/\(\s*(?:i{1,3}|iv|v|[a-d]|[1-4])\s*\)/i)
    .map(p => p.replace(/^[\s,;:\-]+|[\s,;]+$/g, '').replace(/^AND\s+/i, '').trim())
    .filter(p => p.length > 2);
  const roles = /^(?:THE\s+)?(ISSUING\s+BANK|APPLICANT)\s+AND\s+(?:THE\s+)?(ISSUING\s+BANK|APPLICANT)\b/i.exec(parts[0] || '');
  return roles ? [roles[1], roles[2]].map(r => r.toUpperCase().replace(/\s+/g, ' ')) : parts;
}

function destinationCountry(lc: LCDetails): string {
  if (lc.applicant?.country && lc.applicant.country.length > 2) return lc.applicant.country.toUpperCase();
  const pod = (lc.portOfDischarge || '').replace(/[.\s]+$/, '').split(',').map(s => s.trim()).filter(Boolean);
  return pod.length > 1 ? pod[pod.length - 1].toUpperCase() : '';
}

function normalizePort(port: string): string {
  return cleanPort(port || '').replace(/\s*,\s*/g, ', ').replace(/[.\s]+$/, '').toUpperCase();
}

// Old and new names of the same place, so "CHITTAGONG" on the pre-shipment matches the LC's "CHATTOGRAM"
const PLACE_ALIASES: Record<string, string> = { CHITTAGONG: 'CHATTOGRAM', BOMBAY: 'MUMBAI', MADRAS: 'CHENNAI', CALCUTTA: 'KOLKATA', SAIGON: 'HO CHI MINH' };
function placeKey(place: string): string {
  let first = (place || '').toUpperCase().split(',')[0].replace(/\b(?:SEA\s*)?PORT\b|\bBY\s+(?:SEA|AIR|ROAD)\b|[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  Object.entries(PLACE_ALIASES).forEach(([oldName, newName]) => { first = first.replace(oldName, newName); });
  return first;
}

/** Port as it goes on the documents: the LC's port, unless the LC only says "any port", then the actual one. */
function docPort(lcPort: string | undefined, actualPort: string | undefined, country: string): string {
  const lcClean = normalizePort((lcPort || '').replace(/\s+BY\s+(?:SEA|AIR|ROAD)\b/i, ''));
  const generic = !lcClean || /\bANY\b/.test(lcClean);
  const port = generic ? normalizePort(actualPort || '') || lcClean : lcClean;
  if (port && country && !generic && !port.includes(country)) return `${port}, ${country}`;
  return port;
}

/** Inserts "COUNTRY OF ORIGIN: INDIA" under the shipping mark and the container/seal no. */
function buildMarks(baseMarks: string, needsOrigin: boolean, containerSeal?: string): string {
  const lines = (baseMarks || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (needsOrigin && !lines.some(l => /COUNTRY\s+OF\s*(?:ORIGIN)?/i.test(l))) {
    lines.splice(Math.min(1, lines.length), 0, 'COUNTRY OF ORIGIN: INDIA');
  }
  if (containerSeal) {
    const idx = lines.findIndex(l => /^CONTAINER\s*NO/i.test(l));
    if (idx === -1) lines.push('CONTAINER NO/SEAL NO :', containerSeal);
    else if (!lines.slice(idx).join(' ').includes(containerSeal)) lines.splice(idx + 1, 0, containerSeal);
  }
  return lines.join('\n');
}

/** "INFO(AT)UNIONINSURANCEBD.COM" / "rd(AT)weberheusser-yarns.com" -> real addresses. */
function deobfuscateEmails(text: string): string {
  return (text || '').replace(/([A-Z0-9._%+-]+)\s*[(\[]\s*AT\s*[)\]]\s*([A-Z0-9.-]+\.[A-Z]{2,})/gi, (_m, user: string, domain: string) => `${user}@${domain}`.toLowerCase());
}

function findEmails(text: string): string[] {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

/** Splits a "...TO THE APPLICANT E-MAIL:x, BANK... E-MAIL:y AND TO INSURANCE COMPANY: ... E-MAIL:z" clause into addressees. */
function parseEmailRecipients(clauseText: string): Array<{ party: string; email: string }> {
  const out: Array<{ party: string; email: string }> = [];
  const re = /E-?\s*MAIL\s*[:\-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  let prevEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clauseText))) {
    let party = clauseText.slice(prevEnd, m.index);
    const toIdx = party.search(/\bTO\s*(?:THE\s+)?(?:APPLICANT|INSURANCE\s+COMPANY)\b|\bINSURANCE\s+COMPANY\s*:/i);
    if (toIdx >= 0) party = party.slice(toIdx);
    party = party
      .replace(/^.*?\b(?:ADVISED|SENT)\s+BY\s+\w+\s+/i, '')
      .replace(/^\s*(?:AND\s+)?TO\s+(?:THE\s+)?/i, '')
      .replace(/^INSURANCE\s+COMPANY\s*:\s*/i, '')
      .replace(/^[\s,;:]+|[\s,;:]+$/g, '');
    out.push({ party, email: m[1] });
    prevEnd = m.index + m[0].length;
  }
  return out;
}

/** "DECLARATION OF SHIPMENT TO BE MADE TO UNION INSURANCE CO. LTD, HEAD OFFICE: ... BANGLADESH.EMAIL- x@y QUOTING ..." */
function parseDeclarationRecipients(clauseText: string): Array<{ party: string; email: string }> {
  const m = clauseText.match(/DECLARATION\s+OF\s+SHIPMENT\s+TO\s+BE\s+MADE\s+TO\s+(.*?)\s*\.?\s*E-?\s*MAIL\s*[:\-]?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return m ? [{ party: m[1].replace(/[.,\s]+$/, ''), email: m[2] }] : [];
}

/** Consignee block as LC 46A asks for it ("TO THE ORDER OF <bank>" + bank BIN). */
export function buildLcConsignee(lc: LCDetails, clauses: LCClause[] = allLCClauses(lc)): string {
  const country = destinationCountry(lc);
  const party = findConsigneeParty(clauses)
    || [lc.issuingBank?.name, lc.issuingBank?.address, lc.issuingBank?.city].filter(Boolean).join(', ');
  const lines = ['TO THE ORDER OF', ...formatPartyBlock(party, country)];
  const ids = extractLCIdentifiers(lc, clauses);
  if (ids.issuingBankBin) lines.push(`BIN NO. ${ids.issuingBankBin}`);
  return lines.join('\n');
}

/** Incoterm (45A), LC reference line and tenor (42C) for the "Terms of Delivery and Payment" box. */
export function buildLcTerms(lc: LCDetails): { incoterm: string; lcLine: string; tenor: string; block: string } {
  const incoterm = extractIncotermLine(lc);
  const tenorRaw = (lc.tenor || '').replace(/[.\s]+$/, '').trim();
  const tenor = tenorRaw ? (/^AT\b/i.test(tenorRaw) ? tenorRaw.toUpperCase() : `AT ${tenorRaw.toUpperCase()}`) : '';
  const lcLine = lc.lcNumber ? `LC NO.${lc.lcNumber} DATE ${toSwiftDate(lc.issueDate)}` : '';
  const block = [[incoterm, lcLine].filter(Boolean).join('\n'), tenor].filter(Boolean).join('\n\n');
  return { incoterm, lcLine, tenor, block };
}

/**
 * B/L reference lines kept in their own fields (export LC/SC, LC no., cover note, BINs) that the
 * goods description does not already carry — so no renderer prints them twice.
 */
export function blExtraLines(bl: Pick<BillOfLadingFinal, 'goodsDescription' | 'exportLcSclNo' | 'lcNumber' | 'lcDate' | 'insuranceCoverNote' | 'vatApplicant' | 'vatIssuingBank' | 'hsCodeNo' | 'tinNo' | 'ircNo' | 'binNo' | 'underBond'>): string[] {
  const desc = (bl.goodsDescription || '').toUpperCase().replace(/\s+/g, ' ');
  const lcLine = bl.lcNumber ? `LETTER OF CREDIT NUMBER ${bl.lcNumber} DATE ${bl.lcDate || ''}` : '';
  return [
    lcLine,
    ...referenceTailLines({
      hsCode: bl.hsCodeNo || '', tin: bl.tinNo || '', irc: bl.ircNo || '', bin: bl.binNo || '',
      underBond: !!bl.underBond,
      coverNote: bl.insuranceCoverNote || '', exportLcSc: bl.exportLcSclNo || '',
      vatApplicant: bl.vatApplicant || '', vatIssuingBank: bl.vatIssuingBank || ''
    })
  ].filter(l => l && !desc.includes(l.toUpperCase().replace(/\s+/g, ' ')));
}

/** "Pay to the order of" text on the bill of exchange for a negotiating bank. */
export function bankPayToText(bank: BankProfile): string {
  return [bank.bankName, bank.branch, bank.city].filter(Boolean).join(', ').replace(/,\s*BRANCH CODE/i, ' BRANCH CODE');
}

// ---------------------------------------------------------------------------
// Final document set
// ---------------------------------------------------------------------------

export function generateFinalDocumentSet(
  draftData: ExportData,
  lcDetails: LCDetails,
  amendments: LCAmendment[] = [],
  bankProfile?: BankProfile,
  shipment?: ShipmentTransportDetails | null
): FinalDocumentSet {
  const lc = lcDetails;
  const clauses = allLCClauses(lc, amendments).map(c => ({ ...c, verbatimText: deobfuscateEmails(c.verbatimText) }));
  const clauseText = clauses.map(c => c.verbatimText).join('\n');
  const ids = extractLCIdentifiers(lc, clauses);
  const refLines = buildLcReferenceLines(lc, ids, clauses);
  const refParts = lcReferenceParts(lc, ids, clauses);
  const lcDate = toSwiftDate(lc.issueDate);
  const country = destinationCountry(lc);
  const currency = draftData.currency || lc.currency || 'USD';

  // Name as in LC 59; Lahoti's own standard address block (UCP 600 art. 14(j) allows a different layout).
  const beneficiaryName = (lc.beneficiary?.name || draftData.exporter?.name || '').replace(/\.\s*$/, '');
  const exporter = mergeExporter({
    ...draftData.exporter,
    name: beneficiaryName,
    address: /LAHOTI\s+OVERSEAS/i.test(beneficiaryName)
      ? LAHOTI_EXPORTER.address
      : formatAddressLines(lc.beneficiary?.address || draftData.exporter?.address || '').join('\n')
  });

  const pol = docPort(lc.portOfLoading, draftData.portOfLoading, 'INDIA');
  const pod = docPort(lc.portOfDischarge, draftData.portOfDischarge, country);
  // Final destination / place of receipt: LC 44B / 44A when stated, else the pre-shipment invoice.
  // A pre-shipment final destination that only repeats the port of discharge takes the LC's port wording.
  const samePlace = (x: string, y: string) => {
    const a = placeKey(x), b = placeKey(y);
    return !!a && !!b && (a.includes(b) || b.includes(a));
  };
  const draftFinal = normalizePort(draftData.finalDestination || '');
  const finalDest = lc.placeOfFinalDestination
    ? normalizePort(lc.placeOfFinalDestination)
    : draftFinal && !samePlace(draftFinal, pod) ? draftFinal : pod;
  const placeOfReceipt = (lc.placeOfReceipt || draftData.placeOfReceiptByPreCarrier || '').trim().toUpperCase();
  const preCarriageBy = (draftData.preCarriageBy || '').trim().toUpperCase();
  const transport = detectTransportMode(pol, pod, draftData.vesselFlightNo || '', lc);
  const transportDocLabel = transport.isRoad ? 'LR' : 'B/L';

  // ---- shipment facts (pre-shipment invoice + transport document) ----
  const item = draftData.lineItems[0] || ({} as ExportLineItem);
  const qty = Number(draftData.totalQuantity) || Number(item.quantity) || 0;
  const qtyUom = singularUom(item.uom || lc.goodsQuantityUom || '');
  const amount = Number(draftData.totalAmount) || 0;
  const rate = Number(item.rate) || Number(lc.unitPrice) || (qty ? Math.round((amount / qty) * 10000) / 10000 : 0);
  const pkgCount = Number(item.noOfCartons) || Number(draftData.totalCartons) || parseInt(String(item.noAndKindOfPkg || '').replace(/,/g, ''), 10) || 0;
  const pkgKind = (item.packageKind || inferPackageKind(item.noAndKindOfPkg) || '').toUpperCase();
  const pkgText = pkgCount ? `${pkgCount} ${pkgKind}` : (item.noAndKindOfPkg || '');
  const grossWt = draftData.totalGrossWtKg ?? null;
  const netWt = draftData.totalNetWtKg ?? null;
  const containerSeal = shipment?.containerSealNo || '';

  const tdNo = shipment?.transportDocNo || '';
  const tdDate = shipment?.transportDocDate || '';
  const otherReference = tdNo ? `${transportDocLabel} No. ${tdNo} DT. ${formatTradeDate(tdDate, '/')}` : (draftData.otherReference || '');
  const docsDate = shipment?.documentsDate || tdDate || draftData.invoiceDate;
  const vesselForDocs = transport.isRoad ? 'BY ROAD' : (shipment?.vehicleOrVessel || draftData.vesselFlightNo || '');

  // ---- LC-driven wording ----
  const needsOriginOnPackages = /COUNTRY\s+OF\s+ORIGIN\s+(?:TO|MUST|SHOULD|SHALL)\s+BE\s+(?:CLEARLY\s+)?(?:MENTIONED|MARKED|SHOWN|STATED)/i.test(clauseText);
  const marks = buildMarks(item.marksAndNos || '', needsOriginOnPackages, containerSeal);

  // ---- goods: which of the LC's 45A products this shipment carries ----
  const shippedItems = shippedLcItems(lc, draftData);
  const multi = shippedItems.length
    ? buildMultiItemGoodsDescription(lc, shippedItems.map(s => ({ lcIndex: s.lcIndex, quantity: s.quantity, uom: s.uom })))
    : null;
  const goodsBlock = multi
    ? [...multi.perItem, ...multi.common].join('\n')
    : buildShipmentGoodsDescription(lc.goodsDescriptionVerbatim || item.description || '', qty, item.uom || lc.goodsQuantityUom || '');
  const goodsWithRefs = [goodsBlock, ...refLines].join('\n');

  // Buyer's order no. = the proforma invoice in 45A; with several, the one this shipment's order belongs to
  const proformas = Array.from((lc.goodsDescriptionVerbatim || '').matchAll(/(?:PROFORMA\s+INVOICE\s+NO\.?\s*[:\-]?\s*|^\.?\s*)([A-Z]{1,3}\/\d{3,5}[A-Z0-9]*\/\d{2}-\d{2})/gim)).map(m => m[1]);
  const orderSeq = (draftData.buyersOrderNo || '').match(/\/(\d{3,5})/)?.[1];
  const proformaNo = (proformas.length > 1 && orderSeq && proformas.find(p => p.includes(`/${orderSeq}`))) || proformas[0];
  const buyersOrderNo = proformaNo || lc.contractReference || draftData.buyersOrderNo || '';

  const lcTerms = buildLcTerms(lc);
  const incoterm = lcTerms.incoterm || (draftData.termsOfDelivery || '').split('\n')[0].trim();
  const tenor = lcTerms.tenor;
  const lcLine = lcTerms.lcLine;

  // ---- parties ----
  const consigneeParty = findConsigneeParty(clauses);
  const consignee = buildLcConsignee(lc, clauses);

  const applicantBlock = applicantBlockLines(lc, ids.applicantBin, country).join('\n');
  const notifyParts = findNotifyParts(clauses);
  const notifyBlocks = notifyParts.map(p => {
    if (/^(?:THE\s+)?APPLICANT\b/i.test(p)) return applicantBlock;
    if (/^(?:THE\s+)?ISSUING\s+BANK$/i.test(p)) {
      const bankParty = consigneeParty || [lc.issuingBank?.name, lc.issuingBank?.address, lc.issuingBank?.city].filter(Boolean).join(', ');
      return [...formatPartyBlock(bankParty, country), ...(ids.issuingBankBin ? [`BIN NO. ${ids.issuingBankBin}`] : [])].join('\n');
    }
    const binTok = p.match(/\bBIN\s*(?:NO\.?)?\s*[:\-]?\s*[\d\-]+/i)?.[0];
    const body = binTok ? p.replace(binTok, '') : p;
    return [...formatPartyBlock(body, country), ...(binTok ? [binTok.replace(/\s+/g, ' ').trim()] : [])].join('\n');
  });
  const notify1 = notifyBlocks[0] || applicantBlock;
  const notify2 = notifyBlocks[1] || '';

  // ---- invoice certifications & FOB / freight ----
  const invCertifications: string[] = [];
  if (/CERTIFYING\s+(?:THAT\s+)?(?:THE\s+)?(?:MERCHANDISE|GOODS)\s+(?:ARE|IS|TO\s+BE)\s+OF\s+INDIA[N]?\s+ORIGIN/i.test(clauseText)) {
    invCertifications.push('WE HEREBY CERTIFYING MERCHANDISE ARE OF INDIA ORIGIN.');
  }
  // "BENEFICIARY MUST CERTIFY ON/IN THE INVOICE (TO THE EFFECT) THAT ..." -> that statement, as written
  const certifyOnInvoice = clauseText.replace(/\s+/g, ' ').match(/CERTIFY\s+(?:ON|IN)\s+THE\s+INVOICE\s+(?:TO\s+THE\s+EFFECT\s+)?THAT\s+(.*?\.)(?=\s|$)/i);
  if (certifyOnInvoice) {
    invCertifications.push(`WE HEREBY CERTIFYING THAT ${certifyOnInvoice[1].replace(/\s*,\s*/g, ', ').toUpperCase()}`);
  }

  const fobFreightRequired = /FOB\s+VALUE\s+AND\s+FREIGHT/i.test(clauseText);
  const binOnBl = /BIN\b[\s\S]*?MENTIONED\s+IN\s+(?:THE\s+)?BILL\s+OF\s+LADING/i.test(clauseText);
  const freightAmount = draftData.freightAmount != null ? Number(draftData.freightAmount) : undefined;
  const insuranceAmount = Number(draftData.insuranceAmount) || 0;
  const fobValue = freightAmount != null ? Math.round((amount - freightAmount - insuranceAmount) * 100) / 100 : undefined;
  let fobFreightBlock = '';
  if (fobFreightRequired) {
    fobFreightBlock = freightAmount != null
      ? `FOB VALUE: ${currency} ${fobValue!.toFixed(2)}\nFREIGHT CHARGE: ${currency} ${freightAmount.toFixed(2)}`
      : `FOB VALUE: ${currency} ________\nFREIGHT CHARGE: ${currency} ________`;
  }

  const customsEntryLine = shipment?.customsEntryNo
    ? `B.C.P. ENTRY NO. ${shipment.customsEntryNo}${shipment.customsEntryDate ? `  DT: ${formatTradeDate(shipment.customsEntryDate, '.')}` : ''}`
    : '';

  const invoiceTail = [
    [invCertifications.map(c => wrapToInvoiceColumn(c).join('\n')).join('\n\n'), fobFreightBlock].filter(Boolean).join('\n'),
    customsEntryLine ? `\n${customsEntryLine}` : ''
  ];
  const invoiceDescription = [goodsWithRefs, ...invoiceTail].filter(Boolean).join('\n\n');

  const traces = (docType: string, fallbackTarget: string): AppliedClauseTrace[] => clauses
    .filter(c => {
      const docs = (c.appliesToDocument || c.affectedDocuments || []) as string[];
      return docs.includes(docType) || docs.includes('all');
    })
    .map(c => ({
      clauseId: c.id,
      field: c.field,
      verbatimText: c.verbatimText,
      targetField: c.targetField || fallbackTarget,
      summary: c.instructionSummary || c.plainEnglishSummary
    }));

  const amountInWords = numberToWords(amount, currency);
  const pkgDisplay = pkgText;

  // ---- negotiating bank for the Bill of Exchange ----
  const bank = bankProfile
    || sampleBankProfiles.find(b => b.id === shipment?.negotiatingBankId)
    || sampleBankProfiles[0];
  const payToOrderOf = bankPayToText(bank);

  // ---- beneficiary certificates (one per LC clause that asks for one) ----
  const masterFootnote = [
    `INVOICE NO. ${draftData.invoiceNo}`,
    `LETTER OF CREDIT NO. ${lc.lcNumber} DATE ${lcDate}`,
    refLines.join(' '),
    'COUNTRY OF ORIGIN: INDIA'
  ].join('\n');
  const certDate = formatTradeDate(docsDate, '.');
  const signatoryCompany = `For ${exporter.name}`;
  const coverNoteMatch = clauseText.match(/COVER\s*NOTE\s*(?:NO\.?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]+)\s*,?\s*(?:DTD\.?|DATED)?\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})?/i);
  const coverNote = coverNoteMatch?.[1] || '';
  const coverNoteDate = coverNoteMatch?.[2] || '';
  const coverNoteLine = coverNote ? `INSURANCE COVER NOTE NO. ${coverNote}${coverNoteDate ? ` DTD: ${coverNoteDate}` : ''}` : '';
  const goodsNarrationFull = goodsBlock.split('\n').join(' ');
  const particulars = [
    { label: 'DATE OF SHIPMENT', value: formatTradeDate(tdDate, '.') },
    { label: 'ACTUAL VALUE OF GOODS SHIPPED', value: `${currency} ${amount.toFixed(2)}` },
    { label: 'QUANTITY', value: `${qty.toFixed(3)} ${qtyUom === 'YARD' ? 'YDS' : pluralUom(qtyUom)}` },
    { label: 'PORT OF LOADING', value: pol },
    { label: 'PORT OF DISCHARGE', value: pod },
    transport.isRoad
      ? { label: 'TRUCK RECEIPT /LR NUMBER AND DATE', value: tdNo ? `${tdNo} DT. ${formatTradeDate(tdDate, '/')}` : '' }
      : { label: 'B/L NUMBER AND DATE', value: tdNo ? `${tdNo} DT. ${formatTradeDate(tdDate, '/')}` : '' },
    ...(!transport.isRoad && vesselForDocs ? [{ label: 'VESSEL', value: vesselForDocs }] : []),
    ...(containerSeal ? [{ label: 'CONTAINER NO./SEAL NO.', value: containerSeal }] : [])
  ];

  const baseCert = (over: Partial<BeneficiaryCertFinal> & Pick<BeneficiaryCertFinal, 'id' | 'title' | 'clauseRef' | 'certType' | 'text'>, clause?: LCClause): BeneficiaryCertFinal => ({
    exporter,
    docHeaderDate: certDate,
    invoiceNo: draftData.invoiceNo,
    lcNumber: lc.lcNumber,
    lcDate,
    footnoteDetails: masterFootnote,
    closingNote: `${signatoryCompany}\n\nAuthorised Signatory`,
    signatoryName: 'Authorised Signatory',
    signatoryCompany,
    appliedClauseTraces: clause ? [{
      clauseId: clause.id,
      field: clause.field,
      verbatimText: clause.verbatimText,
      targetField: 'beneficiaryCertificate',
      summary: clause.instructionSummary || clause.plainEnglishSummary || ''
    }] : [],
    ...over
  });

  const emailCopy = (id: string, clause: LCClause, recipients: Array<{ address: string; email?: string }>, subject: string, text: string): BeneficiaryCertFinal =>
    baseCert({
      id,
      docTitle: 'EMAIL COPY',
      title: `EMAIL COPY - ${subject}`,
      clauseRef: clause.id,
      certType: 'email_advice_enclosed',
      recipients: recipients.map(r => ({ address: r.address })),
      emailDetails: {
        from: LAHOTI_DOCS_EMAIL,
        sent: certDate,
        to: recipients.map(r => r.email).filter(Boolean).join('; '),
        subject
      },
      text,
      closingNote: `Best Regards\n${exporter.name}`,
      signatoryName: '',
      signatoryCompany: exporter.name
    }, clause);

  const recipientFor = (r: { party: string; email: string }) => {
    if (/^(?:THE\s+)?APPLICANT\b/i.test(r.party) || !r.party) {
      return { address: [lc.applicant?.name, ...formatAddressLines(lc.applicant?.address || '', country)].filter(Boolean).join('\n'), email: r.email };
    }
    return { address: formatPartyBlock(r.party, country).join('\n'), email: r.email };
  };

  const beneficiaryCertificates: BeneficiaryCertFinal[] = [];
  clauses.forEach(c => {
    const t = c.verbatimText.replace(/\s+/g, ' ').trim();
    const key = c.id.replace(/\W/g, '');

    // "BENEFICIARY'S CERTIFICATE STATING THAT ..."
    const stating = t.match(/BENEFICIARY'?S?\s+CERTIFICATE\s+(?:STATING|CERTIFYING|CONFIRMING)\s+THAT\s+(.*)$/i);
    if (stating) {
      const body = stating[1].replace(/\s+OR\s+E-?\s*CERTIFICATE\s+OF\s+ORIGIN/i, '').replace(/[.\s]+$/, '');
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'BENEFICIARY CERTIFICATE', title: `BENEFICIARY CERTIFICATE (${c.id})`,
        clauseRef: c.id, certType: 'custom', text: `WE HEREBY STATING THAT ${body.toUpperCase()}.`
      }, c));
      return;
    }

    // Shipment advice to insurance company / applicant / bank by e-mail
    if (/INSURANCE/i.test(t) && /ADVISED|ADVICE|DECLARATION\s+OF\s+SHIPMENT/i.test(t) && findEmails(t).length) {
      const recips = (/DECLARATION\s+OF\s+SHIPMENT/i.test(t) ? parseDeclarationRecipients(t) : parseEmailRecipients(t)).map(recipientFor);
      const ordered = [...recips.filter(r => /INSURANCE/i.test(r.address)), ...recips.filter(r => !/INSURANCE/i.test(r.address))];
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}-advice`, docTitle: 'SHIPMENT ADVICE', title: `SHIPMENT ADVICE (${c.id})`,
        clauseRef: c.id, certType: 'shipment_advice_dispatch',
        recipients: ordered, insuranceCoverNote: coverNote, insuranceCoverNoteDate: coverNoteDate,
        goodsNarration: goodsNarrationFull, particulars,
        text: 'PLEASE NOTE BELOW DETAILS OF SHIPMENT -',
        postTextInstruction: 'PLEASE INSURE THE SHIPMENT.\nENCLOSED HEREWITH E-MAIL COPY.'
      }, c));
      beneficiaryCertificates.push(emailCopy(`bc-${key}-email`, c, ordered,
        `Shipment Advice our invoice no: ${draftData.invoiceNo}`,
        `Please Find Attached herewith Shipment Advice for our INV NO. ${draftData.invoiceNo} UNDER\n\n${[coverNoteLine, `L/C NO. ${lc.lcNumber} DATE ${lcDate}`].filter(Boolean).join('\n')}`));
      return;
    }

    // One set of non-negotiable documents to the applicant by e-mail
    if (/NON-?\s*NEGOTIABLE/i.test(t) && findEmails(t).length) {
      const email = findEmails(t)[0];
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'BENEFICIARY CERTIFICATE', title: `BENEFICIARY CERTIFICATE - NON-NEGOTIABLE DOCUMENTS (${c.id})`,
        clauseRef: c.id, certType: 'non_negotiable_docs',
        text: `WE HEREBY CERTIFY THAT ONE COMPLETE SET OF NON-NEGOTIABLE SHIPPING DOCUMENTS TO THE APPLICANT BY E-MAIL: ${email}`,
        postTextInstruction: 'EMAIL COPY ENCLOSED'
      }, c));
      beneficiaryCertificates.push(emailCopy(`bc-${key}-email`, c, [recipientFor({ party: 'APPLICANT', email })],
        `ONE COMPLETE SET OF NON-NEGOTIABLE DOCUMENTS FOR OUR INV. NO. ${draftData.invoiceNo}`,
        `Please find attached herewith one set of non-negotiable documents for our invoice no. ${draftData.invoiceNo}, emailing the date of shipment.`));
      return;
    }

    // Shipping advice to the issuing bank after shipment
    const shipAdv = t.match(/SEND\s+THE\s+SHIPPING\s+ADVICE\s+TO\s+(.*?)\s+THROUGH\s+E-?\s*MAIL\s*[:\-]?\s*(\S+@\S+?)\s/i);
    if (shipAdv) {
      const party = shipAdv[1].replace(/[\s,]+$/, '');
      const email = shipAdv[2].replace(/[.,;]+$/, '');
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'BENEFICIARY CERTIFICATE', title: `BENEFICIARY CERTIFICATE - SHIPPING ADVICE (${c.id})`,
        clauseRef: c.id, certType: 'custom',
        text: `WE HEREBY CONFIRMING THAT THE SHIPPING ADVICE TO ${party.toUpperCase()} THROUGH E-MAIL: ${email.toUpperCase()} AFTER SHIPMENT WITH BELOW DETAILS.`
      }, c));
      // "SONALI BANK PLC., LOCAL OFFICE" is the issuing bank: use its full address from the consignee clause
      const bankName = party.split(/[.,]/)[0].trim();
      const fullParty = consigneeParty && consigneeParty.toUpperCase().startsWith(bankName.toUpperCase()) && consigneeParty.length > party.length
        ? consigneeParty
        : party;
      const recip = { address: formatPartyBlock(fullParty, country).join('\n'), email };
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}-advice`, docTitle: 'SHIPPING ADVICE', title: `SHIPPING ADVICE (${c.id})`,
        clauseRef: c.id, certType: 'shipment_advice_dispatch',
        recipients: [recip], insuranceCoverNote: coverNote, insuranceCoverNoteDate: coverNoteDate,
        goodsNarration: goodsNarrationFull, particulars,
        text: 'PLEASE NOTE BELOW DETAILS OF SHIPMENT -',
        postTextInstruction: 'ENCLOSED HEREWITH E-MAIL COPY.'
      }, c));
      beneficiaryCertificates.push(emailCopy(`bc-${key}-email`, c, [recip],
        `Shipping Advice our invoice no: ${draftData.invoiceNo}`,
        `Please Find Attached herewith Shipping Advice for our INV NO. ${draftData.invoiceNo} UNDER\n\n${[coverNoteLine, `L/C NO. ${lc.lcNumber} DATE ${lcDate}`].filter(Boolean).join('\n')}`));
      return;
    }

    if (/FOB\s+VALUE\s+AND\s+FREIGHT/i.test(t) && c.field === '47A') {
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'BENEFICIARY CERTIFICATE', title: `BENEFICIARY CERTIFICATE - FOB & FREIGHT (${c.id})`,
        clauseRef: c.id, certType: 'custom',
        text: `WE HEREBY CONFIRMING THAT ON INVOICE CLEARLY MENTIONED FOB VALUE AND FREIGHT CHARGES.\n` +
          (freightAmount != null
            ? `FREIGHT CHARGES: ${currency} ${freightAmount.toFixed(2)}\nFOB VALUE: ${currency} ${fobValue!.toFixed(2)}`
            : `FREIGHT CHARGES: ${currency} ________\nFOB VALUE: ${currency} ________`)
      }, c));
      return;
    }

    if (/COUNTRY\s+OF\s+ORIGIN\s+(?:TO|MUST|SHOULD|SHALL)\s+BE\s+(?:MENTIONED|MARKED|SHOWN|STATED)/i.test(t)) {
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'BENEFICIARY CERTIFICATE', title: `BENEFICIARY CERTIFICATE - COUNTRY OF ORIGIN (${c.id})`,
        clauseRef: c.id, certType: 'country_of_origin',
        text: 'WE HEREBY CERTIFY THAT THE COUNTRY OF ORIGIN IS MENTIONED IN ALL DOCUMENTS.'
      }, c));
      return;
    }

    // "PRE-SHIPMENT INSPECTION CERTIFICATE ISSUED BY BENEFICIARY" is a document Lahoti issues itself
    if (/INSPECTION\s+CERTIFICATE\s+ISSUED\s+BY\s+(?:THE\s+)?BENEFICIARY/i.test(t)) {
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'PRE-SHIPMENT INSPECTION CERTIFICATE', title: `PRE-SHIPMENT INSPECTION CERTIFICATE (${c.id})`,
        clauseRef: c.id, certType: 'custom',
        text: `WE HEREBY CERTIFY THAT THE GOODS UNDER OUR INVOICE NO. ${draftData.invoiceNo} WERE INSPECTED BY US BEFORE SHIPMENT AND FOUND IN ORDER AS PER ${buyersOrderNo ? `PROFORMA INVOICE NO. ${buyersOrderNo}` : 'THE PROFORMA INVOICE'} AND THE L/C TERMS.`
      }, c));
      return;
    }

    // "<condition> MUST BE ... A CERTIFICATE (ISSUED BY THE BENEFICIARY) TO THIS EFFECT MUST ACCOMPANY ..."
    const effect = t.match(/^(.*?)\.?\s*A\s+CERTIFICATE\s+(?:ISSUED\s+BY\s+THE\s+BENEFICIARY\s+)?TO\s+THIS\s+EFFECT/i);
    if (effect && !/INSURANCE|NON-?\s*NEGOTIABLE|SHIPPING\s+ADVICE/i.test(t)) {
      const statement = effect[1]
        .replace(/\b(?:MUST|SHOULD|SHALL)\s+BE\b|\bTO\s+BE\b/i, 'HAS BEEN')
        .replace(/\s*\/\s*/g, '/')
        .replace(/[.\s]+$/, '')
        .toUpperCase();
      beneficiaryCertificates.push(baseCert({
        id: `bc-${key}`, docTitle: 'BENEFICIARY CERTIFICATE', title: `BENEFICIARY CERTIFICATE (${c.id})`,
        clauseRef: c.id, certType: /COUNTRY\s+OF\s+ORIGIN/i.test(statement) ? 'country_of_origin' : 'custom',
        text: `WE HEREBY CERTIFY THAT ${statement}.`
      }, c));
    }
  });

  const cooGoods = [
    `${pkgDisplay}, ${goodsBlock.split('\n').join(' ').replace(/[.,\s]+$/, '')}${ids.hsCode ? `, HS Code: ${ids.hsCode}` : ''}`,
    refLines.join(' '),
    invCertifications.length ? `WE CERTIFYING MERCHANDISE ARE OF INDIA ORIGIN ${lcLine}` : ''
  ].filter(Boolean).join('\n');

  return {
    commercialInvoice: {
      exporter,
      invoiceNo: draftData.invoiceNo,
      invoiceDate: draftData.invoiceDate,
      irnno: draftData.irnno || undefined,
      otherReference,
      consignee,
      buyerIfOtherThanConsignee: applicantBlock,
      notifyParty: notify1,
      buyersOrderNo,
      buyersOrderDate: '',
      lcReference: lc.lcNumber,
      lcDateReference: lcDate,
      termsOfDelivery: [incoterm, lcLine].filter(Boolean).join('\n'),
      paymentTenorLine: tenor,
      tenor,
      countryOfOrigin: 'INDIAN ORIGIN',
      countryOfFinalDestination: country || draftData.countryOfFinalDestination,
      preCarriageBy,
      placeOfReceipt,
      vesselFlightNo: vesselForDocs,
      portOfLoading: pol,
      portOfDischarge: pod,
      finalDestination: finalDest,
      currency,
      lineItems: multi && shippedItems.length > 1
        // One row per LC product shipped (LC price); the lines 45A states for all products close the last row
        ? shippedItems.map((s, k) => ({
          ...item,
          marksAndNos: k === 0 ? marks : '',
          noAndKindOfPkg: k === 0 ? pkgDisplay : '',
          description: k === shippedItems.length - 1
            ? [[multi.perItem[k], ...multi.common, ...refLines].join('\n'), ...invoiceTail].filter(Boolean).join('\n\n')
            : multi.perItem[k],
          quantity: s.quantity,
          uom: s.uom,
          unitOfRate: s.uom,
          rate: s.unitPrice,
          amount: s.amount
        }))
        : [{
          ...item,
          marksAndNos: marks,
          noAndKindOfPkg: pkgDisplay,
          description: invoiceDescription,
          quantity: qty,
          uom: qtyUom,
          unitOfRate: qtyUom,
          rate: shippedItems.length === 1 ? shippedItems[0].unitPrice : rate,
          amount
        }],
      totalQuantity: qty,
      totalAmount: amount,
      amountInWords,
      declarationText: INVOICE_DECLARATION,
      additionalDeclarations: [],
      rexNumber: '',
      fobValue,
      freightAmount,
      showFobFreightSplit: fobFreightRequired,
      exchangeRate: draftData.exchangeRate,
      showExchangeRate: false,
      appliedClauseTraces: traces('invoice', 'invoice.description')
    },
    packingList: {
      exporter,
      invoiceNo: draftData.invoiceNo,
      invoiceDate: draftData.invoiceDate,
      exporterRef: '',
      buyersOrderNo,
      buyersOrderDate: '',
      otherReference,
      consignee,
      buyerIfOtherThanConsignee: applicantBlock,
      countryOfOrigin: 'INDIAN ORIGIN',
      countryOfFinalDestination: country || draftData.countryOfFinalDestination,
      preCarriageBy,
      placeOfReceipt,
      vesselFlightNo: vesselForDocs,
      portOfLoading: pol,
      portOfDischarge: pod,
      finalDestination: finalDest,
      termsOfDelivery: [incoterm, lcLine, '', tenor].join('\n').trim(),
      marksAndNos: marks,
      containerNo: containerSeal,
      noAndKindOfPkg: pkgDisplay,
      goodsDescriptionVerbatim: goodsWithRefs,
      remarks: '',
      bakedPalletQuote: '',
      packingRows: [{
        lotNo: '01',
        count: '',
        noOfUnits: pkgDisplay,
        containerSealNo: containerSeal,
        netWtKg: netWt,
        grossWtKg: grossWt
      }],
      totalNetWtKg: netWt,
      totalGrossWtKg: grossWt,
      totalCartonsOrPackages: pkgDisplay,
      appliedClauseTraces: traces('packing_list', 'packingList.description')
    },
    billOfLading: {
      exporter,
      shipper: exporter,
      invoiceNo: draftData.invoiceNo,
      invoiceDate: draftData.invoiceDate,
      consignee,
      consigneeVatBin: '',
      buyerIfOtherThanConsignee: applicantBlock,
      notifyParty1: notify1,
      notifyParty1VatBin: '',
      notifyParty2: notify2,
      notifyParty2VatBin: '',
      vesselFlightNo: transport.isRoad ? '' : (shipment?.vehicleOrVessel || ''),
      portOfLoading: pol,
      portOfDischarge: pod,
      finalDestination: finalDest,
      marksAndNos: marks,
      packagesCountAndKind: pkgDisplay,
      goodsDescription: [goodsBlock, refParts.lcLine].join('\n'),
      totalGrossWtKg: grossWt,
      totalNetWtKg: netWt,
      containerSealNos: containerSeal,
      freightStatus: /FREIGHT\s+COLLECT/i.test(clauseText) ? 'FREIGHT COLLECT' : 'FREIGHT PREPAID',
      shippingBillNo: shipment?.shippingBillNo || '',
      shippingBillDate: shipment?.shippingBillDate || '',
      freeDetentionClause: '',
      agentDetailsAtDestination: 'AGENT ADDRESS/TEL/FAX NO. AT DESTINATION PORT',
      blWeightCheckClause: 'CHECK NET/GR WT/ NO. OF CARTON AS PER SHIPPING BILL',
      lcNumber: lc.lcNumber,
      lcDate,
      insuranceCoverNote: refParts.coverNote,
      exportLcSclNo: refParts.exportLcSc,
      vatApplicant: refParts.vatApplicant || (binOnBl ? ids.applicantBin : ''),
      vatIssuingBank: refParts.vatIssuingBank || (binOnBl ? ids.issuingBankBin : ''),
      hsCodeNo: refParts.hsCode,
      tinNo: refParts.tin,
      ircNo: refParts.irc,
      binNo: refParts.bin,
      underBond: refParts.underBond,
      cleanOnBoardClause: !transport.isRoad,
      appliedClauseTraces: traces('bill_of_lading', 'billOfLading.instructions')
    },
    certificateOfOrigin: {
      exporter,
      invoiceNo: draftData.invoiceNo,
      invoiceDate: formatTradeDate(draftData.invoiceDate, '-'),
      consignee: applicantBlock,
      countryOfOrigin: 'INDIA',
      issuingAuthority: 'BOMBAY CHAMBER OF COMMERCE AND INDUSTRY',
      originDeclaration: `The undersigned hereby declare that the above details and statements are correct that all the good(s) were produced in India and that they comply with the origin requirements for export to ${country ? country.charAt(0) + country.slice(1).toLowerCase() : 'the importing country'} (Importing Country)`,
      goodsDescription: cooGoods,
      marksAndNos: marks,
      quantityWithUom: `${qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ${pluralUom(qtyUom)}`,
      grossWeightKg: grossWt,
      netWeightKg: netWt,
      portOfLoading: pol,
      portOfDischarge: pod,
      vesselFlightNo: vesselForDocs,
      containerSealNos: containerSeal,
      cartonCountOrPackages: pkgDisplay,
      hsCode: ids.hsCode,
      lcNumber: lc.lcNumber,
      lcDate,
      contractReference: buyersOrderNo,
      insuranceCoverNote: '',
      termsOfDelivery: incoterm,
      placeAndDateOfIssue: `MUMBAI, ${formatTradeDate(docsDate, '-')}`,
      vatApplicant: '',
      vatIssuingBank: '',
      appliedClauseTraces: traces('certificate_of_origin', 'coo.goodsDescription')
    },
    billOfExchange: {
      currency,
      amount,
      invoiceNo: draftData.invoiceNo,
      invoiceDate: formatTradeDate(draftData.invoiceDate, '-'),
      date: formatTradeDate(tdDate || docsDate, '-'),
      tenor: tenor || 'AT SIGHT',
      amountInWords,
      drawnUnderBank: lc.issuingBank?.name || '',
      lcNumber: lc.lcNumber,
      lcDate,
      drawee: lc.drawee || [lc.issuingBank?.swift, lc.issuingBank?.name, lc.issuingBank?.city].filter(Boolean).join('\n'),
      drawer: exporter,
      accountOf: pkgDisplay,
      packagesShippedBy: transport.isRoad ? 'BY ROAD' : (shipment?.vehicleOrVessel || 'BY SEA'),
      blAirBillRef: tdNo ? `${tdNo} DT.${formatTradeDate(tdDate, '/', true)}` : '',
      headerText: [`DRAWN UNDER DOCUMENTARY CREDIT NO : ${lc.lcNumber} DATE ${lcDate}`, refLines.join(' '), 'COUNTRY OF ORIGIN: INDIA'].join('\n'),
      payToOrderOf,
      presentingBankProfile: bank,
      appliedClauseTraces: traces('bill_of_exchange', 'billOfExchange')
    },
    beneficiaryCertificates
  };
}

export function generateComplianceChecklist(
  lcDetails: LCDetails,
  shipmentDate?: string
): ComplianceChecklist {
  const presentationDays = lcDetails.presentationPeriodDays || lcDetails.periodForPresentationDays || 21;
  const deadline = presentationDeadline(lcDetails, shipmentDate);
  const iso = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '');
  const ship = parseTradeDate(shipmentDate);
  const latest = parseTradeDate(lcDetails.latestShipmentDate);
  const addDays = (n: number) => (ship ? iso(new Date(ship.getTime() + n * 86400000)) : '');
  const clauseText = [...(lcDetails.field46AClauses || []), ...(lcDetails.field47AClauses || [])].map(c => c.verbatimText).join('\n');

  const items: ComplianceChecklist['items'] = [
    {
      id: 'chk-presentation',
      title: `Present documents within ${presentationDays} days of shipment date`,
      clauseRef: 'Field 48',
      deadline: iso(deadline),
      status: 'pending',
      description: ship
        ? `Documents must reach the negotiating bank by ${iso(deadline)} (and not after LC expiry ${lcDetails.expiryDate || ''}).`
        : 'Enter the LR / B/L date to calculate the presentation deadline.'
    },
    {
      id: 'chk-latest-shipment',
      title: 'Shipment on or before latest shipment date',
      clauseRef: 'Field 44C',
      deadline: lcDetails.latestShipmentDate || '',
      status: ship && latest ? (ship <= latest ? 'verified' : 'action_needed') : 'pending',
      description: `Latest shipment date ${lcDetails.latestShipmentDate || 'not stated'}; shipment date ${shipmentDate || 'not yet entered'}.`
    }
  ];

  if (/ADVISED\s+BY\s+COURIER|INSURANCE\s+COMPANY/i.test(clauseText)) {
    const m = clauseText.match(/WITHIN\s+(\w+)\s+DAYS\s+OF\s+SHIPMENT/i);
    const words: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10 };
    const n = m ? (Number(m[1]) || words[m[1].toUpperCase()] || 7) : 7;
    items.push({
      id: 'chk-shipment-advice',
      title: 'Shipment advice to applicant, issuing bank and insurance company',
      clauseRef: '46A',
      deadline: addDays(n),
      status: 'pending',
      description: `Send the shipment advice within ${n} days of shipment and keep a copy for the document set.`
    });
  }
  if (/NON-?\s*NEGOTIABLE/i.test(clauseText)) {
    items.push({
      id: 'chk-non-negotiable',
      title: 'One set non-negotiable documents e-mailed to applicant',
      clauseRef: '46A',
      deadline: addDays(0),
      status: 'pending',
      description: 'E-mail the non-negotiable set and attach the certificate and e-mail copy to the originals.'
    });
  }
  if (/SHIPPING\s+ADVICE/i.test(clauseText)) {
    items.push({
      id: 'chk-shipping-advice-bank',
      title: 'Shipping advice e-mailed to issuing bank after shipment',
      clauseRef: '47A',
      status: 'pending',
      description: 'Send value shipped, truck receipt / B/L no. & date and the beneficiary certificate to the issuing bank.'
    });
  }

  return {
    blDate: shipmentDate || '',
    presentationDeadline: iso(deadline),
    lcExpiryDate: lcDetails.expiryDate || '',
    allPassed: false,
    items
  };
}
