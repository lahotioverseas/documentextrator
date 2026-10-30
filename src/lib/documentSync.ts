import { FinalDocumentSet, ExporterParty } from '../types';
import { numberToWords } from './documentGenerators';
import { formatNoAndKindOfPkg, inferPackageKind, buildItemMarksAndNos } from './packageConstants';

/**
 * Normalizes number representation
 */
function toNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Deep clones the document set to prevent unintended mutations
 */
export function cloneDocSet(docs: FinalDocumentSet): FinalDocumentSet {
  return JSON.parse(JSON.stringify(docs));
}

/**
 * Synchronizes single-field updates across all 6 final export documents
 */
export function syncDocumentField(
  currentDocs: FinalDocumentSet,
  docType: 'invoice' | 'packing' | 'bl' | 'coo' | 'boe' | 'bencert',
  field: string,
  value: any
): FinalDocumentSet {
  const next = cloneDocSet(currentDocs);
  const currency = next.commercialInvoice.currency || next.billOfExchange.currency || 'USD';

  switch (field) {
    // 0. EXPORTER / SHIPPER / DRAWER WHOLE OBJECT
    case 'exporter':
    case 'shipper':
    case 'drawer': {
      if (typeof value === 'object' && value !== null) {
        const updatedExp = { ...next.commercialInvoice.exporter, ...value };
        next.commercialInvoice.exporter = updatedExp;
        next.packingList.exporter = updatedExp;
        next.billOfLading.exporter = updatedExp;
        next.billOfLading.shipper = updatedExp;
        next.certificateOfOrigin.exporter = updatedExp;
        next.billOfExchange.drawer = updatedExp;
      }
      break;
    }

    // 1. INVOICE NUMBER
    case 'invoiceNo': {
      const strVal = String(value ?? '');
      next.commercialInvoice.invoiceNo = strVal;
      next.packingList.invoiceNo = strVal;
      next.billOfLading.invoiceNo = strVal;
      next.certificateOfOrigin.invoiceNo = strVal;
      next.billOfExchange.invoiceNo = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        invoiceNo: strVal
      }));
      break;
    }

    // 2. INVOICE DATE
    case 'invoiceDate':
    case 'date': {
      const strVal = String(value ?? '');
      next.commercialInvoice.invoiceDate = strVal;
      next.packingList.invoiceDate = strVal;
      next.billOfLading.invoiceDate = strVal;
      next.certificateOfOrigin.invoiceDate = strVal;
      next.billOfExchange.invoiceDate = strVal;
      next.billOfExchange.date = strVal;
      break;
    }

    // 3. LC NUMBER / REFERENCE
    case 'lcReference':
    case 'lcNumber': {
      const strVal = String(value ?? '');
      next.commercialInvoice.lcReference = strVal;
      next.billOfLading.lcNumber = strVal;
      next.certificateOfOrigin.lcNumber = strVal;
      next.billOfExchange.lcNumber = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        lcNumber: strVal
      }));
      break;
    }

    // 4. LC DATE / REFERENCE
    case 'lcDateReference':
    case 'lcDate': {
      const strVal = String(value ?? '');
      next.commercialInvoice.lcDateReference = strVal;
      next.billOfLading.lcDate = strVal;
      next.certificateOfOrigin.lcDate = strVal;
      next.billOfExchange.lcDate = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        lcDate: strVal
      }));
      break;
    }

    // 5. CONSIGNEE / DRAWEE / APPLICANT
    case 'consignee':
    case 'drawee':
    case 'applicantDetails': {
      const strVal = String(value ?? '');
      next.commercialInvoice.consignee = strVal;
      next.packingList.consignee = strVal;
      next.billOfLading.consignee = strVal;
      next.certificateOfOrigin.consignee = strVal;
      next.billOfExchange.drawee = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        applicantDetails: strVal
      }));
      break;
    }

    // 6. BUYER IF OTHER THAN CONSIGNEE
    case 'buyerIfOtherThanConsignee': {
      const strVal = String(value ?? '');
      next.commercialInvoice.buyerIfOtherThanConsignee = strVal;
      next.packingList.buyerIfOtherThanConsignee = strVal;
      break;
    }

    // 7. BUYER ORDER NO / CONTRACT REFERENCE / EXPORTER REF
    case 'buyersOrderNo':
    case 'contractReference':
    case 'exporterRef': {
      const strVal = String(value ?? '');
      next.commercialInvoice.buyersOrderNo = strVal;
      next.packingList.buyersOrderNo = strVal;
      next.packingList.exporterRef = strVal;
      next.certificateOfOrigin.contractReference = strVal;
      break;
    }

    // 8. BUYER ORDER DATE
    case 'buyersOrderDate': {
      const strVal = String(value ?? '');
      next.commercialInvoice.buyersOrderDate = strVal;
      next.packingList.buyersOrderDate = strVal;
      break;
    }

    // 9. OTHER REFERENCE
    case 'otherReference': {
      const strVal = String(value ?? '');
      next.commercialInvoice.otherReference = strVal;
      next.packingList.otherReference = strVal;
      break;
    }

    // 10. COUNTRY OF ORIGIN
    case 'countryOfOrigin': {
      const strVal = String(value ?? '');
      next.commercialInvoice.countryOfOrigin = strVal;
      next.packingList.countryOfOrigin = strVal;
      next.certificateOfOrigin.countryOfOrigin = strVal;
      break;
    }

    // 11. COUNTRY OF FINAL DESTINATION
    case 'countryOfFinalDestination': {
      const strVal = String(value ?? '');
      next.commercialInvoice.countryOfFinalDestination = strVal;
      next.packingList.countryOfFinalDestination = strVal;
      break;
    }

    // 12. TERMS OF DELIVERY / INCOTERMS
    case 'termsOfDelivery': {
      const strVal = String(value ?? '');
      next.commercialInvoice.termsOfDelivery = strVal;
      next.packingList.termsOfDelivery = strVal;
      next.certificateOfOrigin.termsOfDelivery = strVal;
      break;
    }

    // 13. PORT OF LOADING
    case 'portOfLoading': {
      const strVal = String(value ?? '');
      next.commercialInvoice.portOfLoading = strVal;
      next.packingList.portOfLoading = strVal;
      next.billOfLading.portOfLoading = strVal;
      next.certificateOfOrigin.portOfLoading = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, portOfLoading: strVal } }
          : c
      );
      break;
    }

    // 14. PORT OF DISCHARGE
    case 'portOfDischarge': {
      const strVal = String(value ?? '');
      next.commercialInvoice.portOfDischarge = strVal;
      next.packingList.portOfDischarge = strVal;
      next.billOfLading.portOfDischarge = strVal;
      next.certificateOfOrigin.portOfDischarge = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, portOfDischarge: strVal } }
          : c
      );
      break;
    }

    // 15. FINAL DESTINATION
    case 'finalDestination': {
      const strVal = String(value ?? '');
      next.commercialInvoice.finalDestination = strVal;
      next.packingList.finalDestination = strVal;
      next.billOfLading.finalDestination = strVal;
      break;
    }

    // 16. PRE-CARRIAGE BY
    case 'preCarriageBy': {
      const strVal = String(value ?? '');
      next.commercialInvoice.preCarriageBy = strVal;
      next.packingList.preCarriageBy = strVal;
      break;
    }

    // 17. PLACE OF RECEIPT
    case 'placeOfReceipt': {
      const strVal = String(value ?? '');
      next.commercialInvoice.placeOfReceipt = strVal;
      next.packingList.placeOfReceipt = strVal;
      break;
    }

    // 18. VESSEL / FLIGHT NO
    case 'vesselFlightNo':
    case 'vessel': {
      const strVal = String(value ?? '');
      next.commercialInvoice.vesselFlightNo = strVal;
      next.packingList.vesselFlightNo = strVal;
      next.billOfLading.vesselFlightNo = strVal;
      next.certificateOfOrigin.vesselFlightNo = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, vessel: strVal } }
          : c
      );
      break;
    }

    // 19. MARKS AND NUMBERS
    case 'marksAndNos': {
      const strVal = String(value ?? '');
      next.packingList.marksAndNos = strVal;
      next.billOfLading.marksAndNos = strVal;
      next.certificateOfOrigin.marksAndNos = strVal;
      break;
    }

    // 20. CONTAINER & SEAL NUMBERS
    case 'containerNo':
    case 'containerSealNos':
    case 'containerSealNo': {
      const strVal = String(value ?? '');
      next.packingList.containerNo = strVal;
      next.billOfLading.containerSealNos = strVal;
      next.certificateOfOrigin.containerSealNos = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, containerNo: strVal } }
          : c
      );
      if (strVal && next.commercialInvoice.lineItems.length > 0) {
        next.commercialInvoice.lineItems = next.commercialInvoice.lineItems.map(item => {
          let currentMarks = item.marksAndNos || '';
          if (!currentMarks.includes(strVal)) {
            if (/CONT(?:AINER)?\s*(?:NO)?\/SEAL/i.test(currentMarks)) {
              currentMarks = currentMarks.replace(/CONT(?:AINER)?\s*(?:NO)?\/SEAL[^\n]*/gi, `CONTAINER NO/SEAL NO: ${strVal}`);
            } else {
              currentMarks = `${currentMarks}\nCONTAINER NO/SEAL NO: ${strVal}`.trim();
            }
          }
          return { ...item, marksAndNos: currentMarks };
        });
      }
      break;
    }

    // 21. PACKAGES COUNT & KIND
    case 'noAndKindOfPkg':
    case 'packagesCountAndKind':
    case 'totalCartonsOrPackages':
    case 'cartonCountOrPackages':
    case 'packagesShippedBy': {
      const strVal = String(value ?? '');
      next.packingList.noAndKindOfPkg = strVal;
      next.packingList.totalCartonsOrPackages = strVal;
      next.billOfLading.packagesCountAndKind = strVal;
      next.certificateOfOrigin.cartonCountOrPackages = strVal;
      next.billOfExchange.packagesShippedBy = strVal;
      break;
    }

    // 22. GROSS WEIGHT
    case 'totalGrossWtKg':
    case 'grossWeightKg': {
      const numVal = toNum(value);
      next.packingList.totalGrossWtKg = numVal;
      next.billOfLading.totalGrossWtKg = numVal;
      next.certificateOfOrigin.grossWeightKg = numVal;
      break;
    }

    // 23. NET WEIGHT
    case 'totalNetWtKg':
    case 'netWeightKg': {
      const numVal = toNum(value);
      next.packingList.totalNetWtKg = numVal;
      next.billOfLading.totalNetWtKg = numVal;
      next.certificateOfOrigin.netWeightKg = numVal;
      break;
    }

    // 24. TOTAL QUANTITY
    case 'totalQuantity':
    case 'quantityWithUom':
    case 'quantity': {
      const numVal = toNum(value);
      const formattedUom = numVal > 0 ? `${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KGS` : String(value ?? '');
      next.commercialInvoice.totalQuantity = numVal;
      next.certificateOfOrigin.quantityWithUom = formattedUom;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, quantity: formattedUom } }
          : c
      );
      break;
    }

    // 25. TOTAL AMOUNT & AMOUNTS IN WORDS
    case 'totalAmount':
    case 'amount': {
      const numVal = toNum(value);
      const words = numberToWords(numVal, currency);
      const formattedAmt = `${currency} ${numVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      next.commercialInvoice.totalAmount = numVal;
      next.commercialInvoice.amountInWords = words;
      next.billOfExchange.amount = numVal;
      next.billOfExchange.amountInWords = words;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, invoiceAmount: formattedAmt } }
          : c
      );
      break;
    }

    // 26. CURRENCY
    case 'currency': {
      const strVal = String(value ?? 'USD').toUpperCase();
      const currAmt = next.commercialInvoice.totalAmount || next.billOfExchange.amount || 0;
      const words = numberToWords(currAmt, strVal);
      const formattedAmt = `${strVal} ${currAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      next.commercialInvoice.currency = strVal;
      next.billOfExchange.currency = strVal;
      next.commercialInvoice.amountInWords = words;
      next.billOfExchange.amountInWords = words;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, invoiceAmount: formattedAmt } }
          : c
      );
      break;
    }

    // 27. AMOUNT IN WORDS (Direct edit)
    case 'amountInWords': {
      const strVal = String(value ?? '').toUpperCase();
      next.commercialInvoice.amountInWords = strVal;
      next.billOfExchange.amountInWords = strVal;
      break;
    }

    // 28. TENOR / PAYMENT TERMS
    case 'tenor':
    case 'paymentTenorLine': {
      const strVal = String(value ?? '');
      next.commercialInvoice.tenor = strVal;
      next.commercialInvoice.paymentTenorLine = strVal;
      next.billOfExchange.tenor = strVal;
      break;
    }

    // 29. INSURANCE COVER NOTE & DATE
    case 'insuranceCoverNote': {
      const strVal = String(value ?? '');
      next.billOfLading.insuranceCoverNote = strVal;
      next.certificateOfOrigin.insuranceCoverNote = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        insuranceCoverNote: strVal
      }));
      break;
    }
    case 'insuranceCoverNoteDate': {
      const strVal = String(value ?? '');
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        insuranceCoverNoteDate: strVal
      }));
      break;
    }

    // 30. GOODS DESCRIPTION / LC NARRATIVE
    case 'goodsDescription':
    case 'goodsDescriptionVerbatim':
    case 'goodsNarration': {
      const strVal = String(value ?? '');
      next.packingList.goodsDescriptionVerbatim = strVal;
      next.billOfLading.goodsDescription = strVal;
      next.certificateOfOrigin.goodsDescription = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        goodsNarration: strVal
      }));
      break;
    }

    // 31. BILL OF LADING NUMBER / AIR BILL REF
    case 'blAirBillRef':
    case 'blNo': {
      const strVal = String(value ?? '');
      next.billOfExchange.blAirBillRef = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
        c.shipmentParticulars
          ? { ...c, shipmentParticulars: { ...c.shipmentParticulars, blNo: strVal } }
          : c
      );
      break;
    }

    // 32. APPLICANT VAT / BIN / TIN
    case 'vatApplicant':
    case 'applicantBin': {
      const strVal = String(value ?? '');
      next.billOfLading.vatApplicant = strVal;
      next.certificateOfOrigin.vatApplicant = strVal;
      next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => ({
        ...c,
        applicantBin: strVal
      }));
      break;
    }

    // 33. ISSUING BANK VAT
    case 'vatIssuingBank': {
      const strVal = String(value ?? '');
      next.billOfLading.vatIssuingBank = strVal;
      next.certificateOfOrigin.vatIssuingBank = strVal;
      break;
    }

    // 34. SHIPPING BILL NO & DATE
    case 'shippingBillNo': {
      next.billOfLading.shippingBillNo = String(value ?? '');
      break;
    }
    case 'shippingBillDate': {
      next.billOfLading.shippingBillDate = String(value ?? '');
      break;
    }

    // DEFAULT: Apply directly to source document
    default: {
      if (docType === 'invoice') {
        (next.commercialInvoice as any)[field] = value;
      } else if (docType === 'packing') {
        (next.packingList as any)[field] = value;
      } else if (docType === 'bl') {
        (next.billOfLading as any)[field] = value;
      } else if (docType === 'coo') {
        (next.certificateOfOrigin as any)[field] = value;
      } else if (docType === 'boe') {
        (next.billOfExchange as any)[field] = value;
      }
      break;
    }
  }

  return next;
}

/**
 * Synchronizes nested exporter changes (Name, Address, Tel, CIN, PAN, IEC, GSTIN, etc.)
 */
export function syncDocumentNestedExporter(
  currentDocs: FinalDocumentSet,
  nestedField: string,
  value: any
): FinalDocumentSet {
  const next = cloneDocSet(currentDocs);
  const updatedExporter: ExporterParty = {
    ...next.commercialInvoice.exporter,
    [nestedField]: value
  };

  next.commercialInvoice.exporter = updatedExporter;
  next.packingList.exporter = updatedExporter;
  next.billOfLading.exporter = updatedExporter;
  next.billOfLading.shipper = updatedExporter;
  next.certificateOfOrigin.exporter = updatedExporter;
  next.billOfExchange.drawer = updatedExporter;

  return next;
}

/**
 * Synchronizes invoice line item updates (Quantity, Rate, Amount, Description)
 */
export function syncInvoiceLineItem(
  currentDocs: FinalDocumentSet,
  lineIndex: number,
  field: string,
  value: any
): FinalDocumentSet {
  const next = cloneDocSet(currentDocs);
  const lineItems = [...next.commercialInvoice.lineItems];
  if (!lineItems[lineIndex]) return next;

  const currentItem = { ...lineItems[lineIndex] };

  if (field === 'quantity') {
    const q = toNum(value);
    currentItem.quantity = q;
    currentItem.amount = Math.round(q * (currentItem.rate || 0) * 100) / 100;
  } else if (field === 'rate') {
    const r = toNum(value);
    currentItem.rate = r;
    currentItem.amount = Math.round((currentItem.quantity || 0) * r * 100) / 100;
  } else if (field === 'amount') {
    currentItem.amount = toNum(value);
  } else if (field === 'packageKind' || field === 'cartonOption') {
    currentItem.packageKind = value;
    currentItem.cartonOption = value;
    const count = currentItem.noOfCartons != null && currentItem.noOfCartons !== 0 ? currentItem.noOfCartons : currentItem.quantity;
    const formatted = formatNoAndKindOfPkg(count, value);
    currentItem.noAndKindOfPkg = formatted;
    next.packingList.noAndKindOfPkg = formatted;
    next.packingList.totalCartonsOrPackages = formatted;
    next.billOfLading.packagesCountAndKind = formatted;
    next.certificateOfOrigin.cartonCountOrPackages = formatted;
    next.billOfExchange.packagesShippedBy = formatted;

    // Recalculate marksAndNos on packageKind change
    currentItem.marksAndNos = buildItemMarksAndNos(currentItem);
    if (lineIndex === 0) {
      next.packingList.marksAndNos = currentItem.marksAndNos;
      next.billOfLading.marksAndNos = currentItem.marksAndNos;
      next.certificateOfOrigin.marksAndNos = currentItem.marksAndNos;
    }
  } else if (field === 'noAndKindOfPkg') {
    const strVal = String(value ?? '');
    currentItem.noAndKindOfPkg = strVal;
    next.packingList.noAndKindOfPkg = strVal;
    next.packingList.totalCartonsOrPackages = strVal;
    next.billOfLading.packagesCountAndKind = strVal;
    next.certificateOfOrigin.cartonCountOrPackages = strVal;
    next.billOfExchange.packagesShippedBy = strVal;
  } else if (field === 'marksAndNos') {
    const strVal = String(value ?? '');
    currentItem.marksAndNos = strVal;
    if (lineIndex === 0) {
      next.packingList.marksAndNos = strVal;
      next.billOfLading.marksAndNos = strVal;
      next.certificateOfOrigin.marksAndNos = strVal;
    }
  } else {
    (currentItem as any)[field] = value;
  }

  lineItems[lineIndex] = currentItem;

  // Recalculate totals
  const totalQuantity = lineItems.reduce((acc, it) => acc + (toNum(it.quantity) || 0), 0);
  const totalAmount = lineItems.reduce((acc, it) => acc + (toNum(it.amount) || 0), 0);
  const currency = next.commercialInvoice.currency || 'USD';
  const words = numberToWords(totalAmount, currency);
  const formattedAmt = `${currency} ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formattedQty = `${totalQuantity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KGS`;

  next.commercialInvoice.lineItems = lineItems;
  next.commercialInvoice.totalQuantity = totalQuantity;
  next.commercialInvoice.totalAmount = totalAmount;
  next.commercialInvoice.amountInWords = words;

  // Synchronize across BOE, COO, and Beneficiary Certificates
  next.billOfExchange.amount = totalAmount;
  next.billOfExchange.amountInWords = words;
  next.certificateOfOrigin.quantityWithUom = formattedQty;
  next.beneficiaryCertificates = next.beneficiaryCertificates.map(c =>
    c.shipmentParticulars
      ? {
          ...c,
          shipmentParticulars: {
            ...c.shipmentParticulars,
            invoiceAmount: formattedAmt,
            quantity: formattedQty
          }
        }
      : c
  );

  return next;
}

/**
 * Synchronizes packing row updates and re-sums gross and net weights across documents
 */
export function syncPackingRow(
  currentDocs: FinalDocumentSet,
  rowIndex: number,
  field: string,
  value: any
): FinalDocumentSet {
  const next = cloneDocSet(currentDocs);
  const rows = [...next.packingList.packingRows];
  if (!rows[rowIndex]) return next;

  rows[rowIndex] = { ...rows[rowIndex], [field]: value };
  next.packingList.packingRows = rows;

  // Re-sum total weights if weight fields changed
  if (field === 'netWtKg' || field === 'grossWtKg') {
    const totalNet = rows.reduce((sum, r) => sum + toNum(r.netWtKg), 0);
    const totalGross = rows.reduce((sum, r) => sum + toNum(r.grossWtKg), 0);

    if (totalNet > 0) {
      next.packingList.totalNetWtKg = totalNet;
      next.billOfLading.totalNetWtKg = totalNet;
      next.certificateOfOrigin.netWeightKg = totalNet;
    }
    if (totalGross > 0) {
      next.packingList.totalGrossWtKg = totalGross;
      next.billOfLading.totalGrossWtKg = totalGross;
      next.certificateOfOrigin.grossWeightKg = totalGross;
    }
  }

  return next;
}

/**
 * Synchronizes individual beneficiary certificate field updates
 */
export function syncBeneficiaryCert(
  currentDocs: FinalDocumentSet,
  certId: string,
  field: string,
  value: any
): FinalDocumentSet {
  // If editing a shared field in a certificate, route through master field synchronizer
  const sharedFields = [
    'invoiceNo',
    'lcNumber',
    'lcDate',
    'insuranceCoverNote',
    'insuranceCoverNoteDate',
    'applicantDetails',
    'applicantBin',
    'goodsNarration'
  ];

  if (sharedFields.includes(field)) {
    return syncDocumentField(currentDocs, 'bencert', field, value);
  }

  const next = cloneDocSet(currentDocs);
  next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => {
    if (c.id === certId) {
      return { ...c, [field]: value };
    }
    return c;
  });

  return next;
}

/**
 * Synchronizes beneficiary certificate shipment particulars
 */
export function syncBeneficiaryCertShipmentParticulars(
  currentDocs: FinalDocumentSet,
  certId: string,
  field: string,
  value: any
): FinalDocumentSet {
  // Route shared shipment particulars (vessel, portOfLoading, portOfDischarge, containerNo, blNo, quantity, invoiceAmount)
  const fieldMapping: Record<string, string> = {
    vessel: 'vesselFlightNo',
    portOfLoading: 'portOfLoading',
    portOfDischarge: 'portOfDischarge',
    containerNo: 'containerNo',
    blNo: 'blAirBillRef',
    quantity: 'totalQuantity',
    invoiceAmount: 'totalAmount'
  };

  const targetSharedField = fieldMapping[field];
  if (targetSharedField) {
    return syncDocumentField(currentDocs, 'bencert', targetSharedField, value);
  }

  const next = cloneDocSet(currentDocs);
  next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => {
    if (c.id === certId && c.shipmentParticulars) {
      return {
        ...c,
        shipmentParticulars: {
          ...c.shipmentParticulars,
          [field]: value
        }
      };
    }
    return c;
  });

  return next;
}

/**
 * Synchronizes email details in beneficiary certificates
 */
export function syncBeneficiaryCertEmailDetails(
  currentDocs: FinalDocumentSet,
  certId: string,
  field: string,
  value: any
): FinalDocumentSet {
  const next = cloneDocSet(currentDocs);
  next.beneficiaryCertificates = next.beneficiaryCertificates.map(c => {
    if (c.id === certId && c.emailDetails) {
      return {
        ...c,
        emailDetails: {
          ...c.emailDetails,
          [field]: value
        }
      };
    }
    return c;
  });

  return next;
}
