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
  TableLayoutType,
  HeadingLevel,
  ImageRun
} from 'docx';
import { lahotiOverseasLogoPngBase64 } from '../image/logo';
import {
  CommercialInvoiceFinal,
  PackingListFinal,
  BillOfLadingFinal,
  CertificateOfOriginFinal,
  BillOfExchangeFinal,
  BeneficiaryCertFinal
} from '../types';
import { blExtraLines } from './documentGenerators';

// Styling borders
const stdBorder = { style: BorderStyle.SINGLE, size: 4, color: '334155' };
const cellBorders = {
  top: stdBorder,
  bottom: stdBorder,
  left: stdBorder,
  right: stdBorder
};
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };
const cleanCellBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder
};
const cellMargins = { top: 70, bottom: 70, left: 90, right: 90 };

function cleanConsignee(consignee: string, fallbackBank?: string): string {
  let cleaned = consignee || '';
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

// -------------------------------------------------------------
// 1. COMMERCIAL INVOICE DOCX
// -------------------------------------------------------------
export async function generateCommercialInvoiceDOCX(invoice: CommercialInvoiceFinal, bankName?: string): Promise<Blob> {
  const isRoad = /petrapole|benapole|road|truck|by\s+road/i.test(
    `${invoice.portOfLoading} ${invoice.portOfDischarge} ${invoice.vesselFlightNo || ''}`
  );
  const inrRate = invoice.exchangeRate || 86.85;

  const totalNet = invoice.lineItems.reduce((s, it) => s + (it.quantity || 0), 0) || invoice.totalQuantity || 0;
  const totalGross = Math.round(totalNet * 1.05 * 100) / 100;
  const cartonsEst = Math.round(totalNet / 50) || 426;

  const addressLines = (invoice.exporter?.address || '307, ARUN CHAMBERS, TARDEO ROAD,\nMUMBAI - 400 034 INDIA')
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(Boolean);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 540, bottom: 540, left: 540, right: 540 }
          }
        },
        children: [
          // Header titles matching exact sample
          new Paragraph({
            children: [
              new TextRun({ text: invoice.isPreShipment ? 'INVOICE' : 'COMMERCIAL INVOICE', bold: true, size: 26 })
            ],
            alignment: AlignmentType.CENTER
          }),
          ...(invoice.isPreShipment ? [
            new Paragraph({
              children: [
                new TextRun({ text: 'SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.', bold: true, size: 16 })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `IRN NO.  ${invoice.irnno ? invoice.irnno.trim() : ''}`, bold: true, size: 15, color: '334155' })
              ],
              alignment: AlignmentType.LEFT
            })
          ] : []),
          new Paragraph({ text: '' }),

          // Header Grid Table (4 columns grid: 25% each)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Row 1: Exporter (left, spans 3 rows) | Invoice No. & Date (right)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    rowSpan: 3,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Exporter', size: 14, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.exporter?.name || '', bold: true, size: 17 })] }),
                      ...addressLines.map(line => new Paragraph({ children: [new TextRun({ text: line, size: 15 })] }))
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Invoice No. & Date', size: 14, color: '64748B' })] }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: invoice.invoiceNo || '', bold: true, size: 16 }),
                          new TextRun({ text: '   ' }),
                          new TextRun({ text: invoice.invoiceDate || '', bold: true, size: 15 })
                        ]
                      })
                    ]
                  })
                ]
              }),

              // Row 2: Buyer's Order No. & Date (on Right side of Exporter)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Buyer's Order No. & Date", size: 14, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: [invoice.buyersOrderNo, invoice.buyersOrderDate].filter(Boolean).join('  ') || '', bold: true, size: 15 })] })
                    ]
                  })
                ]
              }),

              // Row 3: Other Reference (on Right side of Exporter)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Other Reference', size: 14, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.otherReference && invoice.otherReference.trim() !== '' ? invoice.otherReference : 'N/A', bold: true, size: 15 })] })
                    ]
                  })
                ]
              }),

              // Row 4: Consignee | Buyer (if other than consignee)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Consignee', size: 14, color: '64748B' })] }),
                      ...(invoice.consignee || 'TO ORDER').split(/[\n\r]+/).map(l =>
                        new Paragraph({ children: [new TextRun({ text: l.trim(), bold: true, size: 15 })] })
                      )
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Buyer (if other than consignee)', size: 14, color: '64748B' })] }),
                      ...(invoice.buyerIfOtherThanConsignee || invoice.consignee || '').split(/[\n\r]+/).map(l =>
                        new Paragraph({ children: [new TextRun({ text: l.trim(), bold: true, size: 15 })] })
                      )
                    ]
                  })
                ]
              }),

              // Row 3: Pre-Carriage by | Place of Receipt | Origin | Final Destination
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Pre-Carriage by', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.preCarriageBy || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Place of Receipt by Pre-carrier', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.placeOfReceipt || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Country of Origin of Goods', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.countryOfOrigin || 'INDIAN ORIGIN', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Country of Final Destination', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.countryOfFinalDestination || '', bold: true, size: 14 })] })
                    ]
                  })
                ]
              }),

              // Row 4: Vessel / Flight | Port of Loading | Terms of Delivery and Payment
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Vessel/Flight No.', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.vesselFlightNo || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Port of Loading', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.portOfLoading, bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    rowSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Terms of Delivery and Payment', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.termsOfDelivery || '', bold: true, size: 14 })] }),
                      ...(invoice.lcReference ? [
                        new Paragraph({ children: [new TextRun({ text: `LC NO. ${invoice.lcReference} DT. ${invoice.lcDateReference || ''}`, bold: true, size: 14 })] })
                      ] : []),
                      ...(invoice.paymentTenorLine ? [
                        new Paragraph({ children: [new TextRun({ text: invoice.paymentTenorLine, bold: true, size: 14 })] })
                      ] : (invoice.tenor ? [
                        new Paragraph({ children: [new TextRun({ text: invoice.tenor.toUpperCase(), bold: true, size: 14 })] })
                      ] : []))
                    ]
                  })
                ]
              }),

              // Row 5: Port of Discharge | Final Destination
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Port of Discharge', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.portOfDischarge, bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Final Destination', size: 13, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.finalDestination, bold: true, size: 14 })] })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '' }),

          // Line Items Table (6 columns: 20%, 12%, 42%, 10%, 8%, 8%)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Marks & Nos./', bold: true, size: 13 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Container No', bold: true, size: 13 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: 'No. & Kind of Pkg', bold: true, size: 13 })] })]
                  }),
                  new TableCell({
                    width: { size: 42, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Description Of Goods', bold: true, size: 13 })] })]
                  }),
                  new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Quantity', bold: true, size: 13 })], alignment: AlignmentType.RIGHT }),
                      new Paragraph({ children: [new TextRun({ text: invoice.lineItems[0]?.uom || '', bold: true, size: 11, color: '64748B' })], alignment: AlignmentType.RIGHT })
                    ]
                  }),
                  new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Rate', bold: true, size: 13 })], alignment: AlignmentType.RIGHT }),
                      new Paragraph({ children: [new TextRun({ text: invoice.currency || 'USD', bold: true, size: 11, color: '64748B' })], alignment: AlignmentType.RIGHT })
                    ]
                  }),
                  new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Amount', bold: true, size: 13 })], alignment: AlignmentType.RIGHT }),
                      new Paragraph({ children: [new TextRun({ text: invoice.currency || 'USD', bold: true, size: 11, color: '64748B' })], alignment: AlignmentType.RIGHT })
                    ]
                  })
                ]
              }),

              ...invoice.lineItems.map(
                (item) => {
                  const qtyVal = item.quantity != null ? Number(item.quantity) : 0;
                  const rateVal = item.rate != null ? Number(item.rate) : 0;
                  const amountVal = item.amount != null ? Number(item.amount) : 0;
                  const marksLines = (item.marksAndNos || '').split('\n').filter(Boolean);
                  const pkgLines = (item.noAndKindOfPkg || '').split('\n').filter(Boolean);
                  const descLines = (item.description || '').split('\n').filter(Boolean);

                  return new TableRow({
                    children: [
                      // Marks & Nos./ Container No
                      new TableCell({
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: cellMargins,
                        children: marksLines.length > 0
                          ? marksLines.map(l => new Paragraph({ children: [new TextRun({ text: l, size: 12 })] }))
                          : [new Paragraph({ children: [new TextRun({ text: '', size: 12 })] })]
                      }),
                      // No. & Kind of Pkg
                      new TableCell({
                        width: { size: 12, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: cellMargins,
                        children: pkgLines.length > 0
                          ? pkgLines.map(l => new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 12 })] }))
                          : [new Paragraph({ children: [new TextRun({ text: '', size: 12 })] })]
                      }),
                      // Description Of Goods
                      new TableCell({
                        width: { size: 42, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: cellMargins,
                        children: descLines.length > 0
                          ? descLines.map(l => new Paragraph({ children: [new TextRun({ text: l, size: 12 })] }))
                          : [new Paragraph({ children: [new TextRun({ text: '', size: 12 })] })]
                      }),
                      // Quantity
                      new TableCell({
                        width: { size: 10, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: cellMargins,
                        children: [
                          new Paragraph({ children: [new TextRun({ text: qtyVal.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), bold: true, size: 12 })], alignment: AlignmentType.RIGHT }),
                          new Paragraph({ children: [new TextRun({ text: item.uom || '', size: 11, color: '64748B' })], alignment: AlignmentType.RIGHT })
                        ]
                      }),
                      // Rate
                      new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: cellMargins,
                        children: [
                          new Paragraph({ children: [new TextRun({ text: rateVal.toFixed(2), bold: true, size: 12 })], alignment: AlignmentType.RIGHT }),
                          new Paragraph({ children: [new TextRun({ text: `/ ${item.uom || ''}`, size: 11, color: '64748B' })], alignment: AlignmentType.RIGHT })
                        ]
                      }),
                      // Amount
                      new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        borders: cellBorders,
                        margins: cellMargins,
                        children: [
                          new Paragraph({ children: [new TextRun({ text: amountVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bold: true, size: 12 })], alignment: AlignmentType.RIGHT })
                        ]
                      })
                    ]
                  });
                }
              ),

              // Amount Chargeable in Words & Total Row
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 84, type: WidthType.PERCENTAGE },
                    columnSpan: 4,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Amount Chargeable (In Words)-:', size: 13, bold: true, color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.amountInWords || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Total', bold: true, size: 14 })], alignment: AlignmentType.CENTER })
                    ]
                  }),
                  new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: invoice.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bold: true, size: 14 })
                        ],
                        alignment: AlignmentType.RIGHT
                      })
                    ]
                  })
                ]
              }),

              // Statutory Details & INR Conversion Box (Only show exchange rate breakdown if specified in LC)
              new TableRow({
                children: invoice.showExchangeRate ? [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 3,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `CIN No. : ${invoice.exporter?.cin || 'L74999MH1995PLC087643'}`, size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: `GST No. : ${invoice.exporter?.taxId || '27AAACL2578H1ZE'}`, size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: `PAN No. : ${invoice.exporter?.pan || 'AAACL2578H'}`, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 3,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `EXCH. @ Rs. ${inrRate.toFixed(2)} USD =1`, size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: `VALUE INR : ${(invoice.totalAmount * inrRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, size: 14 })] }),
                      ...(invoice.freightAmount != null ? [
                        new Paragraph({ children: [new TextRun({ text: `FREIGHT ${invoice.freightAmount.toFixed(2)} (USD ) ${((invoice.freightAmount) * inrRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, size: 14 })] })
                      ] : []),
                      ...(invoice.fobValue != null ? [
                        new Paragraph({ children: [new TextRun({ text: `FOB VALUE INR : ${(invoice.fobValue * inrRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, size: 14 })] })
                      ] : [])
                    ]
                  })
                ] : [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    columnSpan: 6,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: `CIN No. : ${invoice.exporter?.cin || 'L74999MH1995PLC087643'}`, size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: `GST No. : ${invoice.exporter?.taxId || '27AAACL2578H1ZE'}`, size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: `PAN No. : ${invoice.exporter?.pan || 'AAACL2578H'}`, size: 14 })] })
                    ]
                  })
                ]
              }),

              // Declaration & Signature Row
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 3,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Declaration :', bold: true, size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'We declare that this invoice shows the actual price of the goods', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'described and that all particulars are true and correct', size: 14 })] }),
                      ...(invoice.additionalDeclarations || []).filter(decl => {
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
                      }).map(decl => 
                        new Paragraph({
                          children: [
                            new TextRun({ text: `[${decl.clauseRef}]: `, bold: true, size: 13 }),
                            new TextRun({ text: decl.verbatimText || decl.text, size: 13 })
                          ]
                        })
                      )
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 3,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Signature and Date', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: invoice.exporter?.name ? `For ${invoice.exporter.name}` : '', bold: true, size: 15 })], alignment: AlignmentType.RIGHT }),
                      new Paragraph({ text: '' }),
                      new Paragraph({ text: '' }),
                      new Paragraph({ children: [new TextRun({ text: 'Authorised Signatory', size: 14 })], alignment: AlignmentType.RIGHT })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 2. PACKING LIST DOCX
// -------------------------------------------------------------
export async function generatePackingListDOCX(packing: PackingListFinal, bankName?: string): Promise<Blob> {
  const isRoad = /petrapole|benapole|road|truck|by\s+road/i.test(
    `${packing.portOfLoading} ${packing.portOfDischarge} ${packing.vesselFlightNo || ''}`
  );

  const totalCartonsCount = packing.packingRows.reduce((sum, r) => {
    const num = parseInt(r.noOfUnits.replace(/\D/g, ''), 10) || 0;
    return sum + num;
  }, 0);

  const exporterName = packing.exporter?.name || '';
  const exporterAddress = packing.exporter?.address || '';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 540, bottom: 540, left: 540, right: 540 }
          }
        },
        children: [
          // Header: DETAILED PACKING LIST (Center) & COPY (Right)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    borders: cleanCellBorders,
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'DETAILED PACKING LIST', bold: true, size: 24 })],
                        alignment: AlignmentType.CENTER
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: cleanCellBorders,
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'COPY', bold: true, size: 20 })],
                        alignment: AlignmentType.RIGHT
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '' }),

          // Top Grid Part 1: Exporter & Invoice/Order details
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Row 1: Exporter (left, spans 3 rows) | Invoice No. & Date (right)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    rowSpan: 3,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Exporter', size: 15 })] }),
                      new Paragraph({ children: [new TextRun({ text: exporterName, bold: true, size: 16 })] }),
                      ...exporterAddress.split(/[\n\r]+/).map(l =>
                        new Paragraph({ children: [new TextRun({ text: l.trim(), size: 14 })] })
                      ),
                      ...(packing.exporter?.tel ? [new Paragraph({ children: [new TextRun({ text: `TEL: ${packing.exporter.tel}${packing.exporter?.email ? ' | EMAIL: ' + packing.exporter.email : ''}`, size: 14 })] })] : []),
                      ...(packing.exporter?.cin || packing.exporter?.rexNo ? [new Paragraph({ children: [new TextRun({ text: `CIN: ${packing.exporter?.cin || ''}${packing.exporter?.rexNo ? ' | REX NO: ' + packing.exporter.rexNo : ''}`, size: 14 })] })] : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Invoice No. & Date', size: 15 })] }),
                      new Paragraph({ children: [new TextRun({ text: `${packing.invoiceNo || ''}   ${packing.invoiceDate || ''}`, bold: true, size: 15 })] })
                    ]
                  })
                ]
              }),

              // Row 2: Buyer's Order No. & Date (right)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Buyer's Order No. & Date", size: 15 })] }),
                      new Paragraph({ children: [new TextRun({ text: [packing.buyersOrderNo, packing.buyersOrderDate].filter(Boolean).join('  '), bold: true, size: 15 })] })
                    ]
                  })
                ]
              }),

              // Row 3: Other Reference (right)
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Other Reference', size: 15 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.otherReference && packing.otherReference.trim() !== '' ? packing.otherReference : (packing.buyersOrderNo ? `PO REF: ${packing.buyersOrderNo}` : '—'), bold: true, size: 15 })] })
                    ]
                  })
                ]
              }),

              // Row 4: Consignee & Buyer
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Consignee', size: 15 })] }),
                      ...cleanConsignee(packing.consignee || 'TO ORDER', bankName).split('\n').map((line, idx) =>
                        new Paragraph({ children: [new TextRun({ text: line, bold: idx === 0, size: 15 })] })
                      )
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Buyer (if other than consignee)', size: 15 })] }),
                      ...(packing.buyerIfOtherThanConsignee || packing.consignee || '').split('\n').map((line, idx) =>
                        new Paragraph({ children: [new TextRun({ text: line, bold: idx === 0, size: 15 })] })
                      )
                    ]
                  })
                ]
              }),

              // Top Grid Part 3: Transport & Origins
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Pre-Carriage by', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.preCarriageBy || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Place of Receipt by Pre-carrier', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.placeOfReceipt || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Country of Origin of Goods', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.countryOfOrigin || 'INDIAN ORIGIN', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Country of Final Destination', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.countryOfFinalDestination || '', bold: true, size: 14 })] })
                    ]
                  })
                ]
              }),

              // Top Grid Part 4: Vessel / Port of Loading & Terms
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Vessel/Flight No.', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.vesselFlightNo || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Port of Loading', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.portOfLoading || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    rowSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Terms of Delivery and Payment', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.termsOfDelivery || '', bold: true, size: 14 })] }),
                      ...(packing.bakedPalletQuote ? [new Paragraph({ children: [new TextRun({ text: `PACKING: ${packing.bakedPalletQuote}`, size: 13 })] })] : [])
                    ]
                  })
                ]
              }),

              // Top Grid Part 5: Discharge & Final Destination
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Port of Discharge', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.portOfDischarge || '', bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Final Destination', size: 14 })] }),
                      new Paragraph({ children: [new TextRun({ text: packing.finalDestination || '', bold: true, size: 14 })] })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '' }),

          // Main Line Items Table (Matching exact columns in scan)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Marks & Nos./', bold: true, size: 15 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Container No', bold: true, size: 15 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'No. & Kind of Pkg', bold: true, size: 15 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 38, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Description Of Goods', bold: true, size: 15 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 17, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Quantity', bold: true, size: 15 })] }),
                      new Paragraph({ children: [new TextRun({ text: 'KGS', bold: true, size: 13 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Remarks', bold: true, size: 15 })] })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      ...(packing.marksAndNos || 'AS PER LC / INVOICE').split('\n').map(l =>
                        new Paragraph({ children: [new TextRun({ text: l, size: 14 })] })
                      ),
                      ...(packing.containerNo || packing.packingRows[0]?.containerSealNo ? [
                        new Paragraph({ text: '' }),
                        new Paragraph({ children: [new TextRun({ text: 'CONT/SEAL:', bold: true, size: 14 })] }),
                        new Paragraph({ children: [new TextRun({ text: packing.containerNo || packing.packingRows[0]?.containerSealNo || '', size: 14 })] })
                      ] : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: packing.noAndKindOfPkg || `${totalCartonsCount || packing.packingRows.length} CARTONS`, bold: true, size: 15 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 38, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      ...(packing.goodsDescriptionVerbatim || '').split('\n').map(l =>
                        new Paragraph({ children: [new TextRun({ text: l, size: 14 })] })
                      )
                    ]
                  }),
                  new TableCell({
                    width: { size: 17, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      ...(packing.totalGrossWtKg != null && Number(packing.totalGrossWtKg) > 0 ? [
                        new Paragraph({ children: [new TextRun({ text: 'GROSS WT :', size: 14 })] }),
                        new Paragraph({ children: [new TextRun({ text: `${Number(packing.totalGrossWtKg).toFixed(2)} KGS`, bold: true, size: 15 })] }),
                        new Paragraph({ text: '' })
                      ] : []),
                      ...(packing.totalNetWtKg != null && Number(packing.totalNetWtKg) > 0 ? [
                        new Paragraph({ children: [new TextRun({ text: 'NET WT :', size: 14 })] }),
                        new Paragraph({ children: [new TextRun({ text: `${Number(packing.totalNetWtKg).toFixed(2)} KGS`, bold: true, size: 15 })] })
                      ] : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: packing.remarks || '', size: 14 })] })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '' }),
          new Paragraph({ children: [new TextRun({ text: 'PAKING DETAILS', bold: true, size: 17 })] }),

          // PAKING DETAILS 6-Column Sub-Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'LOT NO', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'COUNT', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'NO OF UNIT', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'CONTAINER NO/SEAL NOS.', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'NET WT/UNIT', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'GROSS WT/UNIT', bold: true, size: 14 })] })] })
                ]
              }),
              ...packing.packingRows.map(
                r =>
                  new TableRow({
                    children: [
                      new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: r.lotNo || '1', size: 14 })] })] }),
                      new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: r.count || '', size: 14 })] })] }),
                      new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: r.noOfUnits || '', size: 14 })] })] }),
                      new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: r.containerSealNo || '', size: 14 })] })] }),
                      new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: r.netWtKg != null ? `${Number(r.netWtKg).toFixed(2)} KGS` : '—', size: 14 })] })] }),
                      new TableCell({ width: { size: 13, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: r.grossWtKg != null ? `${Number(r.grossWtKg).toFixed(2)} KGS` : '—', size: 14 })] })] })
                    ]
                  })
              ),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL:', bold: true, size: 14 })] })]
                  }),
                  new TableCell({
                    width: { size: 14, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: `${totalCartonsCount || packing.totalCartonsOrPackages || packing.packingRows.length} CARTONS`, bold: true, size: 14 })] })]
                  }),
                  new TableCell({
                    width: { size: 26, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ text: '' })]
                  }),
                  new TableCell({
                    width: { size: 13, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: packing.totalNetWtKg != null ? `${Number(packing.totalNetWtKg).toFixed(2)} KGS` : '—', bold: true, size: 14 })] })]
                  }),
                  new TableCell({
                    width: { size: 13, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [new Paragraph({ children: [new TextRun({ text: packing.totalGrossWtKg != null ? `${Number(packing.totalGrossWtKg).toFixed(2)} KGS` : '—', bold: true, size: 14 })] })]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '' }),

          // Bottom Signature Box matching scan exactly
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 45, type: WidthType.PERCENTAGE },
                    borders: cleanCellBorders,
                    children: [new Paragraph({ text: '' })]
                  }),
                  new TableCell({
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: { top: 80, bottom: 80, left: 100, right: 100 },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: `For ${exporterName}`, bold: true, size: 15 })],
                        alignment: AlignmentType.RIGHT
                      }),
                      new Paragraph({ text: '', spacing: { before: 180, after: 180 } }),
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                width: { size: 50, type: WidthType.PERCENTAGE },
                                borders: cleanCellBorders,
                                children: [
                                  new Paragraph({
                                    children: [new TextRun({ text: 'Signature and Date', size: 14 })],
                                    alignment: AlignmentType.LEFT
                                  })
                                ]
                              }),
                              new TableCell({
                                width: { size: 50, type: WidthType.PERCENTAGE },
                                borders: cleanCellBorders,
                                children: [
                                  new Paragraph({
                                    children: [new TextRun({ text: 'Authorised Signatory', size: 14 })],
                                    alignment: AlignmentType.RIGHT
                                  })
                                ]
                              })
                            ]
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 3. BILL OF LADING DOCX
// -------------------------------------------------------------

export async function generateBillOfLadingDOCX(bl: BillOfLadingFinal, bankName?: string): Promise<Blob> {
  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const textStyle = { font: 'Times New Roman', size: 20 }; // 10pt

  const createText = (text: string) => {
    return text.split('\n').map(line => new Paragraph({
      children: [new TextRun({ text: line, ...textStyle })],
      spacing: { after: 0, line: 200 }
    }));
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    margins: { top: 75, bottom: 75, left: 75, right: 75 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Exporter', font: 'Times New Roman', size: 20 })] }),
                      ...createText((bl.exporter?.name || '') + '\n' + (bl.exporter?.address || ''))
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    margins: { top: 75, bottom: 75, left: 75, right: 75 },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'B/L INSTRUCTION', font: 'Times New Roman', size: 24 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 100 }
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: `Invoice No.\t${bl.invoiceNo || ''}`, font: 'Times New Roman', size: 20 })],
                        alignment: AlignmentType.RIGHT
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: noBorders, children: [new Paragraph({ text: "", spacing: { after: 200 } })] }),
                  new TableCell({ borders: noBorders, children: [new Paragraph({ text: "", spacing: { after: 200 } })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Consignee', ...textStyle })] }),
                      ...createText(cleanConsignee(bl.consignee || '', bankName)),
                      ...(bl.consigneeVatBin ? createText(`BIN NO. ${bl.consigneeVatBin}`) : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      
                      ...createText(`LC NO.${bl.lcNumber || ''} DATE ${bl.lcDate || ''}`)
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: noBorders, children: [new Paragraph({ text: "", spacing: { after: 300 } })] }),
                  new TableCell({ borders: noBorders, children: [new Paragraph({ text: "", spacing: { after: 300 } })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Notify', ...textStyle })] }),
                      ...createText(bl.notifyParty1 || ''),
                      ...(bl.notifyParty1VatBin && (!bl.notifyParty1 || (!bl.notifyParty1.toUpperCase().includes('BIN') && !bl.notifyParty1.toUpperCase().includes('VAT'))) ? createText(`BIN NO. ${bl.notifyParty1VatBin}`) : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Notify 2', ...textStyle })] }),
                      ...createText(bl.notifyParty2 || ''),
                      ...(bl.notifyParty2VatBin && (!bl.notifyParty2 || (!bl.notifyParty2.toUpperCase().includes('BIN') && !bl.notifyParty2.toUpperCase().includes('VAT'))) ? createText(`BIN NO. ${bl.notifyParty2VatBin}`) : [])
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ borders: noBorders, children: [new Paragraph({ text: "", spacing: { after: 400 } })] }),
                  new TableCell({ borders: noBorders, children: [new Paragraph({ text: "", spacing: { after: 400 } })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Vessel/Flight No.', ...textStyle })] }),
                      ...createText(bl.vesselFlightNo || ''),
                      new Paragraph({ text: "", spacing: { after: 150 } }),
                      new Paragraph({ children: [new TextRun({ text: 'Port of Discharge', ...textStyle })] }),
                      ...createText(bl.portOfDischarge || '')
                    ]
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Port of Loading', ...textStyle })] }),
                      ...createText(bl.portOfLoading || ''),
                      new Paragraph({ text: "", spacing: { after: 150 } }),
                      new Paragraph({ children: [new TextRun({ text: 'Final Destination', ...textStyle })] }),
                      ...createText(bl.finalDestination || '')
                    ]
                  })
                ]
              })
            ]
          }),
          
          new Paragraph({ text: "", spacing: { after: 150 } }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Marks & Nos./', ...textStyle })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Container No', ...textStyle })] }),
                      ...createText(bl.marksAndNos || ''),
                      ...(bl.totalGrossWtKg && !/GROSS\s*WT/i.test(bl.marksAndNos || '') ? createText(`TOTAL GROSS WT:\n${Number(bl.totalGrossWtKg).toFixed(3)} KGS`) : []),
                      ...(bl.totalNetWtKg && !/NET\s*WT/i.test(bl.marksAndNos || '') ? createText(`TOTAL NET WT:\n${Number(bl.totalNetWtKg).toFixed(3)} KGS`) : []),
                      ...(bl.containerSealNos && !(bl.marksAndNos || '').includes(bl.containerSealNos) ? createText(`CONTAINER NO/SEAL NO: ${bl.containerSealNos}`) : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'No. & Kind of Pkg', ...textStyle })] }),
                      
                      ...createText(bl.packagesCountAndKind || '')
                    ]
                  }),
                  new TableCell({
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Description Of Goods', ...textStyle })] }),
                      
                      ...createText(bl.goodsDescription || ''),
                      
                      ...blExtraLines(bl).flatMap(l => createText(l)),
                      
                      ...createText(`COMMERCIAL INVOICE NO. ${bl.invoiceNo || ''}`),
                      ...createText(bl.freightStatus || 'FREIGHT PREPAID'),
                      ...createText(`BL: ${bl.agentDetailsAtDestination || 'AGENT ADDRESS/TEL/FAX NO. AT DESTINATION PORT'}`),
                      ...createText(`S.B. NO. ${bl.shippingBillNo || '_____'} DATE ${bl.shippingBillDate || '_____'}`),
                      ...(bl.freeDetentionClause ? createText(`BL: ${bl.freeDetentionClause}`) : []),
                      ...createText(`BL: ${bl.blWeightCheckClause || 'CHECK NET/GR WT/ NO. OF CARTON AS PER SHIPPING BILL'}`)
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 4. CERTIFICATE OF ORIGIN DOCX
// -------------------------------------------------------------
export async function generateCertificateOfOriginDOCX(coo: CertificateOfOriginFinal, bankName?: string): Promise<Blob> {
  const isRoad = /petrapole|benapole|road|truck|by\s+road/i.test(
    `${coo.portOfLoading || ''} ${coo.portOfDischarge || ''} ${coo.vesselFlightNo || ''}`
  );
  const modeLabel = isRoad ? 'By Road' : 'By Sea';
  const grossValStr = (coo.grossWeightKg != null && Number(coo.grossWeightKg) > 0) ? `${Number(coo.grossWeightKg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} KGS` : '';
  const netValStr = (coo.netWeightKg != null && Number(coo.netWeightKg) > 0) ? `${Number(coo.netWeightKg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} KGS` : '';

  const exporterName = coo.exporter?.name || '';
  const exporterAddress = coo.exporter?.address || '';
  const consigneeText = cleanConsignee(coo.consignee || '', bankName);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [
          // 1. Centered Title Above All
          new Paragraph({
            children: [
              new TextRun({ text: 'CERTIFICATE OF ORIGIN', bold: true, size: 26, underline: {} })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 }
          }),

          // 2. Left-Aligned Header Block (Exporter, Applicant, Mode)
          ...(exporterName ? [
            new Paragraph({
              children: [new TextRun({ text: exporterName.toUpperCase(), bold: true, size: 16 })]
            })
          ] : []),
          ...exporterAddress.split(/[\r\n]+/).map(line =>
            new Paragraph({
              children: [new TextRun({ text: line.trim().toUpperCase(), size: 14 })]
            })
          ),

          // Blank spacing
          new Paragraph({ text: '', spacing: { before: 120 } }),

          // Applicant Name and Address
          new Paragraph({
            children: [new TextRun({ text: 'APPLICANT NAME AND ADDRESS', bold: true, size: 15 })]
          }),
          ...consigneeText.split(/[\r\n]+/).map((line, idx) =>
            new Paragraph({
              children: [new TextRun({ text: line.trim().toUpperCase(), bold: idx === 0, size: 14 })]
            })
          ),

          // Blank spacing
          new Paragraph({ text: '', spacing: { before: 120 } }),

          // Transport Mode & Details
          new Paragraph({
            children: [new TextRun({ text: modeLabel, size: 15 })]
          }),
          ...(coo.vesselFlightNo ? [
            new Paragraph({
              children: [new TextRun({ text: `VESSEL : ${coo.vesselFlightNo.toUpperCase()}`, size: 14 })]
            })
          ] : []),
          ...((coo.portOfLoading || coo.portOfDischarge) ? [
            new Paragraph({
              children: [new TextRun({ text: `FROM : ${(coo.portOfLoading || '').toUpperCase()} TO ${(coo.portOfDischarge || '').toUpperCase()}`, size: 14 })]
            })
          ] : []),

          new Paragraph({ text: '', spacing: { before: 180, after: 180 } }),

          // 3. Main Body Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'Item', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'MARK & NOS.', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 43, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'DESCRIPTION OF GOODS', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'ORIGIN', bold: true, size: 14 })] })] }),
                  new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'WEIGHT / INVOICE REF', bold: true, size: 14 })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: cellBorders, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: '1)', bold: true, size: 14 })] })] }),
                  new TableCell({
                    width: { size: 22, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      ...(coo.marksAndNos ? (coo.marksAndNos.split(/[\r\n]+/).map(line =>
                        new Paragraph({ children: [new TextRun({ text: line.toUpperCase(), size: 14 })] })
                      )) : [new Paragraph({ children: [new TextRun({ text: '', size: 14 })] })]),
                      ...(coo.containerSealNos ? [new Paragraph({ children: [new TextRun({ text: `CONT/SEAL: ${coo.containerSealNos.toUpperCase()}`, size: 14 })] })] : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 43, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      ...(coo.goodsDescription ? (coo.goodsDescription.split(/[\r\n]+/).map(line =>
                        new Paragraph({ children: [new TextRun({ text: line.toUpperCase(), size: 14 })] })
                      )) : [new Paragraph({ children: [new TextRun({ text: '', size: 14 })] })]),
                      ...(coo.originDeclaration ? [
                        new Paragraph({ text: '' }),
                        new Paragraph({ children: [new TextRun({ text: coo.originDeclaration.toUpperCase(), size: 13 })] })
                      ] : [])
                    ]
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      new Paragraph({ children: [new TextRun({ text: (coo.countryOfOrigin || 'INDIA').toUpperCase(), bold: true, size: 14 })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    borders: cellBorders,
                    margins: cellMargins,
                    children: [
                      ...(grossValStr ? [
                        new Paragraph({ children: [new TextRun({ text: 'GROSS WT :', bold: true, size: 14 }), new TextRun({ text: `\n${grossValStr}`, size: 14 })] }),
                        new Paragraph({ text: '' })
                      ] : []),
                      ...(netValStr ? [
                        new Paragraph({ children: [new TextRun({ text: 'NET WT :', bold: true, size: 14 }), new TextRun({ text: `\n${netValStr}`, size: 14 })] }),
                        new Paragraph({ text: '' })
                      ] : []),
                      ...(coo.invoiceNo ? [
                        new Paragraph({ children: [new TextRun({ text: `INVOICE NO: ${coo.invoiceNo}`, bold: true, size: 14 }), new TextRun({ text: coo.invoiceDate ? `\nDATE: ${coo.invoiceDate}` : '', size: 14 })] })
                      ] : [])
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { before: 180 } }),

          // 4. Sign-off block
          ...(coo.portOfDischarge ? [
            new Paragraph({
              children: [new TextRun({ text: `${coo.portOfDischarge.toUpperCase()}${isRoad ? ' BY ROAD' : ' BY SEA'}`, size: 14 })],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({ text: '' })
          ] : []),
          ...(exporterName ? [
            new Paragraph({
              children: [new TextRun({ text: `For ${exporterName.toUpperCase()}`, bold: true, size: 15 })],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [new TextRun({ text: 'Authorised Signatory', size: 14 })],
              alignment: AlignmentType.RIGHT
            })
          ] : []),
          new Paragraph({
            children: [new TextRun({ text: coo.placeAndDateOfIssue || (coo.invoiceDate ? `MUMBAI, DATE: ${coo.invoiceDate}` : ''), size: 14 })],
            alignment: AlignmentType.RIGHT
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 5. BILL OF EXCHANGE DOCX (First & Second of Exchange)
// -------------------------------------------------------------
export async function generateBillOfExchangeDOCX(boe: BillOfExchangeFinal): Promise<Blob> {
  function createExchangeDocxBlock(exchangeType: 'First' | 'Second') {
    const isFirst = exchangeType === 'First';
    const counterTenure = isFirst ? 'second' : 'first';
    const lcText = boe.headerText || `DRAWN UNDER THE ISSUING BANK MENTIONING THE LC NUMBER: ${boe.lcNumber || ''} AND DATE ${boe.lcDate || ''}`.trim();
    const bankDesc = boe.payToOrderOf || [boe.presentingBankProfile?.bankName, boe.presentingBankProfile?.branch, boe.presentingBankProfile?.city].filter(Boolean).join(', ');

    return [
      // Top Drawn Under LC banner
      new Paragraph({
        children: [
          ...lcText.split('\n').map((line, i) => new TextRun({
            text: line,
            bold: true,
            size: boe.headerText ? 15 : 18,
            font: 'Arial',
            break: i > 0 ? 1 : undefined
          }))
        ],
        alignment: boe.headerText ? AlignmentType.LEFT : AlignmentType.CENTER,
        spacing: { before: 80, after: 120 }
      }),

      // Header Row: Title & No/Date
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                borders: cleanCellBorders,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Bills of Exchange',
                        bold: true,
                        italics: true,
                        font: 'Times New Roman',
                        size: 36
                      })
                    ]
                  })
                ]
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: cleanCellBorders,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'No :   ', bold: true, size: 20, font: 'Arial' }),
                      new TextRun({ text: boe.invoiceNo || '', size: 20, font: 'Arial' })
                    ],
                    alignment: AlignmentType.RIGHT
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Date : ', bold: true, size: 20, font: 'Arial' }),
                      new TextRun({ text: boe.date || boe.invoiceDate || '', size: 20, font: 'Arial' })
                    ],
                    alignment: AlignmentType.RIGHT
                  })
                ]
              })
            ]
          })
        ]
      }),

      new Paragraph({ text: '', spacing: { before: 80, after: 80 } }),

      // Amount in figures
      new Paragraph({
        children: [
          new TextRun({ text: 'For     ', size: 22, font: 'Arial' }),
          new TextRun({ text: `${boe.currency || ''}   `, bold: true, size: 24, font: 'Arial' }),
          new TextRun({
            text: boe.amount != null
              ? Number(boe.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '',
            bold: true,
            size: 24,
            font: 'Arial'
          })
        ],
        spacing: { before: 80, after: 120 }
      }),

      // Tenor line
      new Paragraph({
        children: [
          new TextRun({ text: 'At   ', size: 20, font: 'Arial' }),
          new TextRun({
            text: boe.tenor
              ? boe.tenor.toUpperCase()
              : '____________________________________________________',
            bold: !!boe.tenor,
            underline: boe.tenor ? {} : undefined,
            size: 20,
            font: 'Arial'
          }),
          new TextRun({ text: '   of this   ', size: 20, font: 'Arial' }),
          new TextRun({
            text: exchangeType,
            bold: true,
            italics: true,
            color: 'CC0000',
            font: 'Times New Roman',
            size: 26
          }),
          new TextRun({
            text: `   Exchange (${counterTenure} of the same tenure and date being unpaid)`,
            size: 19,
            font: 'Arial'
          })
        ],
        spacing: { after: 120 }
      }),

      // Pay to the order of
      new Paragraph({
        children: [
          new TextRun({ text: 'Pay to the order of', size: 20, font: 'Arial' })
        ],
        spacing: { before: 60 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: bankDesc,
            bold: true,
            underline: {},
            size: 20,
            font: 'Arial'
          })
        ],
        spacing: { after: 120 }
      }),

      // the sum of
      new Paragraph({
        children: [
          new TextRun({ text: 'the sum of', size: 20, font: 'Arial' })
        ],
        spacing: { before: 60 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: (boe.amountInWords || '').toUpperCase(),
            bold: true,
            underline: {},
            size: 20,
            font: 'Arial'
          })
        ],
        spacing: { after: 120 }
      }),

      // Value received and charged the same to the account of
      new Paragraph({
        children: [
          new TextRun({ text: 'Value received and charged the same to the account of   ', size: 19, font: 'Arial' }),
          new TextRun({ text: boe.accountOf || '__________________________________', bold: !!boe.accountOf, underline: boe.accountOf ? {} : undefined, size: 19, font: 'Arial' })
        ],
        spacing: { after: 100 }
      }),

      // Packages shipped by S.S./Air ... Invoice No ... Date : ...
      new Paragraph({
        children: [
          new TextRun({ text: 'Packages shipped by S.S./Air   ', size: 18, font: 'Arial' }),
          new TextRun({ text: boe.packagesShippedBy || '______________', bold: true, underline: boe.packagesShippedBy ? {} : undefined, size: 18, font: 'Arial' }),
          new TextRun({ text: '      Invoice No   ', size: 18, font: 'Arial' }),
          new TextRun({ text: boe.invoiceNo || '______________', bold: true, underline: boe.invoiceNo ? {} : undefined, size: 18, font: 'Arial' }),
          new TextRun({ text: '      Date :   ', size: 18, font: 'Arial' }),
          new TextRun({ text: boe.invoiceDate || boe.date || '__________', bold: true, underline: (boe.invoiceDate || boe.date) ? {} : undefined, size: 18, font: 'Arial' })
        ],
        spacing: { after: 80 }
      }),

      // B.L./Air Bill :
      new Paragraph({
        children: [
          new TextRun({ text: 'B.L./Air Bill :   ', size: 18, font: 'Arial' }),
          new TextRun({ text: boe.blAirBillRef || '_____________________________________________________________________', bold: !!boe.blAirBillRef, underline: boe.blAirBillRef ? {} : undefined, size: 18, font: 'Arial' })
        ],
        spacing: { after: 140 }
      }),

      // Footer: To / M/s. DRAWEE & For LAHOTI OVERSEAS LIMITED / Signatory
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                borders: cleanCellBorders,
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'To,', size: 20, font: 'Arial' })] }),
                  new Paragraph({ children: [new TextRun({ text: 'M/s.', size: 20, font: 'Arial' })] }),
                  ...(boe.drawee || '').split('\n').map(line => new Paragraph({
                    children: [new TextRun({ text: line.trim(), bold: true, size: 20, font: 'Arial' })],
                    indent: { left: 400 }
                  }))
                ]
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                borders: cleanCellBorders,
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: boe.drawer?.name ? `For ${boe.drawer.name}` : '', bold: true, size: 19, font: 'Arial' })],
                    alignment: AlignmentType.RIGHT
                  }),
                  new Paragraph({ text: '', spacing: { before: 100, after: 100 } }),
                  new Paragraph({
                    children: [new TextRun({ text: 'Authorised Signatory', size: 18, font: 'Arial' })],
                    alignment: AlignmentType.RIGHT
                  })
                ]
              })
            ]
          })
        ]
      })
    ];
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 600, bottom: 600, left: 720, right: 720 }
          }
        },
        children: [
          ...createExchangeDocxBlock('First'),
          new Paragraph({ text: '', spacing: { before: 240, after: 240 } }),
          ...createExchangeDocxBlock('Second')
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

// -------------------------------------------------------------
// 6. BENEFICIARY CERTIFICATES DOCX
// -------------------------------------------------------------
export function createBeneficiaryCertDocxChildren(cert: BeneficiaryCertFinal): (Paragraph | Table)[] {
  const isEmail = cert.certType === 'email_advice_enclosed';
  const displayTitle = cert.docTitle || (cert.title.includes('(') ? cert.title.split('(')[0].trim() : cert.title);

  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  let logoBuffer: Uint8Array | null = null;
  try {
    const binaryStr = atob(lahotiOverseasLogoPngBase64);
    logoBuffer = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      logoBuffer[i] = binaryStr.charCodeAt(i);
    }
  } catch (err) {
    console.warn('Could not decode logo buffer for DOCX:', err);
  }

  return [
    // Header Table (Logo / Mark Left, Address Right)
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                ...(logoBuffer ? [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: { width: 75, height: 75 },
                        type: 'png'
                      })
                    ],
                    spacing: { before: 0, after: 0 }
                  })
                ] : [
                  new Paragraph({
                    children: [new TextRun({ text: 'LAHOTI GROUP', bold: true, size: 22, color: '1E3A8A' })],
                    spacing: { before: 0, after: 0 }
                  })
                ])
              ]
            }),
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              borders: noBorders,
              margins: {
                left: 280
              },
              children: [
                new Paragraph({ children: [new TextRun({ text: 'LAHOTI OVERSEAS LTD.', bold: true, size: 24 })], spacing: { before: 0, after: 20, line: 240 } }),
                new Paragraph({ children: [new TextRun({ text: 'REGD OFFICE:', bold: true, size: 15 })], spacing: { before: 0, after: 0, line: 200 } }),
                new Paragraph({ children: [new TextRun({ text: '307, ARUN CHAMBERS, TARDEO ROAD,', size: 15 })], spacing: { before: 0, after: 0, line: 200 } }),
                new Paragraph({ children: [new TextRun({ text: 'MUMBAI - 400 034 INDIA', size: 15 })], spacing: { before: 0, after: 0, line: 200 } }),
                new Paragraph({ children: [new TextRun({ text: 'TEL.: 91-22-40500100 TO 40500199', size: 15 })], spacing: { before: 0, after: 0, line: 200 } }),
                new Paragraph({ children: [new TextRun({ text: 'FAX: 91-22-40500150', size: 15 })], spacing: { before: 0, after: 0, line: 200 } }),
                new Paragraph({ children: [new TextRun({ text: 'E-Mail: umesh@lahotioverseas.com', size: 15 })], spacing: { before: 0, after: 0, line: 200 } }),
                new Paragraph({ children: [new TextRun({ text: 'Internet: www.lahotioverseas.com', size: 15 })], spacing: { before: 0, after: 60, line: 200 } })
              ]
            })
          ]
        })
      ]
    }),
    new Paragraph({ text: '', spacing: { before: 100, after: 100 } }),

    ...(isEmail && cert.emailDetails ? [
      new Paragraph({ text: `From: ${cert.emailDetails.from || 'DOCS1 [docs1@lahotioverseas.com]'}` }),
      new Paragraph({ text: `Sent: ${cert.emailDetails.sent || ''}` }),
      new Paragraph({ text: `To: ${cert.emailDetails.to || cert.applicantEmail || ''}` }),
      new Paragraph({ children: [new TextRun({ text: `Subject: ${cert.emailDetails.subject || ''}`, bold: true })] }),
      new Paragraph({ text: '', spacing: { before: 60, after: 60 } })
    ] : [
      new Paragraph({ children: [new TextRun({ text: `DATE: ${cert.docHeaderDate || '________'}`, bold: true })] }),
      new Paragraph({ text: '', spacing: { before: 60, after: 60 } }),
      new Paragraph({
        children: [new TextRun({ text: displayTitle.toUpperCase(), bold: true, underline: {} })],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ text: '', spacing: { before: 80, after: 80 } })
    ]),

    ...(cert.recipients && cert.recipients.length ? cert.recipients.flatMap(r => [
      new Paragraph({ children: [new TextRun({ text: 'TO,', bold: true })] }),
      ...r.address.split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, bold: true })] })),
      ...(r.email ? [new Paragraph({ children: [new TextRun({ text: `EMAIL: ${r.email}`, bold: true })] })] : []),
      new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
    ]) : []),

    ...(!cert.recipients?.length && cert.insuranceCompanyDetails ? [
      new Paragraph({ children: [new TextRun({ text: 'TO,', bold: true })] }),
      ...cert.insuranceCompanyDetails.split('\n').map(l => new Paragraph({ text: l })),
      ...(cert.insuranceEmail ? [new Paragraph({ text: `EMAIL: ${cert.insuranceEmail}` })] : []),
      new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
    ] : []),

    ...(!cert.recipients?.length && cert.applicantDetails ? [
      new Paragraph({ children: [new TextRun({ text: 'TO,', bold: true })] }),
      ...cert.applicantDetails.split('\n').map(l => new Paragraph({ text: l })),
      ...(cert.applicantBin ? [new Paragraph({ text: `VAT REGISTRATION NO. (BIN): ${cert.applicantBin}` })] : []),
      ...(cert.applicantEmail ? [new Paragraph({ text: `EMAIL: ${cert.applicantEmail}` })] : []),
      new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
    ] : []),

    ...(cert.certType === 'shipment_advice_dispatch' ? [
      ...(cert.insuranceCoverNote ? [new Paragraph({ children: [new TextRun({ text: `INSURANCE COVER NOTE NO. ${cert.insuranceCoverNote}${cert.insuranceCoverNoteDate ? ' DTD: ' + cert.insuranceCoverNoteDate : ''}`, bold: true, underline: {}, size: 16 })] })] : []),
      new Paragraph({ children: [new TextRun({ text: `L/C NO. ${cert.lcNumber || ''} ${cert.lcDate ? 'DATE ' + cert.lcDate : ''}`.trim(), bold: true, underline: {}, size: 16 })] }),
      new Paragraph({ text: '', spacing: { before: 80, after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: 'PLEASE NOTE BELOW DETAILS OF SHIPMENT –', bold: true, size: 16 })] }),
      new Paragraph({ text: '', spacing: { before: 40 } }),
      ...(cert.goodsNarration ? [new Paragraph({ children: [new TextRun({ text: cert.goodsNarration, size: 15 })] }), new Paragraph({ text: '', spacing: { before: 40, after: 40 } })] : []),
      ...(cert.particulars && cert.particulars.length ? [
        ...cert.particulars.map(({ label, value }) => new Paragraph({
          children: [
            new TextRun({ text: `${label}`, bold: true, size: 15 }),
            new TextRun({ text: `\t: ${value}`, size: 15 })
          ],
          tabStops: [{ type: 'left' as any, position: 4200 }]
        })),
        new Paragraph({ text: '', spacing: { before: 80, after: 80 } })
      ] : cert.shipmentParticulars ? [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'NAME OF VESSEL NO.: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.vessel || '', size: 15 })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'DATE OF SHIPMENT: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.shipmentDate || '', size: 15 })
                      ]
                    })
                  ]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'INVOICE AMOUNT: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.invoiceAmount || '', size: 15 })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'QUANTITY: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.quantity || '', size: 15 })
                      ]
                    })
                  ]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'PORT OF LOADING: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.portOfLoading || '', size: 15 })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'PORT OF DISCHARGE: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.portOfDischarge || '', size: 15 })
                      ]
                    })
                  ]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'B/L NO.: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.blNo || '', size: 15 })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: cellBorders,
                  margins: cellMargins,
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'CONTAINER NO.: ', bold: true, size: 15 }),
                        new TextRun({ text: cert.shipmentParticulars.containerNo || '', size: 15 })
                      ]
                    })
                  ]
                })
              ]
            })
          ]
        }),
        new Paragraph({ text: '', spacing: { before: 80, after: 80 } })
      ] : [])
    ] : [
      ...(cert.text ? cert.text.split(/[\r\n]+/).map(line => {
        const trimmed = line.trim();
        const isBullet = /^[•\-\*]\s+/.test(trimmed) || /^\d+[\.\)]\s+/.test(trimmed);
        return new Paragraph({
          children: [new TextRun({ text: trimmed, size: 15 })],
          spacing: { after: isBullet ? 60 : 100 },
          indent: isBullet ? { left: 360 } : undefined
        });
      }) : []),
      new Paragraph({ text: '', spacing: { before: 40, after: 40 } }),
      ...(cert.listOfDocuments && cert.listOfDocuments.length > 0 ? [
        new Paragraph({ children: [new TextRun({ text: 'LIST OF DOCUMENTS:', bold: true, size: 16 })] }),
        ...cert.listOfDocuments.map(d => new Paragraph({
          children: [new TextRun({ text: `•  ${d.replace(/^[•\-\*]\s*/, '')}`, size: 15 })],
          indent: { left: 360 },
          spacing: { after: 40 }
        })),
        new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
      ] : []),
      ...(cert.postTextInstruction && cert.postTextInstruction.includes('EMAIL COPY') ? [
        new Paragraph({ children: [new TextRun({ text: cert.postTextInstruction, bold: true, size: 15 })] }),
        new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
      ] : [])
    ]),

    ...(cert.footnoteDetails ? [
      ...cert.footnoteDetails.split('\n').filter(Boolean).map(line => {
        const trimmed = line.trim();
        const isUnderlined = trimmed.startsWith('INVOICE NO.') || trimmed.startsWith('LETTER OF CREDIT NO.');
        return new Paragraph({
          children: [new TextRun({ text: trimmed, bold: true, underline: isUnderlined ? {} : undefined, size: 15 })],
          spacing: { after: 40 }
        });
      }),
      new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
    ] : []),

    ...(cert.postTextInstruction && cert.certType === 'shipment_advice_dispatch' ? [
      ...cert.postTextInstruction.split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, bold: true, size: 15 })] })),
      new Paragraph({ text: '', spacing: { before: 40, after: 40 } })
    ] : []),

    ...(isEmail ? [
      new Paragraph({ text: 'Best Regards' }),
      new Paragraph({ children: [new TextRun({ text: cert.signatoryName || '', bold: true })] }),
      new Paragraph({ text: cert.signatoryCompany || cert.exporter?.name || '' })
    ] : [
      new Paragraph({ text: '', spacing: { before: 80 } }),
      new Paragraph({ children: [new TextRun({ text: cert.signatoryCompany || (cert.exporter?.name ? `For ${cert.exporter.name}` : ''), bold: true })] }),
      new Paragraph({ text: '', spacing: { before: 200 } }),
      new Paragraph({ children: [new TextRun({ text: cert.signatoryName || 'Authorised Signatory' })] })
    ])
  ];
}

export async function generateBeneficiaryCertificateDOCX(cert: BeneficiaryCertFinal): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: createBeneficiaryCertDocxChildren(cert)
      }
    ]
  });
  return await Packer.toBlob(doc);
}

export async function generateAllBeneficiaryCertificatesDOCX(certs: BeneficiaryCertFinal[]): Promise<Blob> {
  const sections = (certs || []).map(cert => ({
    properties: {
      page: {
        margin: { top: 720, bottom: 720, left: 720, right: 720 }
      }
    },
    children: createBeneficiaryCertDocxChildren(cert)
  }));
  const doc = new Document({
    sections: sections.length > 0 ? sections : [{ children: [new Paragraph({ text: 'No certificates' })] }]
  });
  return await Packer.toBlob(doc);
}

export async function generateGenericDOCX(title: string, content: string, footerNote?: string): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 }
          }
        },
        children: [
          new Paragraph({ text: 'LAHOTI OVERSEAS LIMITED', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI - 400 034 INDIA', alignment: AlignmentType.CENTER }),
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '' }),
          ...content.split('\n').map(line => new Paragraph({ text: line })),
          new Paragraph({ text: '' }),
          new Paragraph({ text: footerNote || 'For LAHOTI OVERSEAS LIMITED\nAuthorised Signatory', alignment: AlignmentType.RIGHT })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}
