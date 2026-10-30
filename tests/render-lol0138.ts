// Renders the LOL/0138 document set to PDF for visual comparison: npx tsx tests/render-lol0138.ts <outDir>
import fs from 'fs';
import path from 'path';
import { contract, lc, preShipment, shipment } from './fixtures/lol0138';
import { exportDataFromPreShipment, generateFinalDocumentSet } from '../src/lib/documentGenerators';
import {
  generateCommercialInvoicePDF,
  generatePackingListPDF,
  generateBillOfLadingPDF,
  generateCertificateOfOriginPDF,
  generateBillOfExchangePDF,
  generateAllBeneficiaryCertificatesPDF
} from '../src/lib/exportGenerators';

const out = process.argv[2] || 'out';
fs.mkdirSync(out, { recursive: true });
const docs = generateFinalDocumentSet(exportDataFromPreShipment(preShipment, lc, contract), lc, [], undefined, shipment);
const save = (name: string, pdf: { output: (t: 'arraybuffer') => ArrayBuffer }) =>
  fs.writeFileSync(path.join(out, name), Buffer.from(pdf.output('arraybuffer')));

save('invoice.pdf', generateCommercialInvoicePDF(docs.commercialInvoice));
save('packing-list.pdf', generatePackingListPDF(docs.packingList));
save('bl-instruction.pdf', generateBillOfLadingPDF(docs.billOfLading));
save('coo.pdf', generateCertificateOfOriginPDF(docs.certificateOfOrigin));
save('boe.pdf', generateBillOfExchangePDF(docs.billOfExchange));
save('beneficiary-certs.pdf', generateAllBeneficiaryCertificatesPDF(docs.beneficiaryCertificates));
console.log('written to', out);
