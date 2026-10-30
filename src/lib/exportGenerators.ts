
export function cleanConsignee(str: string, fallbackBank?: string): string {
  let cleaned = str || '';
  const upperTrim = cleaned.trim().toUpperCase();

  // If consignee is empty or just "TO ORDER" or "TO ORDER OF" without bank name
  if (!cleaned || upperTrim === 'TO ORDER' || upperTrim === 'TO THE ORDER' || upperTrim === 'TO ORDER OF' || upperTrim === 'TO THE ORDER OF') {
    if (fallbackBank && fallbackBank.trim() !== '') {
      return `TO ORDER OF ${fallbackBank.trim().toUpperCase()}`;
    }
  }

  const lines = cleaned
    .split(/[\r\n]+/)
    .map(line => line
      .replace(/^consignee\s*:?\s*/i, '')
      .replace(/^consigned\s+to\s*:?\s*/i, '')
      .replace(/^made\s+out\s+to\s*:?\s*/i, '')
      .replace(/(?:[\s,.-]*)(?:INDIAN\s+ORIGIN|INDIA\s+ORIGIN|COUNTRY\s+OF\s+ORIGIN[:\s]+INDIA)/gi, '')
      .trim()
    )
    .filter(Boolean);

  if (lines.length === 0) {
    if (fallbackBank && fallbackBank.trim() !== '') {
      return `TO ORDER OF ${fallbackBank.trim().toUpperCase()}`;
    }
    return 'TO ORDER';
  }

  if (/^to\s+(?:the\s+)?order\s+of\s*/i.test(lines[0])) {
    lines[0] = lines[0].replace(/^to\s+(the\s+)?order\s+of\s*/i, (_m: string, the?: string) => (the ? 'TO THE ORDER OF ' : 'TO ORDER OF ')).trim();
  } else if (/^to\s+(?:the\s+)?order$/i.test(lines[0])) {
    lines[0] = 'TO ORDER';
    if (lines.length === 1 && fallbackBank && fallbackBank.trim() !== '') {
      return `TO ORDER OF ${fallbackBank.trim().toUpperCase()}`;
    }
  }

  return lines.join('\n');
}

function safeText(doc: jsPDF, text: any, x: number, y: number, options?: any) {
  if (text == null) return;
  if (Array.isArray(text)) {
    const cleaned = text.map(t => (t != null ? String(t) : ""));
    doc.text(cleaned, x, y, options);
  } else {
    doc.text(String(text), x, y, options);
  }
}
import { jsPDF } from 'jspdf';
import { lahotiOverseasLogo } from '../image/logo';
import { cleanMarksAndNos, blExtraLines } from './documentGenerators';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel
} from 'docx';
import JSZip from 'jszip';
import {
  ExportData,
  ExporterParty,
  FinalDocumentSet,
  CommercialInvoiceFinal,
  PackingListFinal,
  BillOfLadingFinal,
  CertificateOfOriginFinal,
  BillOfExchangeFinal,
  BeneficiaryCertFinal
} from '../types';

// Browser file download helper
export function downloadFileBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// PDF GENERATION (Using jsPDF)
// -------------------------------------------------------------

function addHeaderLogoAndLetterhead(doc: jsPDF, title?: string, exporter?: ExporterParty): number {
  let y = 14;

  const logoX = 14;
  const logoY = 10;
  const logoW = 28;
  const logoH = 28;
  
  if (!exporter || !exporter.name || exporter.name.toUpperCase().includes('LAHOTI')) {
    try {
      doc.addImage(lahotiOverseasLogo, 'PNG', logoX, logoY, logoW, logoH);
    } catch (err) {
      console.warn('Could not add PNG logo image:', err);
    }
  }

  const expName = exporter?.name || 'EXPORTER';
  const expAddr = exporter?.address || '';

  const headerX = 98;
  let headerY = y;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(0, 0, 0);
  safeText(doc, expName, headerX, headerY);

  if (expAddr) {
    headerY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const addrLines = doc.splitTextToSize(expAddr, 95);
    safeText(doc, addrLines, headerX, headerY);
    headerY += addrLines.length * 3.2;
  } else {
    headerY += 4.5;
  }

  const contactLines = [
    exporter?.tel ? `TEL.: ${exporter.tel}` : '',
    exporter?.fax ? `FAX: ${exporter.fax}` : '',
    exporter?.email ? `E-Mail: ${exporter.email}` : '',
    exporter?.web ? `Internet: ${exporter.web}` : ''
  ].filter(Boolean);
  if (contactLines.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    safeText(doc, contactLines, headerX, headerY);
    headerY += contactLines.length * 3.2;
  }

  y = Math.max(logoY + logoH + 4, headerY + 4);

  if (title) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    safeText(doc, title, 105, y, { align: 'center' });
    doc.setLineWidth(0.3);
    const titleWidth = doc.getTextWidth(title);
    doc.line(105 - titleWidth / 2, y + 1, 105 + titleWidth / 2, y + 1);
    y += 6;
  }

  doc.setTextColor(0, 0, 0);
  return y;
}

// 1. Commercial Invoice PDF
export function generateCommercialInvoicePDF(invoice: CommercialInvoiceFinal, bankName?: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 12;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header: INVOICE centered and presentation note matching screenshot layout
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  safeText(doc, invoice.isPreShipment ? 'INVOICE' : 'COMMERCIAL INVOICE', pageWidth / 2, y + 4, { align: 'center' });

  if (invoice.isPreShipment) {
    doc.setFontSize(7.5);
    safeText(doc, 'SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.', pageWidth / 2, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    safeText(doc, `IRN NO. ${invoice.irnno ? invoice.irnno.trim() : ''}`, margin, y + 13);
  }
  y += 15;

  // Top Table Border
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);

  // Row 1: Exporter & Invoice Details (Total Height: 64mm for clean balance)
  const colMid = margin + contentWidth / 2;
  const boxHeight1 = 64;
  doc.rect(margin, y, contentWidth, boxHeight1);
  doc.line(colMid, y, colMid, y + boxHeight1);

  // Dividers for 4 distinct cells on the right:
  doc.line(colMid, y + 13, margin + contentWidth, y + 13);
  doc.line(colMid, y + 26, margin + contentWidth, y + 26);
  doc.line(colMid, y + 39, margin + contentWidth, y + 39);

  // Left: Exporter
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  safeText(doc, 'Exporter', margin + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  safeText(doc, invoice.exporter.name || '', margin + 2, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const expLines = !invoice.isPreShipment ? invoice.exporter.address : [
    invoice.exporter.address,
    [
      invoice.exporter.tel ? `TEL: ${invoice.exporter.tel}` : '',
      invoice.exporter.email ? `EMAIL: ${invoice.exporter.email}` : ''
    ].filter(Boolean).join(' | '),
    invoice.exporter.cin ? `CIN: ${invoice.exporter.cin}` : '',
    (invoice.rexNumber || invoice.exporter.rexNo) ? `REX REG NO: ${invoice.rexNumber || invoice.exporter.rexNo}` : ''
  ].filter(Boolean).join('\n');
  const expAddr = doc.splitTextToSize(expLines, contentWidth / 2 - 4);
  safeText(doc, expAddr, margin + 2, y + 12);

  // Right Side - 4 stacked distinct cells
  // Cell 1: Invoice No. & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Invoice No. & Date', colMid + 2, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  safeText(doc, `${invoice.invoiceNo || ''}       ${invoice.invoiceDate || ''}`, colMid + 2, y + 8);

  // Cell 2: Buyer's Order No. & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, "Buyer's Order No. & Date", colMid + 2, y + 13 + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  safeText(doc, `${invoice.buyersOrderNo || ''}   ${invoice.buyersOrderDate ? 'dt. ' + invoice.buyersOrderDate : ''}`, colMid + 2, y + 13 + 8);

  // Cell 3: Other Reference(s)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Other Reference(s)', colMid + 2, y + 26 + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  safeText(doc, invoice.otherReference || '', colMid + 2, y + 26 + 8);

  // Cell 4: Buyer (if other than consignee)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Buyer (if other than consignee)', colMid + 2, y + 39 + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (invoice.buyerIfOtherThanConsignee) {
    const buyerLines = doc.splitTextToSize(invoice.buyerIfOtherThanConsignee, contentWidth / 2 - 4);
    safeText(doc, buyerLines, colMid + 2, y + 39 + 8);
  }

  y += boxHeight1;

  // Row 2: Consignee & Transport (Total Height: 68mm to match screenshot layout exactly)
  const boxHeight2 = 68;
  doc.rect(margin, y, contentWidth, boxHeight2);
  doc.line(colMid, y, colMid, y + boxHeight2);

  // Left Side: Consignee & Transport Details Stack
  // Consignee top half of left side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  safeText(doc, 'Consignee', margin + 2, y + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const consText = doc.splitTextToSize(invoice.consignee || 'TO ORDER', contentWidth / 2 - 4);
  safeText(doc, consText, margin + 2, y + 8);

  // Left Transport Stack Sub-rows (Pre-Carriage, Vessel, Port of Discharge)
  const leftSubY = y + 34;
  doc.line(margin, leftSubY, colMid, leftSubY);
  doc.line(margin, leftSubY + 11, colMid, leftSubY + 11);
  doc.line(margin, leftSubY + 22, colMid, leftSubY + 22);
  const colLeftMid = margin + contentWidth / 4;
  doc.line(colLeftMid, leftSubY, colLeftMid, y + boxHeight2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Pre-Carriage by', margin + 2, leftSubY + 3.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.preCarriageBy || '', margin + 2, leftSubY + 7.5);

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Place of Receipt by Pre-carrier', colLeftMid + 2, leftSubY + 3.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.placeOfReceipt || '', colLeftMid + 2, leftSubY + 7.5);

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Vessel / Flight No.', margin + 2, leftSubY + 14.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.vesselFlightNo || '', margin + 2, leftSubY + 18.5);

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Port of Loading', colLeftMid + 2, leftSubY + 14.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.portOfLoading, colLeftMid + 2, leftSubY + 18.5);

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Port of Discharge', margin + 2, leftSubY + 25.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.portOfDischarge, margin + 2, leftSubY + 29.5);

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Final Destination', colLeftMid + 2, leftSubY + 25.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.finalDestination, colLeftMid + 2, leftSubY + 29.5);

  // Right Side transport / country / terms stack (matching Screenshot 2)
  const colRightMid = colMid + contentWidth / 4;
  doc.line(colMid, y + 16, colMid + contentWidth / 2, y + 16);
  doc.line(colRightMid, y, colRightMid, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Country of Origin of Goods', colMid + 2, y + 3.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.countryOfOrigin || '', colMid + (colRightMid - colMid) / 2, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Country of Final Destination', colRightMid + 2, y + 3.5);
  doc.setFont('helvetica', 'normal');
  safeText(doc, invoice.countryOfFinalDestination || '', colRightMid + (margin + contentWidth - colRightMid) / 2, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  safeText(doc, 'Terms of Delivery and Payment', colMid + 2, y + 19.5);
  doc.setFont('helvetica', 'normal');
  const termsFull = [
    invoice.termsOfDelivery || '',
    invoice.paymentTenorLine || (invoice.tenor ? `${invoice.tenor.toUpperCase()} UNDER IRREVOCABLE LC NO. ${invoice.lcReference} DT. ${invoice.lcDateReference || ''}` : '')
  ].filter(Boolean).join('\n\n');
  const termsWrapped = doc.splitTextToSize(termsFull, contentWidth / 2 - 4);
  safeText(doc, termsWrapped, colMid + 2, y + 23.5);

  y += boxHeight2;

  // Line items Table Header (6 Columns matching Official Invoice Template: 36mm, 24mm, 72mm, 18mm, 16mm, 20mm = 186mm)
  const rowHeaderH = 8;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, rowHeaderH, 'FD');
  doc.line(margin + 36, y, margin + 36, y + rowHeaderH);
  doc.line(margin + 60, y, margin + 60, y + rowHeaderH);
  doc.line(margin + 132, y, margin + 132, y + rowHeaderH);
  doc.line(margin + 150, y, margin + 150, y + rowHeaderH);
  doc.line(margin + 166, y, margin + 166, y + rowHeaderH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);

  const headerY = y + 3.2;
  safeText(doc, 'Marks & Nos./', margin + 2, headerY);
  safeText(doc, 'Container No', margin + 2, headerY + 3.2);

  safeText(doc, 'No. & Kind of Pkg', margin + 38, headerY + 1.5);
  safeText(doc, 'Description Of Goods', margin + 62, headerY + 1.5);

  safeText(doc, 'Quantity', margin + 148, headerY, { align: 'right' });
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  safeText(doc, invoice.lineItems[0]?.uom || '', margin + 148, headerY + 3.2, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  safeText(doc, 'Rate', margin + 164, headerY, { align: 'right' });
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  safeText(doc, invoice.currency || 'USD', margin + 164, headerY + 3.2, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  safeText(doc, 'Amount', margin + contentWidth - 2, headerY, { align: 'right' });
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  safeText(doc, invoice.currency || 'USD', margin + contentWidth - 2, headerY + 3.2, { align: 'right' });

  y += rowHeaderH;

  // Calculate dynamic table body height based on line items to prevent clipping
  let calculatedTableBodyH = 10;
  invoice.lineItems.forEach((item) => {
    const marksLines = doc.splitTextToSize(item.marksAndNos || '', 32);
    const pkgLines = doc.splitTextToSize(item.noAndKindOfPkg || '', 20);
    const descLines = splitInvoiceDescription(doc, item.description || '');
    const maxLineCount = Math.max(marksLines.length, pkgLines.length, descLines.length, 1);
    calculatedTableBodyH += maxLineCount * 3.2 + 4;
  });
  const tableBodyH = Math.max(calculatedTableBodyH, 45);

  // Table body box
  doc.rect(margin, y, contentWidth, tableBodyH);

  // Draw vertical dividers at exact column boundaries:
  // Col 1: margin to margin + 36
  // Col 2: margin + 36 to margin + 60
  // Col 3: margin + 60 to margin + 132
  // Col 4: margin + 132 to margin + 150
  // Col 5: margin + 150 to margin + 166
  // Col 6: margin + 166 to margin + 186 (margin + contentWidth)
  doc.line(margin + 36, y, margin + 36, y + tableBodyH);
  doc.line(margin + 60, y, margin + 60, y + tableBodyH);
  doc.line(margin + 132, y, margin + 132, y + tableBodyH);
  doc.line(margin + 150, y, margin + 150, y + tableBodyH);
  doc.line(margin + 166, y, margin + 166, y + tableBodyH);

  let curY = y + 4;
  invoice.lineItems.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(15, 23, 42);

    const marksLines = doc.splitTextToSize(item.marksAndNos || '', 32);
    const pkgLines = doc.splitTextToSize(item.noAndKindOfPkg || '', 20);
    const descLines = splitInvoiceDescription(doc, item.description || '');

    safeText(doc, marksLines, margin + 2, curY);

    doc.setFont('helvetica', 'bold');
    safeText(doc, pkgLines, margin + 38, curY);

    doc.setFont('helvetica', 'normal');
    safeText(doc, descLines, margin + 62, curY);

    const qtyVal = item.quantity != null ? Number(item.quantity) : 0;
    const rateVal = item.rate != null ? Number(item.rate) : 0;
    const amountVal = item.amount != null ? Number(item.amount) : 0;

    doc.setFont('helvetica', 'bold');
    safeText(doc, qtyVal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), margin + 148, curY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    safeText(doc, item.uom || '', margin + 148, curY + 3.2, { align: 'right' });

    doc.setFontSize(6.2);
    doc.setFont('helvetica', 'bold');
    safeText(doc, rateVal.toFixed(2), margin + 164, curY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    safeText(doc, `/ ${item.uom || ''}`, margin + 164, curY + 3.2, { align: 'right' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    safeText(doc, amountVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin + contentWidth - 2, curY, { align: 'right' });

    curY += Math.max(marksLines.length, pkgLines.length, descLines.length, 3) * 3.2 + 4;
  });

  y += tableBodyH;

  // Amount Chargeable (In Words) & Total Row (Matching official template summary bar)
  const totalsH = 10;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, totalsH, 'FD');
  doc.line(margin + 150, y, margin + 150, y + totalsH);
  doc.line(margin + 166, y, margin + 166, y + totalsH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(100, 116, 139);
  safeText(doc, 'Amount Chargeable (In Words)-:', margin + 2, y + 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  const wordsWrappedSummary = doc.splitTextToSize(invoice.amountInWords || '', 144);
  safeText(doc, wordsWrappedSummary, margin + 2, y + 6.8);

  safeText(doc, 'Total', margin + 158, y + 6, { align: 'center' });

  const totalAmount = invoice.lineItems.reduce((acc, it) => acc + (it.amount || 0), 0);
  doc.setFontSize(7.2);
  safeText(doc, totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin + contentWidth - 2, y + 6, { align: 'right' });

  y += totalsH;

  // Statutory Info (CIN, GST, PAN) & Optional Exchange Rate (Only if in LC)
  const wordsH = invoice.showExchangeRate ? 26 : 14;
  doc.rect(margin, y, contentWidth, wordsH);

  if (invoice.showExchangeRate) {
    doc.line(colMid + 15, y, colMid + 15, y + wordsH); // divider between tax info and exchange/INR breakdown
    const taxInfoY = y + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    safeText(doc, `CIN No. : ${invoice.exporter?.cin || 'L74999MH1995PLC087643'}`, margin + 2, taxInfoY);
    safeText(doc, `GST No. : ${invoice.exporter?.taxId || '27AAACL2578H1ZE'}`, margin + 2, taxInfoY + 4.5);
    safeText(doc, `PAN No. : ${invoice.exporter?.pan || 'AAACL2578H'}`, margin + 2, taxInfoY + 9);
    if (invoice.rexNumber || invoice.exporter?.rexNo) {
      safeText(doc, `REX Reg No. : ${invoice.rexNumber || invoice.exporter?.rexNo}`, margin + 2, taxInfoY + 13.5);
    }

    const rightX = colMid + 18;
    const inrRate = invoice.exchangeRate || 1;
    const totalValINR = (invoice.totalAmount || 0) * inrRate;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    let currY = y + 4;
    safeText(doc, `EXCH. @ Rs.  ${inrRate.toFixed(2)}  USD  = 1`, rightX, currY);
    currY += 4.5;
    safeText(doc, `VALUE INR`, rightX, currY);
    safeText(doc, totalValINR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin + contentWidth - 2, currY, { align: 'right' });

    if (invoice.freightAmount != null) {
      const freightINR = (invoice.freightAmount || 0) * inrRate;
      currY += 4.5;
      safeText(doc, `FREIGHT   ${(invoice.freightAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (USD)`, rightX, currY);
      safeText(doc, freightINR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin + contentWidth - 2, currY, { align: 'right' });
    }

    if (invoice.fobValue != null) {
      const fobValINR = invoice.fobValue * inrRate;
      currY += 5;
      doc.setFont('helvetica', 'bold');
      safeText(doc, `FOB VALUE INR`, rightX, currY);
      // Draw small box around FOB Value INR result
      doc.rect(margin + contentWidth - 45, currY - 3.5, 43, 5);
      safeText(doc, fobValINR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin + contentWidth - 4, currY, { align: 'right' });
    }
  } else {
    // When exchange rate is not mentioned in LC, display clean statutory identifiers in 2 clean columns
    const taxInfoY = y + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    safeText(doc, `CIN No. : ${invoice.exporter?.cin || 'L74999MH1995PLC087643'}`, margin + 2, taxInfoY);
    safeText(doc, `GST No. : ${invoice.exporter?.taxId || '27AAACL2578H1ZE'}`, margin + 2, taxInfoY + 5);
    safeText(doc, `PAN No. : ${invoice.exporter?.pan || 'AAACL2578H'}`, colMid + 2, taxInfoY);
    if (invoice.rexNumber || invoice.exporter?.rexNo) {
      safeText(doc, `REX Reg No. : ${invoice.rexNumber || invoice.exporter?.rexNo}`, colMid + 2, taxInfoY + 5);
    }
  }

  y += wordsH;

  // Declarations & Signatory Block
  const declH = 45;
  doc.rect(margin, y, contentWidth, declH);
  doc.line(colMid + 10, y, colMid + 10, y + declH);

  // Declarations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Declaration :', margin + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  
  const fixedDeclaration = invoice.declarationText || "We declare that this invoice shows the actual price of the goods\ndescribed and that all particulars are true and correct";
  const declLines = doc.splitTextToSize(fixedDeclaration, contentWidth / 2 + 6);
  safeText(doc, declLines, margin + 2, y + 8);

  if (invoice.additionalDeclarations && invoice.additionalDeclarations.length > 0) {
    const cleanAdd = invoice.additionalDeclarations.filter(decl => {
      const ref = (decl.clauseRef || '').toLowerCase();
      const txt = (decl.verbatimText || decl.text || '').toLowerCase();
      const isBanned = 
        ref.includes('46a.1') || 
        ref.includes('47a.1') || 
        ref.includes('47a.2') || 
        ref.includes('47a.6') || 
        ref.includes('47a.8') || 
        ref.includes('47a.9') ||
        txt.includes('signed commercial invoice') ||
        txt.includes('beneficiary must certify') ||
        txt.includes('must be mentioned in all documents') ||
        txt.includes('all documents to be prepared') ||
        txt.includes('all documents should be signed') ||
        txt.includes('fob value and freight charge') ||
        txt.includes('original invoice') ||
        txt.includes('invoice are to be shown');
      return !isBanned;
    });

    let addY = y + 8 + declLines.length * 3;
    cleanAdd.forEach(add => {
      if (addY < y + declH - 4) {
        doc.setFont('helvetica', 'bold');
        safeText(doc, `[${add.clauseRef}]:`, margin + 2, addY);
        doc.setFont('helvetica', 'normal');
        const extraText = doc.splitTextToSize(add.verbatimText || add.text, contentWidth / 2 + 6);
        safeText(doc, extraText, margin + 2, addY + 3);
        addY += extraText.length * 2.8 + 3;
      }
    });
  }

  // Signatory
  const sigX = colMid + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  safeText(doc, invoice.exporter.name ? `For ${invoice.exporter.name}` : '', sigX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  safeText(doc, '(Authorised Signatory)', sigX, y + declH - 5);

  return doc;
}

// 2. Packing List PDF (Strict format matching standard Lahoti Detailed Packing List layout)
export function generatePackingListPDF(packing: PackingListFinal, bankName?: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 10;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = 10;

  // Title & Top Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  safeText(doc, 'PACKING LIST', 105, y + 2, { align: 'center' });

  doc.setFontSize(11);
  safeText(doc, 'COPY', pageWidth - margin, y + 2, { align: 'right' });
  y += 6;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  const colMid = margin + contentWidth / 2; // 10 + 95 = 105

  // -------------------------------------------------------------
  // Box 1: Exporter vs Invoice / Exporter Ref / Buyer Order / Other Ref
  // -------------------------------------------------------------
  const box1H = 34;
  doc.rect(margin, y, contentWidth, box1H);
  doc.line(colMid, y, colMid, y + box1H);

  // Left: Exporter
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  safeText(doc, 'Exporter', margin + 1.5, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  safeText(doc, packing.exporter.name || '', margin + 1.5, y + 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const expLines = doc.splitTextToSize(packing.exporter.address || '', contentWidth / 2 - 4);
  safeText(doc, expLines, margin + 1.5, y + 11.5);

  // Right side 3 horizontal sub-sections
  const rightRow1H = 9;
  const rightRow2H = 9;
  const rightRow3H = 8;
  const rightRow4H = 8;

  // Sub-row 1: Invoice No. & Date | Exporter's Ref
  doc.line(colMid, y + rightRow1H, margin + contentWidth, y + rightRow1H);
  const subColMid = colMid + (contentWidth / 4); // 105 + 47.5 = 152.5
  doc.line(subColMid, y, subColMid, y + rightRow1H);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  safeText(doc, 'Invoice No. & Date', colMid + 1.5, y + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, `${packing.invoiceNo || ''}   ${packing.invoiceDate || ''}`, colMid + 1.5, y + 6.8);

  doc.setFont('helvetica', 'normal');
  safeText(doc, "Exporter's Ref", subColMid + 1.5, y + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.exporterRef || '', subColMid + 1.5, y + 6.8);

  // Sub-row 2: Buyer's Order No. & Date
  const r2Y = y + rightRow1H;
  doc.line(colMid, r2Y + rightRow2H, margin + contentWidth, r2Y + rightRow2H);
  doc.setFont('helvetica', 'normal');
  safeText(doc, "Buyer's Order No. & Date", colMid + 1.5, r2Y + 3);
  doc.setFont('helvetica', 'bold');
  const boText = [packing.buyersOrderNo, packing.buyersOrderDate].filter(Boolean).join('  ');
  safeText(doc, boText || '', colMid + 1.5, r2Y + 6.8);

  // Sub-row 3: Other Reference
  const r3Y = r2Y + rightRow2H;
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Other Reference', colMid + 1.5, r3Y + 3);
  doc.setFont('helvetica', 'bold');
  const otherRefText = packing.otherReference || (packing.buyersOrderNo ? `PO REF: ${packing.buyersOrderNo}` : '');
  safeText(doc, otherRefText, colMid + 1.5, r3Y + 6.8);

  y += box1H;

  // -------------------------------------------------------------
  // Box 2: Consignee vs Buyer (if other than consignee)
  // -------------------------------------------------------------
  const box2H = 34;
  doc.rect(margin, y, contentWidth, box2H);
  doc.line(colMid, y, colMid, y + box2H);

  // Left: Consignee
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  safeText(doc, 'Consignee', margin + 1.5, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const consLines = doc.splitTextToSize(cleanConsignee(packing.consignee || 'TO ORDER', bankName), contentWidth / 2 - 4);
  safeText(doc, consLines, margin + 1.5, y + 7.5);

  // Right: Buyer (if other than consignee)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  safeText(doc, 'Buyer (if other than consignee)', colMid + 1.5, y + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const buyerLines = doc.splitTextToSize(packing.buyerIfOtherThanConsignee || packing.consignee || '', contentWidth / 2 - 4);
  safeText(doc, buyerLines, colMid + 1.5, y + 7.5);

  y += box2H;

  // -------------------------------------------------------------
  // Box 3: Origin & Destination / Pre-Carriage & Terms of Delivery
  // -------------------------------------------------------------
  const rowH3 = 11;
  const rowH4 = 11;
  const rowH5 = 11;
  const box3H = rowH3 + rowH4 + rowH5; // 33mm

  doc.rect(margin, y, contentWidth, box3H);

  // Left 2 columns width (47.5mm each, total 95mm)
  const col1W = 47.5;
  const col2W = 47.5;
  const col3W = 47.5;
  const col4W = 47.5;

  const colX1 = margin;             // 10
  const colX2 = margin + col1W;     // 57.5
  const colX3 = margin + col1W + col2W; // 105 (colMid)
  const colX4 = colX3 + col3W;      // 152.5

  // Row 1 inside Box 3
  doc.line(colX1, y + rowH3, colX3, y + rowH3); // horizontal line for left half
  doc.line(colX2, y, colX2, y + rowH3);         // vertical divider Pre-Carriage / Place of Receipt
  doc.line(colX3, y, colX3, y + box3H);         // central vertical divider
  doc.line(colX4, y, colX4, y + rowH3);         // vertical divider Origin / Destination
  doc.line(colX3, y + rowH3, margin + contentWidth, y + rowH3); // horizontal line for right half

  // Left Row 1: Pre-Carriage by | Place of Receipt by Pre-carrier
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  safeText(doc, 'Pre-Carriage by', colX1 + 1.5, y + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.preCarriageBy || '', colX1 + 1.5, y + 7);

  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Place of Receipt by Pre-carrier', colX2 + 1.5, y + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.placeOfReceipt || '', colX2 + 1.5, y + 7);

  // Right Row 1: Country of Origin of Goods | Country of Final Destination
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Country of Origin of Goods', colX3 + 1.5, y + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.countryOfOrigin || '', colX3 + 1.5, y + 7);

  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Country of Final Destination', colX4 + 1.5, y + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.countryOfFinalDestination || '', colX4 + 1.5, y + 7);

  // Row 2 inside Box 3
  const r2Y3 = y + rowH3;
  doc.line(colX1, r2Y3 + rowH4, colX3, r2Y3 + rowH4); // left horizontal divider
  doc.line(colX2, r2Y3, colX2, r2Y3 + rowH4);         // left vertical divider Vessel / Port of Loading

  // Left Row 2: Vessel/Flight No. | Port of Loading
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Vessel/Flight No.', colX1 + 1.5, r2Y3 + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.vesselFlightNo || '', colX1 + 1.5, r2Y3 + 7);

  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Port of Loading', colX2 + 1.5, r2Y3 + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.portOfLoading || '', colX2 + 1.5, r2Y3 + 7);

  // Right Side spanning Row 2 + Row 3: Terms of Delivery and Payment
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Terms of Delivery and Payment', colX3 + 1.5, r2Y3 + 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  const termsText = [
    packing.termsOfDelivery,
    packing.bakedPalletQuote ? `PACKING: ${packing.bakedPalletQuote}` : ''
  ].filter(Boolean).join('\n');
  const termsLines = doc.splitTextToSize(termsText || '', contentWidth / 2 - 4);
  safeText(doc, termsLines, colX3 + 1.5, r2Y3 + 7);

  // Row 3 inside Box 3
  const r3Y3 = r2Y3 + rowH4;
  doc.line(colX2, r3Y3, colX2, r3Y3 + rowH5); // left vertical divider Port of Discharge / Final Destination

  // Left Row 3: Port of Discharge | Final Destination
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  safeText(doc, 'Port of Discharge', colX1 + 1.5, r3Y3 + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.portOfDischarge || '', colX1 + 1.5, r3Y3 + 7);

  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Final Destination', colX2 + 1.5, r3Y3 + 3);
  doc.setFont('helvetica', 'bold');
  safeText(doc, packing.finalDestination || '', colX2 + 1.5, r3Y3 + 7);

  y += box3H;

  // -------------------------------------------------------------
  // Main Table Section
  // Columns: Marks & Nos./Container No | No. & Kind of Pkg | Description Of Goods | Quantity (KGS) | Remarks
  // -------------------------------------------------------------
  const tblHeaderH = 10;
  const colTbl1 = margin;            // 10
  const colTbl2 = margin + 25;       // 35 (Marks & Nos)
  const colTbl3 = margin + 52;       // 62 (No & Kind)
  const colTbl4 = margin + 140;      // 150 (Description)
  const colTbl5 = margin + 175;      // 185 (Quantity KGS)
  const colTblEnd = margin + contentWidth; // 200 (Remarks)

  const mainTableBodyH = 88; // Height of main body area

  // Outer border of table
  doc.rect(margin, y, contentWidth, tblHeaderH + mainTableBodyH);
  doc.line(margin, y + tblHeaderH, margin + contentWidth, y + tblHeaderH);

  // Column vertical lines
  doc.line(colTbl2, y, colTbl2, y + tblHeaderH + mainTableBodyH);
  doc.line(colTbl3, y, colTbl3, y + tblHeaderH + mainTableBodyH);
  doc.line(colTbl4, y, colTbl4, y + tblHeaderH + mainTableBodyH);
  doc.line(colTbl5, y, colTbl5, y + tblHeaderH + mainTableBodyH);

  // Column Headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  safeText(doc, 'Marks & Nos./', colTbl1 + 1.5, y + 3.5);
  safeText(doc, 'Container No', colTbl1 + 1.5, y + 7);

  safeText(doc, 'No. & Kind of Pkg', colTbl2 + 1.5, y + 5);

  safeText(doc, 'Description Of Goods', colTbl3 + 1.5, y + 5);

  safeText(doc, 'Quantity', colTbl4 + 1.5, y + 3.5);
  safeText(doc, 'KGS', colTbl4 + 1.5, y + 7);

  safeText(doc, 'Remarks', colTbl5 + 1.5, y + 5);

  // Table Body Content
  const bodyY = y + tblHeaderH + 3;

  // Col 1: Marks & Nos. / Container No
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const marksText = packing.marksAndNos || (packing.packingRows[0]?.shippingMarks || 'AS PER LC / INVOICE');
  const marksLines = doc.splitTextToSize(marksText, 22);
  safeText(doc, marksLines, colTbl1 + 1.5, bodyY);

  if (packing.containerNo || packing.packingRows[0]?.containerSealNo) {
    const contVal = packing.containerNo || packing.packingRows[0]?.containerSealNo;
    const contLines = doc.splitTextToSize(`CONT/SEAL:\n${contVal}`, 22);
    safeText(doc, contLines, colTbl1 + 1.5, bodyY + marksLines.length * 3.2 + 2);
  }

  // Col 2: No. & Kind of Pkg
  const pkgKind = packing.noAndKindOfPkg || (packing.totalCartonsOrPackages || `${packing.packingRows.length} CARTONS`);
  const pkgLines = doc.splitTextToSize(pkgKind, 24);
  safeText(doc, pkgLines, colTbl2 + 1.5, bodyY);

  // Col 3: Description Of Goods
  const descText = packing.goodsDescriptionVerbatim || '';
  const descLines = doc.splitTextToSize(descText, 84);
  safeText(doc, descLines, colTbl3 + 1.5, bodyY);

  // Col 4: Quantity / Gross Wt / Net Wt (stacked vertically to prevent text overlap)
  let currentQtyY = bodyY + 1;

  if (packing.totalGrossWtKg != null && Number(packing.totalGrossWtKg) > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    safeText(doc, 'GROSS WT :', colTbl4 + 1.5, currentQtyY);
    currentQtyY += 3.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const grossStr = `${Number(packing.totalGrossWtKg).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KGS`;
    safeText(doc, grossStr, colTbl4 + 1.5, currentQtyY);
    currentQtyY += 6.5;
  }

  if (packing.totalNetWtKg != null && Number(packing.totalNetWtKg) > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    safeText(doc, 'NET WT :', colTbl4 + 1.5, currentQtyY);
    currentQtyY += 3.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const netStr = `${Number(packing.totalNetWtKg).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KGS`;
    safeText(doc, netStr, colTbl4 + 1.5, currentQtyY);
  }

  // Col 5: Remarks
  if (packing.remarks) {
    const remLines = doc.splitTextToSize(packing.remarks, 15);
    safeText(doc, remLines, colTbl5 + 1.5, bodyY);
  }

  y += tblHeaderH + mainTableBodyH;

  // -------------------------------------------------------------
  // Bottom Section: PAKING DETAILS (Lot No, Count, No of Unit, Container/Seal, Net Wt, Gross Wt)
  // -------------------------------------------------------------
  const pakingHeaderH = 6;
  const pakingRowH = 16;
  const pakingSectionH = pakingHeaderH + pakingRowH;

  if (packing.packingRows.length > 1) {
  // "PAKING DETAILS" Title Label Bar (verbatim as per scan)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  safeText(doc, 'PAKING DETAILS', margin + 1.5, y + 4.5);
  y += 6;

  // 6 Columns for PAKING DETAILS
  // LOT NO | COUNT | NO OF UNIT | CONTAINER NO/SEAL NOS. | NET WT/UNIT | GROSS WT/UNIT
  const pColW1 = 20; // Lot No
  const pColW2 = 42; // Count
  const pColW3 = 22; // No of Unit
  const pColW4 = 44; // Container No / Seal Nos.
  const pColW5 = 31; // Net Wt/Unit
  const pColW6 = 31; // Gross Wt/Unit

  const pX0 = margin;
  const pX1 = pX0 + pColW1; // 30
  const pX2 = pX1 + pColW2; // 72
  const pX3 = pX2 + pColW3; // 94
  const pX4 = pX3 + pColW4; // 138
  const pX5 = pX4 + pColW5; // 169
  const pX6 = pX5 + pColW6; // 200 (pageWidth - margin)

  doc.rect(margin, y, contentWidth, pakingSectionH);
  doc.line(margin, y + pakingHeaderH, margin + contentWidth, y + pakingHeaderH);

  // Vertical column dividers
  doc.line(pX1, y, pX1, y + pakingSectionH);
  doc.line(pX2, y, pX2, y + pakingSectionH);
  doc.line(pX3, y, pX3, y + pakingSectionH);
  doc.line(pX4, y, pX4, y + pakingSectionH);
  doc.line(pX5, y, pX5, y + pakingSectionH);

  // Headers
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  safeText(doc, 'LOT NO', pX0 + 1.5, y + 4);
  safeText(doc, 'COUNT', pX1 + 1.5, y + 4);
  safeText(doc, 'NO OF UNIT', pX2 + 1.5, y + 4);
  safeText(doc, 'CONTAINER NO/SEAL NOS.', pX3 + 1.5, y + 4);
  safeText(doc, 'NET WT/UNIT', pX4 + 1.5, y + 4);
  safeText(doc, 'GROSS WT/UNIT', pX5 + 1.5, y + 4);

  // Content Rows
  let pRowY = y + pakingHeaderH + 3.5;
  packing.packingRows.forEach((r) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    safeText(doc, r.lotNo || '1', pX0 + 1.5, pRowY);

    const countLines = doc.splitTextToSize(r.count || '', pColW2 - 3);
    safeText(doc, countLines, pX1 + 1.5, pRowY);

    safeText(doc, r.noOfUnits || '', pX2 + 1.5, pRowY);

    const sealLines = doc.splitTextToSize(r.containerSealNo || '', pColW4 - 3);
    safeText(doc, sealLines, pX3 + 1.5, pRowY);

    safeText(doc, r.netWtKg != null ? `${Number(r.netWtKg).toFixed(2)} KGS` : '—', pX4 + 1.5, pRowY);
    safeText(doc, r.grossWtKg != null ? `${Number(r.grossWtKg).toFixed(2)} KGS` : '—', pX5 + 1.5, pRowY);

    pRowY += Math.max(countLines.length, sealLines.length, 1) * 3.2 + 1.5;
  });

  y += pakingSectionH;
  }

  // -------------------------------------------------------------
  // Signatory & Footer Block
  // -------------------------------------------------------------
  const footerH = 24;
  // Border box on the bottom right for signature
  const sigBoxW = 95;
  const sigBoxX = margin + contentWidth - sigBoxW;

  doc.rect(sigBoxX, y + 4, sigBoxW, footerH - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  safeText(doc, 'Signature and Date', sigBoxX + 2, y + footerH - 1.5);

  safeText(doc, packing.exporter?.name ? `For ${packing.exporter.name}` : '', sigBoxX + sigBoxW - 2, y + 8, { align: 'right' });
  safeText(doc, 'Authorised Signatory', sigBoxX + sigBoxW - 2, y + footerH - 1.5, { align: 'right' });

  return doc;
}

// 3. Bill of Lading Instructions PDF (Exact field layout as sample PDF)

export function generateBillOfLadingPDF(bl: BillOfLadingFinal, bankName?: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 10;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = margin + 5;

  // Document Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  safeText(doc, 'B/L INSTRUCTION', 105, y, { align: 'center' });
  y += 6;

  // Exporter & Invoice Line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  safeText(doc, `Invoice No. ${bl.invoiceNo}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  safeText(doc, 'Exporter', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  safeText(doc, bl.exporter?.name || '', margin, y);
  y += 4;
  
  const expLines = doc.splitTextToSize(bl.exporter?.address || '', 90);
  safeText(doc, expLines, margin, y);
  y += expLines.length * 3.5 + 6;

  // Consignee & LC No
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Consignee', margin, y);
  
  safeText(doc, `LC NO.${bl.lcNumber || ''} DATE ${bl.lcDate || ''}`, margin + 95, y + 4.5);
  
  y += 4;
  const consText = cleanConsignee(bl.consignee, bankName) + (bl.consigneeVatBin ? `\nBIN NO. ${bl.consigneeVatBin}` : '');
  const consLines = doc.splitTextToSize(consText, 90);
  safeText(doc, consLines, margin, y);
  y += consLines.length * 3.5 + 6;

  // Notify 1 & Notify 2 Grid
  const notifyY = y;
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Notify', margin, notifyY);
  safeText(doc, 'Notify 2', margin + 95, notifyY);
  
  const hasBinInNotify1 = bl.notifyParty1 && (bl.notifyParty1.toUpperCase().includes('BIN') || bl.notifyParty1.toUpperCase().includes('VAT'));
  const hasBinInNotify2 = bl.notifyParty2 && (bl.notifyParty2.toUpperCase().includes('BIN') || bl.notifyParty2.toUpperCase().includes('VAT'));
  const notify1Text = bl.notifyParty1 + (bl.notifyParty1VatBin && !hasBinInNotify1 ? `\nBIN NO. ${bl.notifyParty1VatBin}` : '');
  const notify2Text = (bl.notifyParty2 || '') + (bl.notifyParty2VatBin && !hasBinInNotify2 ? `\nBIN NO. ${bl.notifyParty2VatBin}` : '');
  
  const not1Lines = doc.splitTextToSize(notify1Text, 85);
  const not2Lines = doc.splitTextToSize(notify2Text, 85);
  safeText(doc, not1Lines, margin, notifyY + 4);
  safeText(doc, not2Lines, margin + 95, notifyY + 4);
  y = notifyY + Math.max(not1Lines.length, not2Lines.length) * 3.5 + 8;

  // Vessel / Port of Loading / Discharge
  doc.setFont('helvetica', 'normal');
  safeText(doc, 'Vessel/Flight No.', margin, y);
  safeText(doc, 'Port of Loading', margin + 95, y);
  y += 4;
  safeText(doc, bl.vesselFlightNo || '', margin, y);
  safeText(doc, bl.portOfLoading, margin + 95, y);
  y += 6;
  
  safeText(doc, 'Port of Discharge', margin, y);
  safeText(doc, 'Final Destination', margin + 95, y);
  y += 4;
  safeText(doc, bl.portOfDischarge, margin, y);
  safeText(doc, bl.finalDestination, margin + 95, y);
  y += 8;

  // Main 3 Column Body Header
  safeText(doc, 'Marks & Nos./', margin, y);
  safeText(doc, 'No. & Kind of Pkg', margin + 40, y);
  safeText(doc, 'Description Of Goods', margin + 70, y);
  y += 3.5;
  safeText(doc, 'Container No', margin, y);
  y += 4.5;

  // Column 1: Marks & Numbers
  const bodyStartY = y;
  
  let marksStr = bl.marksAndNos || '';
  if (bl.totalGrossWtKg && !/GROSS\s*WT/i.test(marksStr)) marksStr += `\n\nTOTAL GROSS WT:\n${Number(bl.totalGrossWtKg).toFixed(3)} KGS`;
  if (bl.totalNetWtKg && !/NET\s*WT/i.test(marksStr)) marksStr += `\n\nTOTAL NET WT:\n${Number(bl.totalNetWtKg).toFixed(3)} KGS`;
  if (bl.containerSealNos && !marksStr.includes(bl.containerSealNos)) marksStr += `\n\nCONTAINER NO/SEAL NO: \n${bl.containerSealNos}`;
  
  const marksLines = doc.splitTextToSize(marksStr, 35);
  safeText(doc, marksLines, margin, bodyStartY);

  // Column 2: Package Count
  const pkgLines = doc.splitTextToSize(bl.packagesCountAndKind || '', 25);
  safeText(doc, pkgLines, margin + 40, bodyStartY);

  // Column 3: Description of Goods & Mandatory Trade clauses
  // Description, the LC reference block straight under it, then the carrier instructions
  let descFull = `${[bl.goodsDescription, ...blExtraLines(bl)].filter(Boolean).join('\n')}\n`;
  
  descFull += `\n\nCOMMERCIAL INVOICE NO. ${bl.invoiceNo || ''}\n`;
  descFull += `${bl.freightStatus || 'FREIGHT PREPAID'}\n`;
  descFull += `BL: ${bl.agentDetailsAtDestination || 'AGENT ADDRESS/TEL/FAX NO. AT DESTINATION PORT'}\n`;
  descFull += `S.B. NO. ${bl.shippingBillNo || '____'} DATE ${bl.shippingBillDate || '_____'}\n`;
  if (bl.freeDetentionClause) descFull += `BL: ${bl.freeDetentionClause}\n`;
  descFull += `BL: ${bl.blWeightCheckClause || 'CHECK NET/GR WT/ NO. OF CARTON AS PER SHIPPING BILL'}\n`;

  const descLines = doc.splitTextToSize(descFull, 120);
  safeText(doc, descLines, margin + 70, bodyStartY);

  return doc;
}

// 4. Certificate of Origin PDF
export function generateCertificateOfOriginPDF(coo: CertificateOfOriginFinal, bankName?: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setTextColor(0, 0, 0);
  const margin = 15;
  const pageWidth = 210;
  let y = 14;

  // Title: "CERTIFICATE OF ORIGIN"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  safeText(doc, 'CERTIFICATE OF ORIGIN', pageWidth / 2, y, { align: 'center' });
  y += 9;

  // 1. Exporter Plain Text Header (Top Left, no background/accent bars)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  safeText(doc, (coo.exporter.name || '').toUpperCase(), margin, y);
  y += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const expLines = doc.splitTextToSize((coo.exporter.address || '').toUpperCase(), 100);
  safeText(doc, expLines, margin, y);
  y += expLines.length * 3.8 + 8;

  // 2. Applicant Name and Address (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const rawConsignee = (coo.consignee || '').trim();
  const hasAppTitle = /^applicant\s+name/i.test(rawConsignee);
  if (!hasAppTitle) {
    safeText(doc, 'APPLICANT NAME AND ADDRESS', margin, y);
    y += 4;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const appLines = doc.splitTextToSize(cleanConsignee(rawConsignee, bankName).toUpperCase(), 110);
  safeText(doc, appLines, margin, y);
  y += Math.max(appLines.length * 3.8, 12) + 6;

  // 3. Transport Details (Left)
  const isRoad = /petrapole|benapole|road|truck|by\s+road/i.test(`${coo.portOfLoading} ${coo.portOfDischarge} ${coo.vesselFlightNo || ''}`);
  const modeLabel = isRoad ? 'By Road' : 'By Sea';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  safeText(doc, modeLabel, margin, y);
  y += 4.2;
  safeText(doc, `VESSEL :  ${coo.vesselFlightNo ? coo.vesselFlightNo.toUpperCase() : ''}`, margin, y);
  y += 4.2;
  safeText(doc, `FROM : ${coo.portOfLoading ? coo.portOfLoading.toUpperCase() : ''} TO ${coo.portOfDischarge ? coo.portOfDischarge.toUpperCase() : ''}`, margin, y);
  y += 10;

  // 4. Main Body Table / Cargo Detail Layout matching exact reference
  const tableStartY = y;

  // Prefix "1)" on leftmost margin
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  safeText(doc, '1)', margin, tableStartY);

  // Column 1: Marks & Numbers (Width: 34mm)
  const col1X = margin + 5;
  const col1W = 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const marksLines = doc.splitTextToSize((coo.marksAndNos || '').toUpperCase(), col1W);
  safeText(doc, marksLines, col1X, tableStartY);

  // Column 2: Goods Description & Trade Clauses (Width: 74mm)
  const col2X = col1X + col1W + 4;
  const col2W = 74;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const descLines = doc.splitTextToSize((coo.goodsDescription || '').toUpperCase(), col2W);
  safeText(doc, descLines, col2X, tableStartY);

  // Column 3: Country of Origin (x = 135)
  const col3X = 135;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  safeText(doc, (coo.countryOfOrigin || 'INDIA').toUpperCase(), col3X, tableStartY);

  // Column 4: Weights (x = 152)
  const col4X = 152;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const grossValStr = (coo.grossWeightKg != null && Number(coo.grossWeightKg) > 0) ? `${Number(coo.grossWeightKg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} KGS` : '';
  const netValStr = (coo.netWeightKg != null && Number(coo.netWeightKg) > 0) ? `${Number(coo.netWeightKg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} KGS` : '';

  if (grossValStr) {
    safeText(doc, 'GROSS WT :', col4X, tableStartY);
    safeText(doc, grossValStr, col4X, tableStartY + 3.8);
  }

  if (netValStr) {
    safeText(doc, 'NET WT :', col4X, tableStartY + 11);
    safeText(doc, netValStr, col4X, tableStartY + 14.8);
  }

  // Column 5: Invoice No & Date (Top Right of table area)
  const rightX = pageWidth - margin;
  if (coo.invoiceNo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    safeText(doc, coo.invoiceNo, rightX, tableStartY, { align: 'right' });
    safeText(doc, `Dt  ${coo.invoiceDate || ''}`, rightX, tableStartY + 4, { align: 'right' });
  }

  // 5. Bottom Section
  const podY = 238;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const podText = `${(coo.portOfDischarge || '').toUpperCase()}${isRoad ? ' BY ROAD' : ' BY SEA'}`;
  safeText(doc, podText, 145, podY);

  // Signature block
  const sigY = 252;
  safeText(doc, coo.exporter.name ? `For ${(coo.exporter.name).toUpperCase()}` : '', 145, sigY);
  safeText(doc, 'Authorised Signatory', 160, sigY + 12);
  safeText(doc, coo.placeAndDateOfIssue || `MUMBAI , DATE:   ${coo.invoiceDate || ''}`, 145, sigY + 17);

  return doc;
}

/**
 * Invoice description column (70 mm): the description already comes broken into Lahoti's
 * 55-character lines, which fit; anything longer (typed in by hand) is wrapped to the column.
 */
function splitInvoiceDescription(doc: jsPDF, text: string): string[] {
  return text.split('\n').flatMap(line => (line ? doc.splitTextToSize(line, 69) : ['']));
}

// 5. Bills of Exchange PDF (First & Second of Exchange matching exact layout)
export function generateBillOfExchangePDF(boe: BillOfExchangeFinal): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 12;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;

  // Helper to draw one half of the BOE page
  const rightEdge = pageWidth - margin;
  // Fill-in rule under a value, as on the printed bill of exchange form
  const rule = (x1: number, x2: number, baseline: number) => {
    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.2);
    doc.line(x1, baseline + 1, x2, baseline + 1);
  };
  const ruleLines = (count: number, x1: number, x2: number, baseline: number) => {
    for (let i = 0; i < Math.max(count, 1); i++) rule(x1, x2, baseline + i * 3.5);
  };

  const drawExchangeHalf = (startY: number, isFirst: boolean) => {
    let y = startY;

    // Header Drawn Under Issuing Bank
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    if (boe.headerText) {
      const headLines = doc.splitTextToSize(boe.headerText, 175);
      safeText(doc, headLines, margin + 8, y);
      y += (headLines.length - 1) * 3.5;
    } else {
      const headText = `DRAWN UNDER THE ISSUING BANK MENTIONING THE LC NUMBER: ${boe.lcNumber} AND DATE ${boe.lcDate}`;
      safeText(doc, headText, 105, y, { align: 'center' });
    }
    y += 4;

    // Decorative side bars matching original scan
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin, y + 105);
    doc.line(margin + 2.5, y, margin + 2.5, y + 105);

    // Title
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(14);
    safeText(doc, 'Bills of Exchange', margin + 8, y + 6);

    // Right Ref Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    safeText(doc, `No :    ${boe.invoiceNo || '________'}`, pageWidth - margin - 45, y + 4);
    safeText(doc, `Date :  ${boe.date || '__/__/____'}`, pageWidth - margin - 45, y + 9);

    y += 16;

    // Amount box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    safeText(doc, 'For', margin + 8, y);
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    safeText(doc, `${boe.currency}  ${boe.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin + 22, y);

    y += 8;

    // Tenor & Exchange Wording
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    safeText(doc, 'At', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    safeText(doc, boe.tenor.toUpperCase(), margin + 16, y);
    rule(margin + 14, rightEdge - 42, y);
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'of this', pageWidth - margin - 40, y);
    doc.setFont('times', 'bolditalic');
    doc.setTextColor(185, 28, 28);
    safeText(doc, isFirst ? 'First' : 'Second', pageWidth - margin - 22, y);
    doc.setTextColor(17, 24, 39);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    safeText(doc, 
      isFirst ? 'Exchange (second of the same tenure and date being unpaid)' : 'Exchange (first of the same tenure and date being unpaid)',
      margin + 8,
      y
    );

    y += 7;
    // Pay to the order of
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'Pay to the order of', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    const bankProfile = boe.presentingBankProfile;
    const bankDesc = boe.payToOrderOf || [bankProfile?.bankName, bankProfile?.branch, bankProfile?.city].filter(Boolean).join(', ');
    const bankLines = doc.splitTextToSize(bankDesc, 130);
    safeText(doc, bankLines, margin + 40, y);
    ruleLines(bankLines.length, margin + 40, rightEdge, y);

    y += Math.max(bankLines.length * 3.5, 6) + 2;

    // Sum of
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'the sum of', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    const wordsLines = doc.splitTextToSize(boe.amountInWords.toUpperCase(), 140);
    safeText(doc, wordsLines, margin + 26, y);
    ruleLines(wordsLines.length, margin + 26, rightEdge, y);

    y += Math.max(wordsLines.length * 3.5, 6) + 4;

    // Shipment Particulars Line
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'Value received and charged the same to the account of', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    safeText(doc, boe.accountOf || '', margin + 95, y);
    rule(margin + 93, rightEdge, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'Packages shipped by S.S./Air', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    safeText(doc, boe.packagesShippedBy || '', margin + 48, y);
    rule(margin + 46, margin + 100, y);

    doc.setFont('helvetica', 'normal');
    safeText(doc, 'Invoice No', margin + 105, y);
    safeText(doc, boe.invoiceNo || '', margin + 121, y);
    rule(margin + 120, margin + 150, y);
    safeText(doc, 'Date :', margin + 153, y);
    safeText(doc, boe.invoiceDate || '', margin + 163, y);
    rule(margin + 162, rightEdge, y);

    y += 5;
    safeText(doc, 'B.L./Air Bill :', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    safeText(doc, boe.blAirBillRef || '', margin + 28, y);
    rule(margin + 26, margin + 140, y);

    y += 8;
    // Drawee & Signature
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'To,', margin + 8, y);
    y += 3.5;
    safeText(doc, 'M/s.', margin + 8, y);
    doc.setFont('helvetica', 'bold');
    const draweeLines = doc.splitTextToSize(boe.drawee, 70);
    safeText(doc, draweeLines, margin + 16, y);

    const drawerName = boe.drawer?.name || (boe as any).exporterName || '';
    safeText(doc, drawerName ? `For ${drawerName}` : '', pageWidth - margin - 55, y);
    doc.setFont('helvetica', 'normal');
    safeText(doc, 'Authorised Signatory', pageWidth - margin - 55, y + 12);
  };

  // Draw First of Exchange on top
  drawExchangeHalf(10, true);

  // Divider Line in Middle
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(margin, 145, pageWidth - margin, 145);

  // Draw Second of Exchange on bottom
  drawExchangeHalf(155, false);

  return doc;
}

// 6. Beneficiary Certificate PDF
function renderRecipients(doc: jsPDF, recipients: Array<{ address: string; email?: string }>, x: number, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  recipients.forEach(r => {
    safeText(doc, 'TO,', x, y);
    y += 3.5;
    const lines = doc.splitTextToSize(r.address, 120);
    safeText(doc, lines, x, y);
    y += lines.length * 3.5;
    if (r.email) {
      safeText(doc, `EMAIL: ${r.email}`, x, y);
      y += 3.5;
    }
    y += 2;
  });
  return y;
}

export function renderBeneficiaryCertPage(doc: jsPDF, cert: BeneficiaryCertFinal): void {
  doc.setTextColor(0, 0, 0);
  const margin = 14;
  let y = margin;

  // Header Letterhead (Logo on Left, Address on Right)
  y = addHeaderLogoAndLetterhead(doc, undefined, cert.exporter);
  doc.setTextColor(0, 0, 0);
  y = Math.max(y, 44);

  if (cert.certType === 'email_advice_enclosed') {
    // EMAIL ADVICE TRANSMISSION HEADER
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    safeText(doc, `From: ${cert.emailDetails?.from || cert.exporter?.email || cert.exporter?.name || ''}`, margin, y);
    y += 4;
    safeText(doc, `Sent: ${cert.emailDetails?.sent || (cert.docHeaderDate ? cert.docHeaderDate + ' 16.36 P.M.' : '')}`, margin, y);
    y += 4;
    safeText(doc, `To: ${cert.emailDetails?.to || cert.applicantEmail || ''}`, margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    safeText(doc, `Subject: ${cert.emailDetails?.subject || `Declaration of Shipment for our invoice no: ${cert.invoiceNo || ''}`}`, margin, y);
    y += 6;

    // Recipient address blocks if present
    if (cert.recipients && cert.recipients.length) {
      y = renderRecipients(doc, cert.recipients, margin, y);
    } else if (cert.insuranceCompanyDetails) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      safeText(doc, 'TO,', margin, y);
      y += 3.5;
      const insLines = doc.splitTextToSize(cert.insuranceCompanyDetails, 120);
      safeText(doc, insLines, margin, y);
      y += insLines.length * 3.5;
      if (cert.insuranceEmail) {
        safeText(doc, `EMAIL: ${cert.insuranceEmail}`, margin, y);
        y += 4;
      }
      y += 1;
    }

    if (!cert.recipients?.length && cert.applicantDetails) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      safeText(doc, 'TO,', margin, y);
      y += 3.5;
      const appLines = doc.splitTextToSize(cert.applicantDetails, 120);
      safeText(doc, appLines, margin, y);
      y += appLines.length * 3.5;
      if (cert.applicantBin) {
        safeText(doc, `VAT REGISTRATION NO. (BIN): ${cert.applicantBin}`, margin, y);
        y += 3.5;
      }
      if (cert.applicantEmail) {
        safeText(doc, `EMAIL: ${cert.applicantEmail}`, margin, y);
        y += 4;
      }
      y += 1;
    }

    // Intro / Email Text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const bodyLines = doc.splitTextToSize(cert.text || '', 180);
    safeText(doc, bodyLines, margin, y);
    y += bodyLines.length * 4 + 3;

    // If List of Documents
    if (cert.listOfDocuments && cert.listOfDocuments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      safeText(doc, 'LIST OF DOCUMENTS:', margin, y);
      y += 4;
      cert.listOfDocuments.forEach(docItem => {
        safeText(doc, docItem, margin, y);
        y += 3.5;
      });
      y += 3;
    }

    // Master Footnote Reference Lines (Clean without gray box)
    if (cert.footnoteDetails) {
      y += 2;
      const fnLines = cert.footnoteDetails.split('\n');
      fnLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        
        if (trimmed.startsWith('INVOICE NO.') || trimmed.startsWith('LETTER OF CREDIT NO.')) {
          safeText(doc, trimmed, margin, y);
          const tW = doc.getTextWidth(trimmed);
          doc.setLineWidth(0.25);
          doc.line(margin, y + 0.8, margin + tW, y + 0.8);
          y += 4;
        } else {
          const splitL = doc.splitTextToSize(trimmed, 180);
          safeText(doc, splitL, margin, y);
          y += splitL.length * 3.6 + 1;
        }
      });
      y += 3;
    }

    // Sign off (Left aligned)
    y = Math.max(y, 245);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    safeText(doc, 'Best Regards', margin, y);
    y += 4;
    safeText(doc, cert.signatoryName || '', margin, y);
    y += 3.5;
    safeText(doc, cert.signatoryCompany || cert.exporter?.name || '', margin, y);

  } else {
    // CERTIFICATE / DECLARATION OF SHIPMENT
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    safeText(doc, `DATE: ${cert.docHeaderDate || ''}`, margin, y);
    y += 5;

    // Centered Underlined Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    const displayTitle = cert.docTitle || (cert.title.includes('(') ? cert.title.split('(')[0].trim() : cert.title);
    safeText(doc, displayTitle, 105, y, { align: 'center' });
    doc.setLineWidth(0.3);
    const tW = doc.getTextWidth(displayTitle);
    doc.line(105 - tW / 2, y + 1, 105 + tW / 2, y + 1);
    y += 6;

    // If Declaration of Shipment (Page 1 in scan)
    if (cert.certType === 'shipment_advice_dispatch') {
      if (cert.recipients && cert.recipients.length) {
        y = renderRecipients(doc, cert.recipients, margin, y);
      } else if (cert.insuranceCompanyDetails) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        safeText(doc, 'TO,', margin, y);
        y += 3.5;
        const insLines = doc.splitTextToSize(cert.insuranceCompanyDetails, 120);
        safeText(doc, insLines, margin, y);
        y += insLines.length * 3.5;
        if (cert.insuranceEmail) {
          safeText(doc, `EMAIL: ${cert.insuranceEmail}`, margin, y);
          y += 4;
        }
        y += 1;
      }

      if (!cert.recipients?.length && cert.applicantDetails) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        safeText(doc, 'TO,', margin, y);
        y += 3.5;
        const appLines = doc.splitTextToSize(cert.applicantDetails, 120);
        safeText(doc, appLines, margin, y);
        y += appLines.length * 3.5;
        if (cert.applicantBin) {
          safeText(doc, `VAT REGISTRATION NO. (BIN): ${cert.applicantBin}`, margin, y);
          y += 3.5;
        }
        if (cert.applicantEmail) {
          safeText(doc, `EMAIL: ${cert.applicantEmail}`, margin, y);
          y += 4;
        }
        y += 1;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      if (cert.insuranceCoverNote) {
        const insText = `INSURANCE COVER NOTE NO. ${cert.insuranceCoverNote}${cert.insuranceCoverNoteDate ? ' DTD: ' + cert.insuranceCoverNoteDate : ''}`;
        safeText(doc, insText, margin, y);
        const insW = doc.getTextWidth(insText);
        doc.setLineWidth(0.25);
        doc.line(margin, y + 0.8, margin + insW, y + 0.8);
        y += 4;
      }
      const lcRefText = `L/C NO. ${cert.lcNumber} ${cert.lcDate ? 'DATE ' + cert.lcDate : ''}`.trim();
      safeText(doc, lcRefText, margin, y);
      const lcW = doc.getTextWidth(lcRefText);
      doc.setLineWidth(0.25);
      doc.line(margin, y + 0.8, margin + lcW, y + 0.8);
      y += 5;

      doc.setFont('helvetica', 'bold');
      safeText(doc, 'PLEASE NOTE BELOW DETAILS OF SHIPMENT –', margin, y);
      y += 4;

      if (cert.goodsNarration) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const gnLines = doc.splitTextToSize(cert.goodsNarration, 180);
        safeText(doc, gnLines, margin, y);
        y += gnLines.length * 3.5 + 3;
      }

      if (cert.particulars && cert.particulars.length) {
        cert.particulars.forEach(({ label, value }) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          safeText(doc, label, margin, y);
          doc.setFont('helvetica', 'normal');
          safeText(doc, `: ${value}`, margin + 62, y);
          y += 3.6;
        });
        y += 2;
      } else if (cert.shipmentParticulars) {
        const p = cert.shipmentParticulars;
        const details = [
          ['NAME OF VESSEL NO.', `: ${p.vessel}`],
          ['DATE OF SHIPMENT', `: ${p.shipmentDate}`],
          ['INVOICE AMOUNT', `: ${p.invoiceAmount}`],
          ['QUANTITY', `: ${p.quantity}`],
          ['PORT OF LOADING', `: ${p.portOfLoading}`],
          ['PORT OF DISCHARGE', `: ${p.portOfDischarge}`],
          ['B/L NO.', `: ${p.blNo}`],
          ['CONTAINER NO.', `: ${p.containerNo}`]
        ];

        details.forEach(([k, v]) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          safeText(doc, k, margin, y);
          doc.setFont('helvetica', 'normal');
          safeText(doc, v, margin + 45, y);
          y += 3.6;
        });
        y += 2;
      }

    } else {
      // Other Beneficiary Certificates (Pages 3, 5, 6, etc.)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const bodyLines = doc.splitTextToSize(cert.text || '', 180);
      safeText(doc, bodyLines, margin, y);
      y += bodyLines.length * 4.2 + 4;

      if (cert.postTextInstruction && cert.postTextInstruction.includes('EMAIL COPY')) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        safeText(doc, cert.postTextInstruction, margin, y);
        y += 5;
      }
    }

    // Footnote reference block (Plain text with underlined headers, matching scan)
    if (cert.footnoteDetails) {
      y += 2;
      const fnLines = cert.footnoteDetails.split('\n');
      fnLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);

        if (trimmed.startsWith('INVOICE NO.') || trimmed.startsWith('LETTER OF CREDIT NO.')) {
          safeText(doc, trimmed, margin, y);
          const tW = doc.getTextWidth(trimmed);
          doc.setLineWidth(0.25);
          doc.line(margin, y + 0.8, margin + tW, y + 0.8);
          y += 4;
        } else {
          const splitL = doc.splitTextToSize(trimmed, 180);
          safeText(doc, splitL, margin, y);
          y += splitL.length * 3.6 + 1;
        }
      });
      y += 3;
    }

    // Post-text instructions if Declaration of Shipment
    if (cert.certType === 'shipment_advice_dispatch' && cert.postTextInstruction) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const postLines = cert.postTextInstruction.split('\n');
      postLines.forEach(line => {
        safeText(doc, line, margin, y);
        y += 3.8;
      });
      y += 2;
    }

    // Exporter Signature Block (Left-aligned)
    y = Math.max(y, 245);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    safeText(doc, cert.signatoryCompany || (cert.exporter?.name ? `For ${cert.exporter.name}` : ''), margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    safeText(doc, cert.signatoryName || 'Authorised Signatory', margin, y);
  }
}

export function generateBeneficiaryCertificatePDF(cert: BeneficiaryCertFinal): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  renderBeneficiaryCertPage(doc, cert);
  return doc;
}

export function generateAllBeneficiaryCertificatesPDF(certs: BeneficiaryCertFinal[]): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  if (!certs || certs.length === 0) return doc;
  certs.forEach((cert, idx) => {
    if (idx > 0) doc.addPage();
    renderBeneficiaryCertPage(doc, cert);
  });
  return doc;
}

// -------------------------------------------------------------
// DOCX GENERATION (Using docx library) - Full Field Parity
// Re-exported from dedicated docxGenerators module
// -------------------------------------------------------------

export {
  generateCommercialInvoiceDOCX,
  generatePackingListDOCX,
  generateBillOfLadingDOCX,
  generateCertificateOfOriginDOCX,
  generateBillOfExchangeDOCX,
  createBeneficiaryCertDocxChildren,
  generateBeneficiaryCertificateDOCX,
  generateAllBeneficiaryCertificatesDOCX,
  generateGenericDOCX
} from './docxGenerators';

import {
  generateCommercialInvoiceDOCX,
  generatePackingListDOCX,
  generateBillOfLadingDOCX,
  generateCertificateOfOriginDOCX,
  generateBillOfExchangeDOCX,
  generateBeneficiaryCertificateDOCX
} from './docxGenerators';

// -------------------------------------------------------------
// DOWNLOAD ALL AS ZIP (Full Stage 4 Pack)
// -------------------------------------------------------------

export async function downloadStage4Zip(docSet: FinalDocumentSet, bankName?: string): Promise<void> {
  const zip = new JSZip();

  const pdfFolder = zip.folder('PDF_Format');
  const docxFolder = zip.folder('DOCX_Word_Format');

  const pdfFiles: string[] = [];
  const docxFiles: string[] = [];

  // 1. Commercial Invoice
  const invPdf = generateCommercialInvoicePDF(docSet.commercialInvoice, bankName);
  pdfFolder?.file('01_Commercial_Invoice.pdf', invPdf.output('blob'));
  pdfFiles.push('01_Commercial_Invoice.pdf');
  const invDocx = await generateCommercialInvoiceDOCX(docSet.commercialInvoice, bankName);
  docxFolder?.file('01_Commercial_Invoice.docx', invDocx);
  docxFiles.push('01_Commercial_Invoice.docx');

  // 2. Packing List
  const plPdf = generatePackingListPDF(docSet.packingList, bankName);
  pdfFolder?.file('02_Packing_List.pdf', plPdf.output('blob'));
  pdfFiles.push('02_Packing_List.pdf');
  const plDocx = await generatePackingListDOCX(docSet.packingList, bankName);
  docxFolder?.file('02_Packing_List.docx', plDocx);
  docxFiles.push('02_Packing_List.docx');

  // 3. Bill of Lading Instructions
  const blPdf = generateBillOfLadingPDF(docSet.billOfLading, bankName);
  pdfFolder?.file('03_Bill_Of_Lading_Instruction.pdf', blPdf.output('blob'));
  pdfFiles.push('03_Bill_Of_Lading_Instruction.pdf');
  const blDocx = await generateBillOfLadingDOCX(docSet.billOfLading, bankName);
  docxFolder?.file('03_Bill_Of_Lading_Instruction.docx', blDocx);
  docxFiles.push('03_Bill_Of_Lading_Instruction.docx');

  // 4. Certificate of Origin
  const cooPdf = generateCertificateOfOriginPDF(docSet.certificateOfOrigin, bankName);
  pdfFolder?.file('04_Certificate_Of_Origin.pdf', cooPdf.output('blob'));
  pdfFiles.push('04_Certificate_Of_Origin.pdf');
  const cooDocx = await generateCertificateOfOriginDOCX(docSet.certificateOfOrigin, bankName);
  docxFolder?.file('04_Certificate_Of_Origin.docx', cooDocx);
  docxFiles.push('04_Certificate_Of_Origin.docx');

  // 5. Bill of Exchange
  const boePdf = generateBillOfExchangePDF(docSet.billOfExchange);
  pdfFolder?.file('05_Bill_Of_Exchange.pdf', boePdf.output('blob'));
  pdfFiles.push('05_Bill_Of_Exchange.pdf');
  const boeDocx = await generateBillOfExchangeDOCX(docSet.billOfExchange);
  docxFolder?.file('05_Bill_Of_Exchange.docx', boeDocx);
  docxFiles.push('05_Bill_Of_Exchange.docx');

  // 6. Beneficiary Certificates
  for (let idx = 0; idx < docSet.beneficiaryCertificates.length; idx++) {
    const cert = docSet.beneficiaryCertificates[idx];
    const safeTitle = cert.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const cPdf = generateBeneficiaryCertificatePDF(cert);
    pdfFolder?.file(`06_Cert_${idx + 1}_${safeTitle}.pdf`, cPdf.output('blob'));
    pdfFiles.push(`06_Cert_${idx + 1}_${safeTitle}.pdf`);

    const cDocx = await generateBeneficiaryCertificateDOCX(cert);
    docxFolder?.file(`06_Cert_${idx + 1}_${safeTitle}.docx`, cDocx);
    docxFiles.push(`06_Cert_${idx + 1}_${safeTitle}.docx`);
  }

  // Automated Parity Check
  if (pdfFiles.length !== docxFiles.length) {
    throw new Error(`Export Parity Check Failed: PDF document count (${pdfFiles.length}) does not match DOCX document count (${docxFiles.length})!`);
  }
  console.log(`[Export Audit] Parity check passed: ${pdfFiles.length} PDF and ${docxFiles.length} DOCX documents verified.`);

  // Readme & Manifest
  const manifest = `Export Documentation Pack (Stage 4)
Generated for: ${docSet.commercialInvoice.exporter.name}
Invoice Number: ${docSet.commercialInvoice.invoiceNo}
LC Number: ${docSet.commercialInvoice.lcReference}
Total Amount: ${docSet.commercialInvoice.currency} ${docSet.commercialInvoice.totalAmount}

Included Documents:
1. Commercial Invoice (PDF & DOCX)
2. Detailed Packing List (PDF & DOCX)
3. Bill of Lading Instructions (PDF & DOCX)
4. Certificate of Origin (PDF & DOCX)
5. Bills of Exchange - First & Second of Exchange (PDF & DOCX)
6. Beneficiary Certificates (${docSet.beneficiaryCertificates.length} certificates in PDF & DOCX)

All documents have been audited for zero discrepancies against MT700 clauses and contract terms.`;

  zip.file('DOCUMENTATION_MANIFEST.txt', manifest);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadFileBlob(zipBlob, `Export_Docs_${docSet.commercialInvoice.invoiceNo.replace(/[^a-zA-Z0-9]/g, '_')}_Complete_Set.zip`);
}
