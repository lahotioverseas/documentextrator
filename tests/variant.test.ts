// Second, unrelated shipment (sea, Vietnam, yarn, different LC/bank/tenor). Each check names the
// source document and field the value must come from; the last check scans every generated
// document for any value from the LOL/0138 set, which would mean something is hard-coded.
import { contract, lc, preShipment, shipment } from './fixtures/variant';
import { exportDataFromPreShipment, generateFinalDocumentSet } from '../src/lib/documentGenerators';

let passed = 0;
const failures: string[] = [];
const norm = (v: unknown) => String(v ?? '').toUpperCase().replace(/\s+/g, '');
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = typeof expected === 'number' ? Math.abs(Number(actual) - expected) < 0.005 : norm(actual) === norm(expected);
  if (ok) passed++;
  else failures.push(`${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
}
function truthy(label: string, cond: boolean, detail = '') {
  if (cond) passed++;
  else failures.push(`${label}${detail ? `\n    ${detail}` : ''}`);
}

const draft = exportDataFromPreShipment(preShipment, lc, contract);
const docs = generateFinalDocumentSet(draft, lc, [], undefined, shipment);
const inv = docs.commercialInvoice;
const pl = docs.packingList;
const bl = docs.billOfLading;
const boe = docs.billOfExchange;
const coo = docs.certificateOfOrigin;

const BANK_CONSIGNEE = 'TO THE ORDER OF\nMEKONG COMMERCIAL BANK,\nHO CHI MINH CITY BRANCH, VIETNAM.';
const APPLICANT = 'DELTA SPINNING CO., LTD.\n12 TAN THUAN ROAD, DISTRICT 7,\nHO CHI MINH CITY, VIETNAM.';

// Pre-shipment invoice -> Stage 3 draft
eq('draft.irn          <- pre-shipment IRN box', draft.irnno, preShipment.irnNo);
eq('draft.consignee    <- pre-shipment consignee box', draft.consignee, preShipment.consignee);
eq('draft.preCarriage  <- pre-shipment pre-carriage box', draft.preCarriageBy, 'BY TRUCK');
eq('draft.receipt      <- pre-shipment place of receipt box', draft.placeOfReceiptByPreCarrier, 'BHIWANDI');
eq('draft.vessel       <- blank on pre-shipment, sea route so not BY ROAD', draft.vesselFlightNo, '');
eq('draft.terms        <- pre-shipment terms box', draft.termsOfDelivery, preShipment.termsOfDeliveryAndPayment);

// Commercial invoice
eq('invoice.no/date    <- pre-shipment', `${inv.invoiceNo} ${inv.invoiceDate}`, 'LOL/0291/26-27 02/08/2026');
eq('invoice.irn        <- pre-shipment', inv.irnno, preShipment.irnNo);
eq('invoice.consignee  <- LC 46A B/L "made out to the order of"', inv.consignee, BANK_CONSIGNEE);
eq('invoice.buyer      <- LC 50 applicant', inv.buyerIfOtherThanConsignee, APPLICANT);
eq("invoice.buyer's order <- LC 45A proforma ref", inv.buyersOrderNo, 'Y/0777/26-27');
eq('invoice.otherRef   <- B/L no + date (stage 4)', inv.otherReference, 'B/L No. MSKU7712345 DT. 10/08/2026');
eq('invoice.preCarriage <- pre-shipment', inv.preCarriageBy, 'BY TRUCK');
eq('invoice.receipt    <- pre-shipment (LC has no 44A)', inv.placeOfReceipt, 'BHIWANDI');
eq('invoice.vessel     <- vessel/voyage (stage 4)', inv.vesselFlightNo, 'MAERSK KOWLOON V.632E');
eq('invoice.POL        <- LC 44E', inv.portOfLoading, 'NHAVA SHEVA PORT, INDIA');
eq('invoice.POD        <- LC 44F', inv.portOfDischarge, 'CAT LAI PORT, VIETNAM');
eq('invoice.final dest <- pre-shipment (LC has no 44B)', inv.finalDestination, 'HO CHI MINH CITY');
eq('invoice.country    <- LC applicant country', inv.countryOfFinalDestination, 'VIETNAM');
eq('invoice.terms      <- LC 45A incoterm + LC no/date', inv.termsOfDelivery, 'CFR CAT LAI PORT, VIETNAM (INCOTERMS 2020)\nLC NO.MK26ILC004471 DATE 260520');
eq('invoice.tenor      <- LC 42C', inv.paymentTenorLine, 'AT 60 DAYS FROM B/L DATE');
eq('invoice.pkgs       <- pre-shipment', inv.lineItems[0].noAndKindOfPkg, '800 CARTONS');
eq('invoice.qty        <- pre-shipment', inv.lineItems[0].quantity, 20000);
eq('invoice.uom        <- pre-shipment', inv.lineItems[0].uom, 'KG');
eq('invoice.rate       <- LC 45A rate', inv.lineItems[0].rate, 2.85);
eq('invoice.amount     <- pre-shipment', inv.totalAmount, 57000);
eq('invoice.words      <- computed from amount', inv.amountInWords, 'US DOLLAR FIFTY SEVEN THOUSAND ONLY');
truthy('invoice.desc       <- LC 45A goods with shipment quantity', /^NE 30\/1 100% COTTON COMBED COMPACT YARN FOR KNITTING\nQUANTITY: 20,000.00 KGS/.test(inv.lineItems[0].description), inv.lineItems[0].description);
truthy('invoice.desc       <- LC 46A H.S. code', /H\.S\.CODE NO\. 5205\.24/.test(inv.lineItems[0].description), inv.lineItems[0].description);
truthy('invoice: no FOB/freight split (LC does not ask for it)', !inv.showFobFreightSplit);

// Packing list
eq('packing.consignee  <- LC 46A', pl.consignee, BANK_CONSIGNEE);
eq('packing.marks      <- pre-shipment marks + container/seal (stage 4)', pl.marksAndNos, 'DELTA SPINNING\nCAT LAI\nC/NO. 1-800\nCONTAINER NO/SEAL NO :\nMSKU8812345 / SL445566');
eq('packing.weights    <- pre-shipment', `${pl.totalNetWtKg}/${pl.totalGrossWtKg}`, '20000/20850');

// B/L instruction
eq('bl.consignee       <- LC 46A', bl.consignee, BANK_CONSIGNEE);
eq('bl.notify          <- LC 46A "notify applicant"', bl.notifyParty1, APPLICANT);
eq('bl.notify2         <- none in LC', bl.notifyParty2, '');
eq('bl.freight         <- LC 46A "freight prepaid"', bl.freightStatus, 'FREIGHT PREPAID');
eq('bl.lc              <- LC 20/31C', `${bl.lcNumber} ${bl.lcDate}`, 'MK26ILC004471 260520');

// Bill of exchange
eq('boe.header         <- LC 20/31C + 46A H.S. code', boe.headerText, 'DRAWN UNDER DOCUMENTARY CREDIT NO : MK26ILC004471 DATE 260520\nLETTER OF CREDIT NUMBER MK26ILC004471 DATE 260520 H.S.CODE NO. 5205.24.\nCOUNTRY OF ORIGIN: INDIA');
eq('boe.date           <- B/L date (stage 4)', boe.date, '10-08-2026');
eq('boe.tenor          <- LC 42C', boe.tenor, 'AT 60 DAYS FROM B/L DATE');
eq('boe.drawee         <- LC 42A', boe.drawee, 'MKCBVNVX\nMEKONG COMMERCIAL BANK\nHO CHI MINH CITY');
eq('boe.payTo          <- negotiating bank chosen in stage 4', boe.payToOrderOf, 'DBS BANK INDIA LTD, GROUND FLOOR, EXPRESS TOWERS, NARIMAN POINT, MUMBAI - 400021, INDIA');
eq('boe.shippedBy      <- vessel (sea)', boe.packagesShippedBy, 'MAERSK KOWLOON V.632E');
eq('boe.blRef          <- B/L no + date', boe.blAirBillRef, 'MSKU7712345 DT.10/08/26');

// Certificate of origin
eq('coo.consignee      <- LC 50 applicant', coo.consignee, APPLICANT);
eq('coo.hs             <- LC 46A', coo.hsCode, '5205.24');
eq('coo.place/date     <- documents date (stage 4)', coo.placeAndDateOfIssue, 'MUMBAI, 12-08-2026');
truthy('coo.declaration names the importing country', /export to Vietnam/i.test(coo.originDeclaration || ''), coo.originDeclaration);

// Beneficiary certificates: only what this LC's 46A/47A ask for
eq('certs              <- one per LC clause asking for one', docs.beneficiaryCertificates.map(c => c.clauseRef).join(','), '46A.5');
truthy('cert email         <- LC 46A.5', /PURCHASING@DELTASPIN\.VN/i.test(docs.beneficiaryCertificates[0]?.text || ''));

// Nothing from the LOL/0138 documents (or sample presets) may appear anywhere
const all = JSON.stringify(docs).toUpperCase();
const foreign = ['SANJANA', 'SONALI', '033026020021', 'BENAPOLE', 'PETRAPOLE', 'MOTIJHEEL', '21,422', '21422', '76 ROLLS', '26554',
  '5209', 'S/0403', 'ASIATIC', 'PROVATI', 'BANGLADESH', 'BY ROAD', 'YARD', 'STANDARD CHARTERED', 'MEDU', 'WEBER'];
const leaks = foreign.filter(t => all.includes(t));
truthy('no value from another shipment appears in any document', leaks.length === 0, `found: ${leaks.join(', ')}`);

console.log(`\nvariant shipment: ${passed} checks passed, ${failures.length} failed\n`);
failures.forEach(f => console.log(`FAIL ${f}\n`));
process.exit(failures.length ? 1 : 0);
