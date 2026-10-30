// Field-by-field check of generated documents against the real LOL/0138/26-27 document set,
// plus LC ledger (multiple invoices under one LC) behaviour. Run: npm test
import { contract, lc, preShipment, shipment } from './fixtures/lol0138';
import { exportDataFromPreShipment, generateFinalDocumentSet, generateComplianceChecklist, blExtraLines } from '../src/lib/documentGenerators';
import { checkShipmentAgainstLC, computeLCUtilization, upsertShipmentRecord } from '../src/lib/lcLedger';
import { LCLedgerEntry } from '../src/types';

let passed = 0;
const failures: string[] = [];

// Compare ignoring whitespace/line-wrapping and quote style ('' vs ", BENEFICIARY'S vs BENEFICIARYS)
const norm = (v: unknown) => String(v ?? '').toUpperCase().replace(/''|``|“|”/g, '"').replace(/['’]/g, '').replace(/\s+/g, '');

function eq(label: string, actual: unknown, expected: unknown) {
  const ok = typeof expected === 'number' ? Math.abs(Number(actual) - expected) < 0.005 : norm(actual) === norm(expected);
  if (ok) passed++;
  else failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
}

function truthy(label: string, cond: boolean, detail = '') {
  if (cond) passed++;
  else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
}

// ---------------------------------------------------------------- flow: contract + LC + pre-shipment -> docs
const draft = exportDataFromPreShipment(preShipment, lc, contract);
const docs = generateFinalDocumentSet(draft, lc, [], undefined, shipment);
const inv = docs.commercialInvoice;
const pl = docs.packingList;
const bl = docs.billOfLading;
const boe = docs.billOfExchange;
const coo = docs.certificateOfOrigin;

const EXPORTER_ADDR = '307, ARUN CHAMBERS,\nTARDEO ROAD,\nMUMBAI-400034, INDIA.';
const CONSIGNEE = 'TO THE ORDER OF\nSONALI BANK PLC.,\nLOCAL OFFICE, MOTIJHEEL C/A,\nDHAKA, BANGLADESH.\nBIN NO. 000000063-0002';
const BUYER = 'SANJANA FABRICS LTD.\nMAHANA, DUPTARA, RUPGONJ,\nNARAYANGONJ, BANGLADESH.\nBIN NO. 000358148-0303';
const NOTIFY2 = 'SONALI BANK PLC.\nLOCAL OFFICE, 35-44, MOTIJHEEL C/A,\nDHAKA, BANGLADESH.\nBIN-000000063-0002';
const MARKS = 'COTTON FABRICS\nCOUNTRY OF ORIGIN: INDIA\nROLL NOS :\n1 - 76\nTOTAL GROSS WT :\n7,755.500 KGS\nTOTAL NET WT :\n7679.500 KGS\nCONTAINER NO/SEAL NO :';
const GOODS_AND_REFS = [
  'GREY FABRICS',
  '20 OE X 20 KW + 70D 114X56 73" 2/2 "S" TWILL COMPOSITION',
  '98% COTTON+2% SPANDEX (CONTAMINATION CONTROLLED)',
  'QUANTITY: 21,210.57 YARDS',
  'SPECIFICATION, QUALITY, QUANTITY, PACKING, MARKING AND',
  'ALL OTHER DETAILS OF THE GOODS STRICTLY AS PER',
  'BENEFICIARYS PROFORMA INVOICE NO. S/0403B2/25-26 DTD',
  '14.01.2026 AS AGREED BETWEEN APPLICANT AND BENEFICIARY.',
  'CPT BENAPOLE, BANGLADESH (INCOTERMS 2020).',
  'LETTER OF CREDIT NUMBER 033026020021 DATE 260416',
  'H.S.CODE NO. 5209.12.00, TIN NO. 714245426517,',
  'IRC NO. BA-0169290, BIN NO. 000358148-0303.',
  'THIS L/C IS OPENED UNDER BOND.'
].join('\n');
const INVOICE_DESC = [
  GOODS_AND_REFS,
  'WE HEREBY CERTIFYING MERCHANDISE ARE OF INDIA ORIGIN.',
  'WE HEREBY CERTIFYING THAT THE GOODS SHIPPED ARE STRICTLY IN ACCORDANCE WITH THE TERMS OF THE PROFORMA INVOICE.',
  'FOB VALUE: USD 20222.68\nFREIGHT CHARGE: USD 1200.00',
  'B.C.P. ENTRY NO. 60120260010037517  DT: 20.06.2026'
].join('\n');
const LC_REF_ONE_LINE = 'LETTER OF CREDIT NUMBER 033026020021 DATE 260416 H.S.CODE NO. 5209.12.00, TIN NO. 714245426517, IRC NO. BA-0169290, BIN NO. 000358148-0303. THIS L/C IS OPENED UNDER BOND.';

// Stage 3 draft (preview of the pre-shipment invoice): header boxes come from the uploaded document
eq('draft.consignee (from pre-shipment)', draft.consignee, 'TO THE ORDER OF SONALI BANK PLC\nMOJIJHEEL C/A DHAKA');
eq('draft.buyer (from pre-shipment)', draft.buyerIfOtherThanConsignee, 'SANJANA FABRICS LTD\nMAHANA, DUPTARA, RUPGONJ,\nNARAYANGONJ, BANGLADESH.');
eq('draft.terms (from pre-shipment)', draft.termsOfDelivery, 'CPT BENAPOLE,BANGLADESH(INCOTERM 2020)\nLC NO.033026020021-PP DT. 16.04.2026\n\nAT 90 DAYS FROM LR DATE');
eq('draft.ports', `${draft.portOfLoading} / ${draft.portOfDischarge} / ${draft.finalDestination}`, 'PETRAPOLE / BENAPOLE / BENAPOLE');
eq('draft.otherReference', draft.otherReference, 'BL No.');
eq('draft.vessel (blank on document, land-port route)', draft.vesselFlightNo, 'BY ROAD');
eq('draft.irn (blank on document)', draft.irnno, '');
eq('draft.preCarriage (blank on document)', draft.preCarriageBy, '');

// ...and when the document leaves those boxes blank, the LC fills them
const bare = exportDataFromPreShipment({
  ...preShipment, consignee: undefined, buyer: undefined, termsOfDeliveryAndPayment: undefined,
  portOfLoading: undefined, portOfDischarge: undefined, finalDestination: undefined
}, lc, contract);
eq('draft fallback consignee (LC 46A)', bare.consignee, CONSIGNEE);
eq('draft fallback terms (LC 45A/42C)', bare.termsOfDelivery, 'CPT BENAPOLE, BANGLADESH (INCOTERMS 2020)\nLC NO.033026020021 DATE 260416\n\nAT 90 DAYS FROM L/R DATE');
eq('draft fallback ports (LC 44E/44F)', `${bare.portOfLoading} / ${bare.portOfDischarge}`, 'PETRAPOLE,INDIA / BENAPOLE,BANGLADESH.');
truthy('final invoice still uses LC consignee, not the pre-shipment text', !/MOJIJHEEL/.test(inv.consignee));

// Commercial invoice (invoice.pdf)
eq('invoice.exporter.name', inv.exporter.name, 'LAHOTI OVERSEAS LIMITED');
eq('invoice.exporter.address', inv.exporter.address, EXPORTER_ADDR);
eq('invoice.invoiceNo', inv.invoiceNo, 'LOL/0138/26-27');
eq('invoice.invoiceDate', inv.invoiceDate, '11/06/2026');
eq("invoice.buyer's order no (from LC 45A proforma)", inv.buyersOrderNo, 'S/0403B2/25-26');
eq('invoice.otherReference (LR)', inv.otherReference, 'LR No. 26554 DT. 20/06/2026');
eq('invoice.consignee', inv.consignee, CONSIGNEE);
eq('invoice.buyer', inv.buyerIfOtherThanConsignee, BUYER);
eq('invoice.countryOfOrigin', inv.countryOfOrigin, 'INDIAN ORIGIN');
eq('invoice.countryOfFinalDestination', inv.countryOfFinalDestination, 'BANGLADESH');
eq('invoice.vesselFlightNo', inv.vesselFlightNo, 'BY ROAD');
eq('invoice.preCarriageBy', inv.preCarriageBy, '');
eq('invoice.portOfLoading', inv.portOfLoading, 'PETRAPOLE, INDIA');
eq('invoice.portOfDischarge', inv.portOfDischarge, 'BENAPOLE, BANGLADESH');
eq('invoice.finalDestination', inv.finalDestination, 'BENAPOLE, BANGLADESH');
eq('invoice.termsOfDelivery', inv.termsOfDelivery, 'CPT BENAPOLE, BANGLADESH (INCOTERMS 2020)\nLC NO.033026020021 DATE 260416');
eq('invoice.payment tenor', inv.paymentTenorLine, 'AT 90 DAYS FROM L/R DATE');
eq('invoice.marksAndNos', inv.lineItems[0].marksAndNos, MARKS);
eq('invoice.noAndKindOfPkg', inv.lineItems[0].noAndKindOfPkg, '76 ROLLS');
eq('invoice.description', inv.lineItems[0].description, INVOICE_DESC);
eq('invoice.quantity', inv.lineItems[0].quantity, 21210.57);
eq('invoice.uom', inv.lineItems[0].uom, 'YARD');
eq('invoice.rate', inv.lineItems[0].rate, 1.01);
eq('invoice.amount', inv.lineItems[0].amount, 21422.68);
eq('invoice.total', inv.totalAmount, 21422.68);
eq('invoice.amountInWords', inv.amountInWords, 'US DOLLAR TWENTY ONE THOUSAND FOUR HUNDRED TWENTY TWO AND SIXTY EIGHT CENTS ONLY');
eq('invoice.fobValue', inv.fobValue, 20222.68);
eq('invoice.freightAmount', inv.freightAmount, 1200);
eq('invoice.CIN', inv.exporter.cin, 'L74999MH1995PLC087643');
eq('invoice.GST', inv.exporter.taxId, '27AAACL2578H1ZE');
eq('invoice.PAN', inv.exporter.pan, 'AAACL2578H');
eq('invoice.declaration', inv.declarationText, 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct');
truthy('invoice has no REX number (not an EU shipment)', !inv.rexNumber);

// Packing list (packing list.pdf)
eq('packing.consignee', pl.consignee, CONSIGNEE);
eq('packing.buyer', pl.buyerIfOtherThanConsignee, BUYER);
eq('packing.buyersOrderNo', pl.buyersOrderNo, 'S/0403B2/25-26');
eq('packing.otherReference', pl.otherReference, 'LR No. 26554 DT. 20/06/2026');
eq('packing.marksAndNos', pl.marksAndNos, MARKS);
eq('packing.noAndKindOfPkg', pl.noAndKindOfPkg, '76 ROLLS');
eq('packing.description', pl.goodsDescriptionVerbatim, GOODS_AND_REFS);
eq('packing.grossWt', pl.totalGrossWtKg, 7755.5);
eq('packing.netWt', pl.totalNetWtKg, 7679.5);
eq('packing.termsOfDelivery', pl.termsOfDelivery, 'CPT BENAPOLE, BANGLADESH (INCOTERMS 2020)\nLC NO.033026020021 DATE 260416\n\nAT 90 DAYS FROM L/R DATE');
eq('packing.remarks (no invented text)', pl.remarks, '');
eq('packing.bakedPalletQuote (no invented text)', pl.bakedPalletQuote, '');

// B/L instruction (bl instructions.pdf)
eq('bl.exporter.address', bl.exporter.address, EXPORTER_ADDR);
eq('bl.invoiceNo', bl.invoiceNo, 'LOL/0138/26-27');
eq('bl.consignee', bl.consignee, CONSIGNEE);
eq('bl.lc', `LC NO.${bl.lcNumber} DATE ${bl.lcDate}`, 'LC NO.033026020021 DATE 260416');
eq('bl.notify1', bl.notifyParty1, BUYER);
eq('bl.notify2', bl.notifyParty2, NOTIFY2);
eq('bl.vesselFlightNo (blank before LR)', bl.vesselFlightNo, '');
eq('bl.portOfLoading', bl.portOfLoading, 'PETRAPOLE, INDIA');
eq('bl.portOfDischarge', bl.portOfDischarge, 'BENAPOLE, BANGLADESH');
eq('bl.finalDestination', bl.finalDestination, 'BENAPOLE, BANGLADESH');
eq('bl.marksAndNos', bl.marksAndNos, MARKS);
eq('bl.packages', bl.packagesCountAndKind, '76 ROLLS');
// B/L description column as printed = description + the LC reference block held in its own fields
const blPrinted = [bl.goodsDescription, ...blExtraLines(bl)].join('\n');
eq('bl.goodsDescription (printed)', blPrinted, GOODS_AND_REFS);
eq('bl.reference fields <- 46A.A / 47A.11', [bl.hsCodeNo, bl.tinNo, bl.ircNo, bl.binNo, bl.underBond].join(' | '), '5209.12.00 | 714245426517 | BA-0169290 | 000358148-0303 | true');
eq('bl.freightStatus', bl.freightStatus, 'FREIGHT PREPAID');
eq('bl.agent clause', bl.agentDetailsAtDestination, 'AGENT ADDRESS/TEL/FAX NO. AT DESTINATION PORT');
eq('bl.weight check clause', bl.blWeightCheckClause, 'CHECK NET/GR WT/ NO. OF CARTON AS PER SHIPPING BILL');
eq('bl.free detention (sea only, not on road LR)', bl.freeDetentionClause, '');
eq('bl.shippingBillNo', bl.shippingBillNo, '');

// Description of Goods, line for line as Lahoti types it (reference screenshots of the B/L and invoice)
const BL_DESC_LINES = [
  'GREY FABRICS',
  '20 OE X 20 KW + 70D 114X56 73" 2/2 "S" TWILL COMPOSITION',
  '98% COTTON+2% SPANDEX (CONTAMINATION CONTROLLED)',
  'QUANTITY: 21,210.57 YARDS',
  'SPECIFICATION, QUALITY, QUANTITY, PACKING, MARKING AND',
  'ALL OTHER DETAILS OF THE GOODS STRICTLY AS PER',
  'BENEFICIARYS PROFORMA INVOICE NO. S/0403B2/25-26 DTD',
  '14.01.2026 AS AGREED BETWEEN APPLICANT AND BENEFICIARY.',
  'CPT BENAPOLE, BANGLADESH (INCOTERMS 2020).',
  'LETTER OF CREDIT NUMBER 033026020021 DATE 260416',
  'H.S.CODE NO. 5209.12.00, TIN NO. 714245426517,',
  'IRC NO. BA-0169290, BIN NO. 000358148-0303.',
  'THIS L/C IS OPENED UNDER BOND.'
];
const exactLines = (label: string, actual: string, expected: string[]) => {
  const got = actual.split('\n');
  const bad = expected.findIndex((l, i) => got[i] !== l);
  truthy(label, bad === -1 && got.length === expected.length,
    bad === -1 ? `line count ${got.length} vs ${expected.length}` : `line ${bad + 1}\n    expected: ${JSON.stringify(expected[bad])}\n    actual:   ${JSON.stringify(got[bad])}`);
};
exactLines('B/L description, exact lines', blPrinted, BL_DESC_LINES);
exactLines('packing list description, exact lines', pl.goodsDescriptionVerbatim, BL_DESC_LINES);
truthy('invoice description begins with exactly the B/L description', inv.lineItems[0].description.startsWith(`${blPrinted}\n`));
exactLines('invoice description, exact lines', inv.lineItems[0].description, [
  ...BL_DESC_LINES,
  '',
  'WE HEREBY CERTIFYING MERCHANDISE ARE OF INDIA ORIGIN.',
  '',
  'WE HEREBY CERTIFYING THAT THE GOODS SHIPPED ARE',
  'STRICTLY IN ACCORDANCE WITH THE TERMS OF THE',
  'PROFORMA INVOICE.',
  'FOB VALUE: USD 20222.68',
  'FREIGHT CHARGE: USD 1200.00',
  '',
  '',
  'B.C.P. ENTRY NO. 60120260010037517  DT: 20.06.2026'
]);

// Bill of exchange (boe.pdf)
eq('boe.headerText', boe.headerText, `DRAWN UNDER DOCUMENTARY CREDIT NO : 033026020021 DATE 260416\n${LC_REF_ONE_LINE}\nCOUNTRY OF ORIGIN: INDIA`);
eq('boe.no', boe.invoiceNo, 'LOL/0138/26-27');
eq('boe.date (= LR date)', boe.date, '20-06-2026');
eq('boe.amount', boe.amount, 21422.68);
eq('boe.tenor', boe.tenor, 'AT 90 DAYS FROM L/R DATE');
eq('boe.payToOrderOf', boe.payToOrderOf, 'STANDARD CHARTERED BANK BRANCH CODE: 225, 23-25 M.G.ROAD, OPP. VSNL, MUMBAI - 400 001 INDIA');
eq('boe.amountInWords', boe.amountInWords, 'US DOLLAR TWENTY ONE THOUSAND FOUR HUNDRED TWENTY TWO AND SIXTY EIGHT CENTS ONLY');
eq('boe.accountOf', boe.accountOf, '76 ROLLS');
eq('boe.packagesShippedBy', boe.packagesShippedBy, 'BY ROAD');
eq('boe.invoiceDate', boe.invoiceDate, '11-06-2026');
eq('boe.blAirBillRef', boe.blAirBillRef, '26554 DT.20/06/26');
eq('boe.drawee (42A)', boe.drawee, 'BSONBDDHLOD\nSONALI BANK PLC\nLOCAL OFFICE DHAKA BD');

// Certificate of origin (COO ISSUED pdf)
eq('coo.consignee', coo.consignee, BUYER);
eq('coo.transport', `${coo.vesselFlightNo}, FROM: ${coo.portOfLoading} TO ${coo.portOfDischarge}`, 'BY ROAD, FROM: PETRAPOLE, INDIA TO BENAPOLE, BANGLADESH');
eq('coo.grossWt', coo.grossWeightKg, 7755.5);
eq('coo.netWt', coo.netWeightKg, 7679.5);
eq('coo.invoice', `${coo.invoiceNo} DT: ${coo.invoiceDate}`, 'LOL/0138/26-27 DT: 11-06-2026');
eq('coo.hsCode', coo.hsCode, '5209.12.00');
eq('coo.issuingAuthority', coo.issuingAuthority, 'BOMBAY CHAMBER OF COMMERCE AND INDUSTRY');
eq('coo.placeAndDate', coo.placeAndDateOfIssue, 'MUMBAI, 22-06-2026');
truthy('coo.goods starts with packages', coo.goodsDescription.startsWith('76 ROLLS, GREY FABRICS'), coo.goodsDescription.slice(0, 60));
truthy('coo.goods has no text from another buyer', !/YARN FOR 100 PERCENT|READYMADE GARMENTS/i.test(coo.goodsDescription));

// Beneficiary certificates (B.CERT pdf) — same set, same order
const certs = docs.beneficiaryCertificates;
eq('certs.count', certs.length, 10);
eq('certs.titles', certs.map(c => c.docTitle).join(' | '),
  'BENEFICIARY CERTIFICATE | SHIPMENT ADVICE | EMAIL COPY | BENEFICIARY CERTIFICATE | EMAIL COPY | BENEFICIARY CERTIFICATE | BENEFICIARY CERTIFICATE | SHIPPING ADVICE | EMAIL COPY | BENEFICIARY CERTIFICATE');
eq('cert[0].text (COO in 3 copies)', certs[0]?.text, 'WE HEREBY STATING THAT ORIGINAL CERTIFICATE OF ORIGIN ISSUED BY COMPETENT AUTHORITY IN 3 COPIES.');
eq('cert[0].date', certs[0]?.docHeaderDate, '22.06.2026');
eq('cert[0].footnote', certs[0]?.footnoteDetails, `INVOICE NO. LOL/0138/26-27\nLETTER OF CREDIT NO. 033026020021 DATE 260416\n${LC_REF_ONE_LINE}\nCOUNTRY OF ORIGIN: INDIA`);
const advice = certs[1];
eq('shipmentAdvice.recipients', advice?.recipients?.map(r => `${r.address} | ${r.email}`).join(' || '),
  'PROVATI INSURANCE PLC.,\nHATKHOLA BRANCH, ROOM NO:22,\nBHUIYAN MANSION(4TH FLOOR), 6 MOTIJHEEL C/A,\nDHAKA-1000, BANGLADESH. | piclhkb@gmail.com || ' +
  'SANJANA FABRICS LTD.\nMAHANA, DUPTARA, RUPGONJ,\nNARAYANGONJ, BANGLADESH. | info@asiatic-group.com || ' +
  'SONALI BANK PLC.,\nLOCAL OFFICE, MOTIJHEEL C/A,\nDHAKA, BANGLADESH. | localcorp@sonalibank.com.bd');
eq('shipmentAdvice.coverNote', `${advice?.insuranceCoverNote} DTD: ${advice?.insuranceCoverNoteDate}`, 'PIPLC/HKB/MC-2026/04/0054 DTD: 13.04.2026');
eq('shipmentAdvice.particulars', advice?.particulars?.map(p => `${p.label}: ${p.value}`).join('\n'), [
  'DATE OF SHIPMENT: 20.06.2026',
  'ACTUAL VALUE OF GOODS SHIPPED: USD 21422.68',
  'QUANTITY: 21210.570 YDS',
  'PORT OF LOADING: PETRAPOLE, INDIA',
  'PORT OF DISCHARGE: BENAPOLE, BANGLADESH',
  'TRUCK RECEIPT /LR NUMBER AND DATE: 26554 DT. 20/06/2026'
].join('\n'));
eq('shipmentAdvice email.to', certs[2]?.emailDetails?.to, 'piclhkb@gmail.com; info@asiatic-group.com; localcorp@sonalibank.com.bd');
eq('shipmentAdvice email.subject', certs[2]?.emailDetails?.subject, 'Shipment Advice our invoice no: LOL/0138/26-27');
eq('nonNegotiable.text', certs[3]?.text, 'WE HEREBY CERTIFY THAT ONE COMPLETE SET OF NON-NEGOTIABLE SHIPPING DOCUMENTS TO THE APPLICANT BY E-MAIL: info@asiatic-group.com');
eq('nonNegotiable email.subject', certs[4]?.emailDetails?.subject, 'ONE COMPLETE SET OF NON-NEGOTIABLE DOCUMENTS FOR OUR INV. NO. LOL/0138/26-27');
eq('countryOfOrigin.text', certs[5]?.text, 'WE HEREBY CERTIFY THAT THE COUNTRY OF ORIGIN IS MENTIONED IN ALL DOCUMENTS.');
eq('shippingAdvice cert.text', certs[6]?.text, 'WE HEREBY CONFIRMING THAT THE SHIPPING ADVICE TO SONALI BANK PLC., LOCAL OFFICE THROUGH E-MAIL: LOCALCORP@SONALIBANK.COM.BD AFTER SHIPMENT WITH BELOW DETAILS.');
eq('shippingAdvice.recipient', certs[7]?.recipients?.map(r => `${r.address} | ${r.email}`).join(''), 'SONALI BANK PLC.,\nLOCAL OFFICE, MOTIJHEEL C/A,\nDHAKA, BANGLADESH. | localcorp@sonalibank.com.bd');
eq('shippingAdvice email.to', certs[8]?.emailDetails?.to, 'localcorp@sonalibank.com.bd');
eq('fobFreight cert.text', certs[9]?.text, 'WE HEREBY CONFIRMING THAT ON INVOICE CLEARLY MENTIONED FOB VALUE AND FREIGHT CHARGES.\nFREIGHT CHARGES: USD 1200.00\nFOB VALUE: USD 20222.68');

// Compliance checklist uses real dates (LR date + 21 days, capped at expiry 10-07-2026)
const chk = generateComplianceChecklist(lc, shipment.transportDocDate);
eq('checklist.presentationDeadline', chk.presentationDeadline, '2026-07-10');
eq('checklist.latestShipment status', chk.items.find(i => i.id === 'chk-latest-shipment')?.status, 'verified');

// ---------------------------------------------------------------- LC ledger: many invoices under one LC
let entry: LCLedgerEntry = { lcNumber: lc.lcNumber, lcDetails: lc, contractData: contract, shipments: [], createdAt: '', updatedAt: '' };
const rec = (invoiceNo: string, quantity: number, amount: number, d: string) =>
  ({ invoiceNo, invoiceDate: d, quantity, quantityUom: 'YARDS', amount, status: 'shipped' as const, transportDocDate: d, updatedAt: '' });

const first = checkShipmentAgainstLC(lc, entry.shipments, { invoiceNo: 'LOL/0138/26-27', quantity: 21210.57, amount: 21422.68, shipmentDate: '20/06/2026' });
eq('ledger: first shipment has no errors', first.errors.join(' '), '');
truthy('ledger: warns that 43P forbids partial shipment for a 21,210 of 173,000 yds shipment', first.warnings.some(w => /PARTIAL/i.test(w)), first.warnings.join(' '));

entry = upsertShipmentRecord(entry, rec('LOL/0138/26-27', 21210.57, 21422.68, '20/06/2026'));
let u = computeLCUtilization(lc, entry.shipments);
eq('ledger: shipped qty', u.shippedQuantity, 21210.57);
eq('ledger: balance qty', u.balanceQuantity, 151789.43);
eq('ledger: balance value', u.balanceAmount, 153307.32);
eq('ledger: balance value incl. +5%', u.balanceAmountWithTolerance, 162043.82);

entry = upsertShipmentRecord(entry, rec('LOL/0138/26-27', 21210.57, 21422.68, '20/06/2026'));
eq('ledger: re-saving the same invoice does not double count', computeLCUtilization(lc, entry.shipments).shippedAmount, 21422.68);

const tooBig = checkShipmentAgainstLC(lc, entry.shipments, { invoiceNo: 'LOL/0150/26-27', quantity: 165000, amount: 166650, shipmentDate: '24/06/2026' });
truthy('ledger: second invoice above balance is rejected (value)', tooBig.errors.some(e => /exceeds the LC balance USD 162,043.82/.test(e)), tooBig.errors.join(' | '));
truthy('ledger: second invoice above balance is rejected (qty)', tooBig.errors.some(e => /Quantity 165,000/.test(e)), tooBig.errors.join(' | '));

const late = checkShipmentAgainstLC(lc, entry.shipments, { invoiceNo: 'LOL/0151/26-27', quantity: 1000, amount: 1010, shipmentDate: '30/06/2026' });
truthy('ledger: shipment after 44C latest date (25-06-2026) is rejected', late.errors.some(e => /latest shipment date/i.test(e)), late.errors.join(' | '));

entry = upsertShipmentRecord(entry, rec('LOL/0149/26-27', 50000, 50500, '24/06/2026'));
u = computeLCUtilization(lc, entry.shipments);
eq('ledger: two invoices -> shipped value', u.shippedAmount, 71922.68);
eq('ledger: two invoices -> balance qty', u.balanceQuantity, 101789.43);
eq('ledger: shipment count', u.shipmentCount, 2);

// ---------------------------------------------------------------- report
console.log(`\n${passed} checks passed, ${failures.length} failed\n`);
failures.forEach(f => console.log(`FAIL ${f}\n`));
process.exit(failures.length ? 1 : 0);
