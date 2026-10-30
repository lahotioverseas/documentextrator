// LC 134626060029 (Southeast Bank / Apparel Today) lists TWO products in 45A. Checks that each
// document carries only the product(s) a shipment contains, with the LC's own wording, and that
// the LC ledger keeps a balance per product. Each check names the LC field the value comes from.
import { contract, lc, preShipment, shipment, GOODS_45A } from './fixtures/lol0087';
import { exportDataFromPreShipment, generateFinalDocumentSet, splitLcGoods, shippedLcItems, blExtraLines, mergeContractItemDescription } from '../src/lib/documentGenerators';
import { checkShipmentAgainstLC, computeLCUtilization, upsertShipmentRecord } from '../src/lib/lcLedger';
import { LCLedgerEntry, PreShipmentInvoiceData } from '../src/types';

let passed = 0;
const failures: string[] = [];
const norm = (v: unknown) => String(v ?? '').toUpperCase().replace(/\s+/g, '');
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = typeof expected === 'number' ? Math.abs(Number(actual) - expected) < 0.005 : norm(actual) === norm(expected);
  if (ok) passed++;
  else failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
}
function truthy(label: string, cond: boolean, detail: unknown = '') {
  if (cond) passed++;
  else failures.push(`${label}${detail ? `\n    ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

// ---------------------------------------------------------------- sale contract item: both printed lines kept
for (const split of [
  { description: 'NE 30/1 CARDED PHYSICAL BCI', composition: '100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING.' },
  { description: '100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING.', specification: 'NE 30/1 CARDED PHYSICAL BCI' },
  { description: 'NE 30/1 CARDED PHYSICAL BCI\n100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING.', composition: '100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING.' }
]) {
  const merged = mergeContractItemDescription({ itemNo: 1, quantity: 63957.6, uom: 'KG', unitPrice: 2.72, netValue: 173964.67, ...split });
  truthy(`contract item keeps both lines (${Object.keys(split).join('+')})`,
    merged.description.split('\n').length === 2 && /NE 30\/1 CARDED PHYSICAL BCI/.test(merged.description) && /100% PHYSICAL BCI COTTON/.test(merged.description) && !merged.composition,
    merged.description);
}

// ---------------------------------------------------------------- 45A has two products
const split = splitLcGoods(GOODS_45A);
eq('45A products found', split?.blocks.length, 2);
eq('45A product 1 rate', split?.blocks[0].unitPrice, 2.7);
eq('45A product 2 rate', split?.blocks[1].unitPrice, 2.72);
eq('45A product 2 quantity', split?.blocks[1].quantity, 63957.6);

// ---------------------------------------------------------------- shipment LOL/0087 carries NE 30/1 only
const draft = exportDataFromPreShipment(preShipment, lc, contract);
const docs = generateFinalDocumentSet(draft, lc, [], undefined, shipment);
const inv = docs.commercialInvoice;
const pl = docs.packingList;
const bl = docs.billOfLading;
const coo = docs.certificateOfOrigin;
const boe = docs.billOfExchange;

const SHARED_45A = [
  'YARN FOR 100 PERCENT EXPORT ORIENTED READYMADE GARMENTS INDUSTRY AS PER PROFORMA INVOICE NO.',
  'S/0475/25-26 DATED 04.03.2026',
  'S/0476/25-26 DATED 04.03.2026',
  'HS CODE:5205.13.10(EXPORTER), 5205.13.00(IMPORTER)',
  'TERMS OF DELIVERY:CFR CHATTOGRAM,BANGLADESH (INCOTERMS: 2020)'
].join('\n');
const REFS = [
  'LETTER OF CREDIT NUMBER 134626060029 DATE 260312',
  'IRC NO. 178507.',
  'INSURANCE COVER NOTE NO. UIC/MCK/MC-0109/03/2026 DATED 12.03.2026',
  'EXPORT LC/S/C NO. ATL/ALDI/26/006 DATED 25.02.2026, ATL/ALDI/26/007 DATED 25.02.2026, ATL/ALDI/26/008 DATED 25.02.2026',
  'VAT REG. NO. (BIN) OF L/C APPLICANT: 000495263-0403',
  'VAT REG. NO. (BIN) OF L/C ISSUING BANK: 000000248-0002'
].join('\n');
const GOODS_NE30 = [
  'NE 30/1, 100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR',
  'KNITTING.',
  'QUANTITY: 21,300.00 KGS',
  SHARED_45A
].join('\n');

eq('goods (PL)          <- 45A product NE 30/1 + shipped qty + shared 45A lines', pl.goodsDescriptionVerbatim, `${GOODS_NE30}\n${REFS}`);
eq('goods (B/L)         <- same as packing list', [bl.goodsDescription, ...blExtraLines(bl)].join('\n'), `${GOODS_NE30}\n${REFS}`);
truthy('goods: NE 28/1 (not shipped) left out of every document', !/NE 28\/1/.test(JSON.stringify(docs)));
truthy('goods: LC quantity/price lines not copied', !/63,957\.60|UNIT PRICE/.test(JSON.stringify(docs)));
truthy('invoice description: goods, refs, then certifications', norm(inv.lineItems[0].description).startsWith(norm(`${GOODS_NE30}\n${REFS}`)), inv.lineItems[0].description);
truthy('invoice: 46A.2 origin certification', /WE HEREBY CERTIFYING MERCHANDISE ARE OF INDIA ORIGIN\./.test(inv.lineItems[0].description));
truthy('invoice: 47A.1 certification in the LC wording',
  norm(inv.lineItems[0].description).includes(norm('WE HEREBY CERTIFYING THAT THE GOODS SHIPPED ARE IN ACCORDANCE WITH THE SPECIFICATION, QUALITY, QUANTITY, PACKING, MARKING AND THE PRICE OF ABOVE MENTIONED PROFORMA INVOICE.')));
truthy('invoice: 46A.2 FOB value and freight shown separately', /FOB VALUE: USD 57131\.00\nFREIGHT CHARGE: USD 805\.00/.test(inv.lineItems[0].description));
eq('invoice rows', inv.lineItems.length, 1);
eq('invoice qty          <- pre-shipment', inv.lineItems[0].quantity, 21300);
eq('invoice rate         <- 45A price of NE 30/1 (not NE 28/1 2.700)', inv.lineItems[0].rate, 2.72);
eq('invoice amount       <- pre-shipment', inv.totalAmount, 57936);
eq('invoice words', inv.amountInWords, 'US DOLLAR FIFTY SEVEN THOUSAND NINE HUNDRED THIRTY SIX ONLY');
eq("buyer's order        <- the 45A proforma this order belongs to", inv.buyersOrderNo, 'S/0476/25-26');

eq('consignee            <- 46A.3 "consigned to the order of" + 47A.11 bank BIN', inv.consignee,
  'TO THE ORDER OF\nSOUTHEAST BANK PLC.,\nKAWRAN BAZAR BRANCH, JAMUNA BHABAN(GR. FLOOR), 2 KAWRAN BAZAR /A,\nDHAKA, BANGLADESH.\nBIN NO. 000000248-0002');
eq('buyer                <- 50 applicant + 47A.11 BIN', inv.buyerIfOtherThanConsignee,
  'APPAREL TODAY LIMITED\nGOHAILBARI, MACHINEPAR, SHIMULIA, ASHULIA, SAVAR,\nDHAKA-1345, BANGLADESH.\nBIN NO. 000495263-0403');
eq('B/L notify 1         <- 46A.3 "notifying the issuing bank"', bl.notifyParty1,
  'SOUTHEAST BANK PLC.,\nKAWRAN BAZAR BRANCH, JAMUNA BHABAN(GR. FLOOR), 2 KAWRAN BAZAR /A,\nDHAKA, BANGLADESH.\nBIN NO. 000000248-0002');
eq('B/L notify 2         <- 46A.3 "and the applicant"', bl.notifyParty2,
  'APPAREL TODAY LIMITED\nGOHAILBARI, MACHINEPAR, SHIMULIA, ASHULIA, SAVAR,\nDHAKA-1345, BANGLADESH.\nBIN NO. 000495263-0403');
eq('B/L BIN boxes        <- 47A.11', `${bl.vatApplicant} / ${bl.vatIssuingBank}`, '000495263-0403 / 000000248-0002');
eq('B/L freight          <- 46A.3', bl.freightStatus, 'FREIGHT PREPAID');

eq('port of loading      <- 44E says "ANY SEA PORT OF INDIA", so the actual port', inv.portOfLoading, 'MUNDRA, INDIA');
eq('port of discharge    <- 44F (mode "BY SEA" is not part of the port)', inv.portOfDischarge, 'CHATTOGRAM PORT, BANGLADESH');
eq('final destination    <- 44F (pre-shipment CHITTAGONG is the same place)', inv.finalDestination, 'CHATTOGRAM PORT, BANGLADESH');
eq('terms of delivery    <- 45A incoterm + LC no./date', inv.termsOfDelivery, 'CFR CHATTOGRAM, BANGLADESH (INCOTERMS: 2020)\nLC NO.134626060029 DATE 260312');
eq('tenor                <- 42C', inv.paymentTenorLine, 'AT 120 DAYS FROM THE DATE OF BILL OF LADING');
truthy('marks: 47A.7 country of origin on each package', /^NE 30\/1 KH\nCOUNTRY OF ORIGIN: INDIA\n/.test(inv.lineItems[0].marksAndNos), inv.lineItems[0].marksAndNos);

eq('BOE header           <- 46A.1 / 47A.2 LC no. and date + refs', boe.headerText,
  `DRAWN UNDER DOCUMENTARY CREDIT NO : 134626060029 DATE 260312\n${REFS.split('\n').join(' ')}\nCOUNTRY OF ORIGIN: INDIA`);
eq('BOE drawee           <- 42A', boe.drawee, 'SEBDBDDHKRN\nSOUTHEAST BANK PLC.\nKARWAN BAZAR BRANCH\nDHAKA BD');
eq('BOE tenor            <- 42C', boe.tenor, 'AT 120 DAYS FROM THE DATE OF BILL OF LADING');
truthy('COO goods            <- packages + NE 30/1 only', coo.goodsDescription.startsWith('426 CARTONS, NE 30/1, 100% PHYSICAL BCI COTTON'), coo.goodsDescription.slice(0, 80));

// Beneficiary certificates: one per 46A/47A clause that asks for one
const certs = docs.beneficiaryCertificates.map(c => `${c.clauseRef} ${c.docTitle}`);
eq('certificates', certs.join(' | '), [
  '46A.4 SHIPMENT ADVICE', '46A.4 EMAIL COPY',
  '46A.6 BENEFICIARY CERTIFICATE', '46A.6 EMAIL COPY',
  '46A.8 PRE-SHIPMENT INSPECTION CERTIFICATE',
  '47A.7 BENEFICIARY CERTIFICATE', '47A.8 BENEFICIARY CERTIFICATE'
].join(' | '));
const byRef = (r: string) => docs.beneficiaryCertificates.find(c => c.clauseRef === r && c.docTitle !== 'EMAIL COPY');
eq('46A.4 insurance declaration to   <- "(AT)" e-mail decoded', docs.beneficiaryCertificates.find(c => c.clauseRef === '46A.4' && c.docTitle === 'EMAIL COPY')?.emailDetails?.to, 'info@unioninsurancebd.com');
eq('46A.4 cover note', `${byRef('46A.4')?.insuranceCoverNote} ${byRef('46A.4')?.insuranceCoverNoteDate}`, 'UIC/MCK/MC-0109/03/2026 12.03.2026');
eq('47A.7 certificate text', byRef('47A.7')?.text, 'WE HEREBY CERTIFY THAT COUNTRY OF ORIGIN HAS BEEN CLEARLY MENTIONED ON EACH PACKAGE/CARTON/BOX/CONTAINER.');
truthy('47A.8 certificate names importer TIN', /TIN \(006-200-3960\)/.test(byRef('47A.8')?.text || ''));
truthy('no FOB/freight certificate (46A.2 is met on the invoice itself)', !docs.beneficiaryCertificates.some(c => /FOB VALUE AND FREIGHT/.test(c.text || '')));

// ---------------------------------------------------------------- a shipment carrying BOTH products
const both: PreShipmentInvoiceData = {
  ...preShipment,
  invoiceNo: 'LOL/0099/26-27',
  goodsQuantity: 41300,
  totalAmount: 111936,
  items: [
    { description: '100 PERCENT PHYSICAL BCI COTTON CARDED GREY YARN ON CONES FOR KNITTING\nNE 28/1 KH-PHYSICAL BCI COTTON', quantity: 20000, uom: 'KG', rate: 2.7, amount: 54000 },
    { description: '100 PERCENT PHYSICAL BCI COTTON CARDED GREY YARN ON CONES FOR KNITTING\nNE 30/1 KH-PHYSICAL BCI COTTON', quantity: 21300, uom: 'KG', rate: 2.72, amount: 57936 }
  ]
};
const draft2 = exportDataFromPreShipment(both, lc, contract);
const docs2 = generateFinalDocumentSet(draft2, lc, [], undefined, shipment);
const rows = docs2.commercialInvoice.lineItems;
eq('two products: invoice rows', rows.length, 2);
eq('two products: row rates  <- 45A prices', rows.map(r => r.rate).join(), '2.7,2.72');
eq('two products: row qty    <- pre-shipment', rows.map(r => r.quantity).join(), '20000,21300');
truthy('two products: row 1 is NE 28/1 only', /^NE 28\/1/.test(rows[0].description) && !/NE 30\/1/.test(rows[0].description), rows[0].description);
truthy('two products: last row closes with shared 45A lines + refs', norm(rows[1].description).startsWith(norm(`NE 30/1, 100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR\nKNITTING.\nQUANTITY: 21,300.00 KGS\n${SHARED_45A}\n${REFS}`)), rows[1].description);
truthy('two products: packing list lists both', /NE 28\/1[\s\S]*QUANTITY: 20,000\.00 KGS[\s\S]*NE 30\/1[\s\S]*QUANTITY: 21,300\.00 KGS/.test(docs2.packingList.goodsDescriptionVerbatim));

// ---------------------------------------------------------------- LC ledger: balance per product
const use1 = shippedLcItems(lc, draft).map(s => ({ lcItemIndex: s.lcIndex, quantity: s.quantity, amount: s.amount }));
eq('ledger: LOL/0087 uses product 2 only', JSON.stringify(use1), JSON.stringify([{ lcItemIndex: 1, quantity: 21300, amount: 57936 }]));
let entry: LCLedgerEntry = { lcNumber: lc.lcNumber, lcDetails: lc, shipments: [], createdAt: '', updatedAt: '' };
entry = upsertShipmentRecord(entry, { invoiceNo: 'LOL/0087/26-27', invoiceDate: '16/05/2026', quantity: 21300, quantityUom: 'KG', amount: 57936, items: use1, status: 'shipped', updatedAt: '' });
const u = computeLCUtilization(lc, entry.shipments);
eq('ledger: LC quantity = both products', u.lcQuantity, 127915.2);
eq('ledger: NE 28/1 balance untouched', u.items[0].balanceQuantity, 63957.6);
eq('ledger: NE 30/1 balance', u.items[1].balanceQuantity, 42657.6);
eq('ledger: value balance', u.balanceAmount, 288714.19);
const over = checkShipmentAgainstLC(lc, entry.shipments, { invoiceNo: 'LOL/0101/26-27', quantity: 45000, amount: 122400, items: [{ lcItemIndex: 1, quantity: 45000, amount: 122400 }] });
truthy('ledger: NE 30/1 above its own balance is refused even though the LC total has room', over.errors.some(e => /exceeds the balance for this product 42,657.6/.test(e)), over.errors);
const ok = checkShipmentAgainstLC(lc, entry.shipments, { invoiceNo: 'LOL/0102/26-27', quantity: 45000, amount: 121500, items: [{ lcItemIndex: 0, quantity: 45000, amount: 121500 }] });
eq('ledger: NE 28/1 shipment within its balance passes', ok.errors.filter(e => /exceeds/.test(e)).join(' '), '');

console.log(`\nLOL/0087 (two-product LC): ${passed} checks passed, ${failures.length} failed\n`);
failures.forEach(f => console.log(`FAIL ${f}\n`));
process.exit(failures.length ? 1 : 0);
