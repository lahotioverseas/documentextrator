import {
  SaleContractData,
  ExportData,
  LCDetails,
  LCAmendment,
  Discrepancy,
  FinalDocumentSet,
  ComplianceChecklist,
  BankProfile
} from '../types';

export const sampleBankProfiles: BankProfile[] = [
  // Negotiating banks as printed on Lahoti's documents (sale contract bank details / bill of exchange)
  {
    id: 'scb-in',
    bankName: 'STANDARD CHARTERED BANK',
    branch: 'BRANCH CODE: 225, 23-25 M.G.ROAD, OPP. VSNL',
    city: 'MUMBAI - 400 001 INDIA',
    swift: 'SCBLINBB'
  },
  {
    id: 'dbs-in',
    bankName: 'DBS BANK INDIA LTD',
    branch: 'GROUND FLOOR, EXPRESS TOWERS, NARIMAN POINT',
    city: 'MUMBAI - 400021, INDIA',
    swift: 'DBSSINBB',
    accountNo: '811210000268'
  }
];

export const sampleContractWeber: SaleContractData = {
  contractNo: 'S/0467/25-26',
  contractDate: '24-02-2026',
  exporter: {
    name: 'LAHOTI OVERSEAS LIMITED',
    address: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI CENTRAL, MUMBAI - 400 034, MAHARASHTRA, INDIA',
    tel: '+91-22-40500100',
    fax: '+91-22-40500150',
    email: 'ujwal@lahotioverseas.com',
    web: 'www.lahotioverseas.com',
    cin: 'U65999DL2018FLC329236',
    rexNo: 'INREX12345678W'
  },
  buyer: {
    name: 'WEBER & HEUSSER GmbH & Co KG',
    address: 'Lauterbachstr. 19, D-72459 Albstadt-Lautlingen, Germany',
    country: 'GERMANY',
    contactPerson: 'Herr Weber'
  },
  orderCurrency: 'USD',
  shipmentValidity: '10-04-2026',
  refCorrespondence: 'SAURABH LAHOTI',
  items: [
    {
      itemNo: 1,
      description: 'Ne 16/1 100 percent cotton carded compact yarn on cone unwax for weaving with 630 TPM, 625 CN TEX Ravali Brand',
      specification: 'Ne 16/1 KW COMPACT YARN ON CONES FOR WEAVING',
      composition: '100% COTTON CARDED COMPACT',
      yarnDetails: 'OE X KW, 630 TPM, 625 CN TEX',
      quantity: 1680.00,
      uom: 'KG',
      unitPrice: 2.85,
      netValue: 4788.00
    }
  ],
  totalValue: 4788.00,
  totalValueWords: 'US DOLLARS FOUR THOUSAND SEVEN HUNDRED EIGHTY EIGHT ONLY',
  tolerance: '10%(+/-) ALLOWED',
  fclCount: '1 LCL (1,680.00 KGS in 37 CARTONS on Pine Pallets)',
  insurance: "BUYER'S ACCOUNT (CFR TERMS)",
  paymentTerms: 'BY IRREVOCABLE LC 90 DAYS FROM BL DATE AT USANCE',
  deliveryTerms: 'CFR HAMBURG, GERMANY',
  portOfLoading: 'GTI (JNPT) / ANY INDIAN PORT',
  portOfDelivery: 'HAMBURG, GERMANY',
  shipmentMode: 'SEA',
  packingType: '37 CARTONS ON PINE PALLET PACKING WITH COUNT AND LOT NUMBER',
  transhipment: 'ALLOWED',
  partialShipment: 'NOT ALLOWED',
  bankDetails: {
    payTo: 'DBS BANK INDIA LTD',
    swift: 'DBSSINBB',
    bankAddress: 'GROUND FLOOR, EXPRESS TOWERS, NARIMAN POINT, MUMBAI - 400021, INDIA',
    beneficiary: 'LAHOTI OVERSEAS LIMITED',
    beneficiaryAccNo: '811210000268',
    intermediaryBank: 'JPMORGAN CHASE BANK N.A.',
    intermediarySwift: 'CHASUS33'
  },
  documentRequirements: [
    'Signed Commercial Invoice in triplicate with contract reference declaration',
    'Detailed Packing List 3-fold evidencing pine pallet packing and neutral cone declaration',
    'Certificate of Origin issued by authorized Chamber of Commerce',
    'Full set Clean On Board Marine Bills of Lading made out to order',
    "Direct courier receipt of original COO to Weber u. Heusser within 7 working days of B/L",
    "Shipping advice by email within 5 working days of B/L date",
    'Uster Protocol technical specification',
    'Fumigation Certificate / ISPM #15'
  ],
  termsAndConditions: [
    'Applicable Law: English Law & Practices and Lahoti standard sales conditions',
    'Claims must be lodged within 7 days of arrival with certified test proof',
    'Interest @ 18% p.a. applicable on overdue payments'
  ],
  fieldSources: {
    contractNo: { source: 'Contract Header, Page 1', confidence: 'high', excerpt: 'Order No: S/0467/25-26' },
    totalValue: { source: 'Items Table, Page 1', confidence: 'high', excerpt: 'Net Values: 4,788.00 USD' },
    buyer: { source: 'Buyer Block, Page 1', confidence: 'high', excerpt: 'WEBER & HEUSSER GmbH & Co KG' },
    deliveryTerms: { source: 'Terms Section, Page 1', confidence: 'high', excerpt: 'CFR HAMBURG, GERMANY' }
  }
};

export const sampleContractSanjana: SaleContractData = {
  contractNo: 'S/0403/25-26',
  contractDate: '14-01-2026',
  exporter: {
    name: 'LAHOTI OVERSEAS LTD.',
    address: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI CENTRAL, MUMBAI. MAHARASHTRA - 400034. INDIA.',
    tel: '91-22-40500100',
    fax: '91-22-40500150',
    email: 'ujwal@lahotioverseas.com',
    web: 'www.lahotioverseas.com',
    cin: 'U65999DL2018FLC329236'
  },
  buyer: {
    name: 'SANJANA FABRICS LTD',
    address: 'MAHANA, DUPTARA, RUPGONJ, NARAYANGONJ, BANGLADESH.',
    country: 'BANGLADESH'
  },
  orderCurrency: 'USD',
  shipmentValidity: 'END APRIL 2026',
  refCorrespondence: 'SAURABH LAHOTI',
  items: [
    {
      itemNo: 1,
      description: '20OE X 20KW+70D 114X56 73" 2/2 "S" TWILL 100% COTTON FEBRIC, COMPOSITION : 98% COTTON+2% SPANDEX, YARN: OE X KW, SELVEDGE LENO: 24 M',
      specification: '100% COTTON FEBRIC, 98% COTTON+2% SPANDEX',
      composition: '98% COTTON + 2% SPANDEX',
      yarnDetails: 'OE X KW',
      quantity: 465635.00,
      uom: 'YARD',
      unitPrice: 1.010,
      netValue: 470291.35
    }
  ],
  totalValue: 470291.35,
  totalValueWords: 'US DOLLAR FOUR HUNDRED SEVENTY THOUSAND TWO HUNDRED NINETY ONE AND THIRTY FIVE CENTS ONLY',
  tolerance: '5%(+/-) ALLOWED',
  fclCount: '465,635 YARD ( 11 FCL X 40 HQ Ft. )',
  insurance: "INSURANCE TO SELLER'S ACCOUNT",
  paymentTerms: 'BY IRREVOCABLE, UNRESTRICTED, LC 90 DAYS FROM BL DATE',
  deliveryTerms: 'CPT BENAPOLE',
  portOfLoading: 'ANY INDIAN PORT',
  portOfDelivery: 'CPT BENAPOLE',
  shipmentMode: 'SEA',
  packingType: 'PACKING IN ROLLS',
  transhipment: 'ALLOWED',
  partialShipment: 'ALLOWED',
  bankDetails: {
    payTo: 'DBS BANK INDIA LTD',
    swift: 'DBSSINBB',
    bankAddress: 'GROUND FLOOR, EXPRESS TOWERS, NARIMAN POINT, MUMBAI - 400021, INDIA',
    beneficiary: 'LAHOTI OVERSEAS LIMITED',
    beneficiaryAccNo: '811210000268',
    intermediaryBank: 'JPMORGAN CHASE BANK N.A.',
    intermediarySwift: 'CHASUS33'
  },
  documentRequirements: [
    '21 days for negotiation from BL date',
    'LC should be available with any bank in India',
    'Third party documents are acceptable',
    "All bank charges outside India, LC Amendment charges & Reimbursement charges will be to Buyer's account"
  ],
  termsAndConditions: [
    'Applicable Law: This Sales Order is subject to English Law & Practices and general terms of Lahoti Overseas Ltd',
    'Interest @ 18%p.a shall be applicable for invoices paid/unpaid beyond due date'
  ],
  fieldSources: {
    contractNo: { source: 'Page 1, Header', confidence: 'high', excerpt: 'Order No S/0403/25-26' },
    totalValue: { source: 'Page 1, Items Table', confidence: 'high', excerpt: '470,291.35 USD' },
    tolerance: { source: 'Page 1, Specs', confidence: 'high', excerpt: 'TOLERANCE 5%(+/-) ALLOWED' }
  }
};

export const sampleExportDraftWeber: ExportData = {
  exporter: {
    name: 'LAHOTI OVERSEAS LIMITED',
    address: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI - 400 034 INDIA',
    tel: '91-22-40500100',
    email: 'ujwal@lahotioverseas.com',
    cin: 'U65999DL2018FLC329236',
    rexNo: 'INREX12345678W'
  },
  invoiceNo: 'LOL/0085/26-27',
  invoiceDate: '14-05-2026',
  exporterRef: 'EXP-LOL-2026-85',
  buyersOrderNo: 'S/0467/25-26',
  buyersOrderDate: '24-02-2026',
  otherReference: 'LR NO. & DATE: PENDING',
  consignee: 'TO ORDER',
  buyerIfOtherThanConsignee: 'WEBER & HEUSSER GmbH & Co KG\nD-72459 Albstadt-Lautlingen\nGermany',
  countryOfOrigin: 'INDIAN ORIGIN',
  countryOfFinalDestination: 'GERMANY',
  preCarriageBy: 'BY TRUCK',
  placeOfReceiptByPreCarrier: 'DAMODAR MILLS, GUJARAT',
  vesselFlightNo: 'MSC CLAUDIA V.2604W',
  portOfLoading: 'GTI (JNPT, MUMBAI)',
  portOfDischarge: 'HAMBURG, GERMANY',
  finalDestination: 'HAMBURG, GERMANY',
  termsOfDeliveryAndPayment: 'CFR HAMBURG, GERMANY\nLC NO. LBW26IA100122-PP DT. 11.03.2026\nAT 90 DAYS FROM BL DATE',
  lineItems: [
    {
      marksAndNos: 'NE 16/1 KW COMPACT\nCARTON NOS : 1 - 37\nMFG.: DAMODAR INDUSTRIES LIMITED',
      noAndKindOfPkg: '37 CARTONS ON PINE PALLETS',
      description: '100 PERCENT COTTON CARDED COMPACT YARN ON CONES FOR WEAVING NE 16/1 KW COMPACT (RAVALI BRAND)',
      quantity: 1678.32,
      uom: 'KGS',
      rate: 2.85,
      amount: 4783.21
    }
  ],
  packingRows: [
    {
      lotNo: 'LOT-9921',
      count: 'Ne 16/1 KW',
      noOfUnits: '37 CARTONS',
      containerSealNo: 'TGHU9283710 / SE-90124',
      netWtKg: 1678.32,
      grossWtKg: 1772.30,
      dimensions: '120 x 80 x 140 cm (Pine Palletized)'
    }
  ],
  totalQuantity: 1678.32,
  totalNetWtKg: 1678.32,
  totalGrossWtKg: 1772.30,
  totalAmount: 4783.21,
  currency: 'USD',
  amountInWords: 'US DOLLARS FOUR THOUSAND SEVEN HUNDRED EIGHTY THREE AND CENTS TWENTY ONE ONLY',
  declarationText: "We declare that this invoice shows the actual price of the goods\ndescribed and that all paraticulars are true and correct.",
  rexNumber: 'INREX12345678W',
  lcNumberReference: 'LBW26IA100122',
  lcDateReference: '11-03-2026'
};

export const sampleExportDraftSanjana: ExportData = {
  exporter: {
    name: 'LAHOTI OVERSEAS LTD.',
    address: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI CENTRAL, MUMBAI. MAHARASHTRA - 400034. INDIA.',
    tel: '91-22-40500100',
    email: 'ujwal@lahotioverseas.com',
    cin: 'U65999DL2018FLC329236'
  },
  invoiceNo: 'LOL/0042/26-27',
  invoiceDate: '15-02-2026',
  exporterRef: 'EXP-SANJANA-0403',
  buyersOrderNo: 'S/0403/25-26',
  buyersOrderDate: '14-01-2026',
  otherReference: 'LR NO. & DATE: PENDING',
  consignee: 'TO ORDER OF APPLICANT BANK',
  buyerIfOtherThanConsignee: 'SANJANA FABRICS LTD\nMAHANA, DUPTARA, RUPGONJ, NARAYANGONJ, BANGLADESH.',
  countryOfOrigin: 'INDIAN ORIGIN',
  countryOfFinalDestination: 'BANGLADESH',
  preCarriageBy: 'BY ROAD TRUCK',
  placeOfReceiptByPreCarrier: 'SURAT MILL WAREHOUSE',
  vesselFlightNo: 'LAND PORT TRUCK CONVOY',
  portOfLoading: 'PETRAPOLE / ANY INDIAN PORT',
  portOfDischarge: 'BENAPOLE, BANGLADESH',
  finalDestination: 'BENAPOLE, BANGLADESH',
  termsOfDeliveryAndPayment: 'CPT BENAPOLE\nBY IRREVOCABLE LC 90 DAYS FROM BL DATE',
  lineItems: [
    {
      marksAndNos: 'SANJANA FABRICS / BENAPOLE\nROLL NOS: 1-11500',
      noAndKindOfPkg: '11 FCL X 40 HQ CONTAINERS (ROLLS)',
      description: '20OE X 20KW+70D 114X56 73" 2/2 "S" TWILL 100% COTTON FEBRIC, COMPOSITION : 98% COTTON+2% SPANDEX',
      quantity: 465635.00,
      uom: 'YARDS',
      rate: 1.010,
      amount: 470291.35
    }
  ],
  packingRows: [
    {
      lotNo: 'LOT-TWILL-01',
      count: '20OE X 20KW+70D',
      noOfUnits: '11 FCL CONTAINERS',
      containerSealNo: 'MSCU981273 / SE-99120',
      netWtKg: 116408.75,
      grossWtKg: 121000.00,
      dimensions: '11 x 40 HQ FCL'
    }
  ],
  totalQuantity: 465635.00,
  totalNetWtKg: 116408.75,
  totalGrossWtKg: 121000.00,
  totalAmount: 470291.35,
  currency: 'USD',
  amountInWords: 'US DOLLAR FOUR HUNDRED SEVENTY THOUSAND TWO HUNDRED NINETY ONE AND THIRTY FIVE CENTS ONLY',
  declarationText: "We declare that this invoice shows the actual price of the goods\ndescribed and that all paraticulars are true and correct.",
  rexNumber: 'INREX12345678W'
};

export const sampleLCWeber: LCDetails = {
  lcNumber: 'LBW26IA100122',
  issueDate: '2026-03-11',
  advisingBankRef: '811-11-0177584',
  advisingBank: {
    name: 'DBS BANK INDIA LIMITED',
    branch: 'Express Towers, Nariman Point, Mumbai',
    swift: 'DBSSINBBXXX',
    address: 'Mumbai, India'
  },
  issuingBank: {
    name: 'LANDESBANK BADEN-WUERTTEMBERG',
    swift: 'SOLADESTSXXX',
    city: 'STUTTGART',
    country: 'GERMANY'
  },
  formOfCredit: 'IRREVOCABLE TRANSFERABLE',
  applicableRules: 'UCP LATEST VERSION',
  expiryDate: '2026-04-25',
  expiryPlace: 'India',
  applicant: {
    name: 'Weber u. Heusser GmbH u. Co. KG',
    address: 'Lauterbachstr. 19, 72459 ALBSTADT/GERMANY',
    country: 'GERMANY'
  },
  beneficiary: {
    name: 'Lahoti Overseas Limited',
    address: '307 Arun Chambers, Tardeo Road, Mumbai Central, Mumbai, Maharashtra, 400034, INDIA'
  },
  currency: 'USD',
  amount: 4788.00,
  tolerancePercentage: {
    positive: 10,
    negative: 10
  },
  availableWith: 'Any Bank in India',
  availableBy: 'BY NEGOTIATION',
  tenor: '90 days after B/L date',
  partialShipment: 'NOT ALLOWED',
  transhipment: 'ALLOWED',
  portOfLoading: 'Any Port in India',
  portOfDischarge: 'Hamburg in Germany',
  latestShipmentDate: '2026-04-10',
  goodsDescriptionVerbatim: '100 percent cotton carded compact yarn on cone unwax for weaving with 630 TPM, 625 CN TEX Ravali Brand CFR Hamburg, Germany',
  contractReference: 'S/0467/25-26',
  presentationPeriodDays: 15,
  confirmationInstructions: 'WITHOUT',
  field46AClauses: [
    {
      id: '46A.1',
      field: '46A',
      clauseNumber: 1,
      verbatimText: "Signed commercial invoice in triplicate, including seller's declaration that the invoices and shipped goods are in accordance with sales contract S/0467/25-26 dd. 24.02.2026.",
      plainEnglishSummary: "Provide 3 signed commercial invoices with exact seller's declaration citing sales contract S/0467/25-26 dated 24.02.2026.",
      type: 'bake_in_instruction',
      affectedDocuments: ['invoice'],
      targetField: 'invoice.declarationText',
      instructionDetail: "Insert: 'The seller hereby declares that this invoice and the shipped goods are in strict accordance with sales contract S/0467/25-26 dd. 24.02.2026.'"
    },
    {
      id: '46A.2',
      field: '46A',
      clauseNumber: 2,
      verbatimText: "Detailed packing list 3-fold, evidencing contents of each pallet or package and also evidencing that goods have to be shipped in pine pallet packing. Packing list must evidence that: /quote/ shipper declared: all goods are shipped with container LCL/LCL in neutral sea-worthy packing and on neutral cones but every pallet is clearly marked with count and lot number. /unquote/",
      plainEnglishSummary: "Packing list (3 copies) must state pine pallet packing and include the exact quoted shipper declaration regarding LCL/LCL neutral cones.",
      type: 'bake_in_instruction',
      affectedDocuments: ['packing_list'],
      targetField: 'packing_list.specialDeclaration',
      instructionDetail: "Must include exact text: 'shipper declared: all goods are shipped with container LCL/LCL in neutral sea-worthy packing and on neutral cones but every pallet is clearly marked with count and lot number.'"
    },
    {
      id: '46A.3',
      field: '46A',
      clauseNumber: 3,
      verbatimText: "Copy of Certificate of Origin issued by a responsible authority, country of origin: India.",
      plainEnglishSummary: "Chamber-issued Certificate of Origin copy specifying India as country of origin.",
      type: 'bake_in_instruction',
      affectedDocuments: ['certificate_of_origin'],
      targetField: 'coo.countryOfOrigin'
    },
    {
      id: '46A.4',
      field: '46A',
      clauseNumber: 4,
      verbatimText: "Full set of clean on board marine bills of lading, evidencing shipment in container on LCL basis, made out to order, blank endorsed, marked: freight prepaid, notify: a) Weber u. Heusser GmbH u. Co. KG, Lauterbachstr. 19, 72459 Albstadt /Germany b) Sterac Transport + Logistik GmbH, Waldweg 1-3, D-22145 Braak.",
      plainEnglishSummary: "Bill of Lading instructions must specify clean on board, LCL basis, TO ORDER, blank endorsed, freight prepaid, and notify both Weber u. Heusser and Sterac Transport.",
      type: 'bake_in_instruction',
      affectedDocuments: ['bill_of_lading'],
      targetField: 'bol.consigneeAndNotify'
    },
    {
      id: '46A.5',
      field: '46A',
      clauseNumber: 5,
      verbatimText: "Seller's Confirmation that original Certificate of Origin have been sent directly to Weber u. Heusser GmbH u. Co. KG, Lauterbachstr. 19, 72459 Albstadt/GERMANY by courier within seven (7) working days after B/L issuing date at the very latest. Copy of courier receipt required, showing picked up date.",
      plainEnglishSummary: "Beneficiary certificate confirming original COO sent directly to buyer by courier within 7 working days of B/L date + attach courier receipt copy.",
      type: 'bake_in_instruction',
      affectedDocuments: ['beneficiary_certificate'],
      targetField: 'beneficiary_cert.courierConfirmation'
    },
    {
      id: '46A.6',
      field: '46A',
      clauseNumber: 6,
      verbatimText: "Copy of beneficiary's shipping advice sent by mail to applicant (rd@weberheusser-yarns.com) within 5 working days after B/L issuing date at the very latest, evidencing the exact shipping details, such as ETD in India, description of goods, B/L no., B/L date, number of packages or number(s) of container(s).",
      plainEnglishSummary: "Send shipping advice email to rd@weberheusser-yarns.com within 5 working days of B/L and provide copy in document presentation.",
      type: 'bake_in_instruction',
      affectedDocuments: ['beneficiary_certificate'],
      targetField: 'beneficiary_cert.shippingAdvice'
    },
    {
      id: '46A.7',
      field: '46A',
      clauseNumber: 7,
      verbatimText: "Uster protocol (technical specification) for the ordered yarn.",
      plainEnglishSummary: "Provide yarn laboratory Uster protocol technical testing sheet matching Ne 16/1 specifications.",
      type: 'bake_in_instruction',
      affectedDocuments: ['beneficiary_certificate'],
      targetField: 'beneficiary_cert.usterProtocol'
    },
    {
      id: '46A.8',
      field: '46A',
      clauseNumber: 8,
      verbatimText: "Fumigation Certificate or Certificate of ISPM # 15 (Original or Copy).",
      plainEnglishSummary: "Provide Fumigation / ISPM #15 treatment certificate for pine pallets.",
      type: 'compliance_rule',
      affectedDocuments: ['packing_list'],
      targetField: 'packing_list.fumigationNote'
    }
  ],
  field47AClauses: [
    {
      id: '47A.1',
      field: '47A',
      clauseNumber: 1,
      verbatimText: "+ 10 percent more or less in quantity per lot and amount allowed.",
      plainEnglishSummary: "Quantity and amount tolerance of +/- 10% allowed across line items.",
      type: 'compliance_rule',
      affectedDocuments: ['invoice', 'packing_list'],
      targetField: 'reconciliation.tolerance'
    },
    {
      id: '47A.2',
      field: '47A',
      clauseNumber: 2,
      verbatimText: "+ Sales Contract No. and L/C no. must be mentioned in the bills of lading as per applicant's requirement.",
      plainEnglishSummary: "Bill of Lading MUST explicitly show Sales Contract No. S/0467/25-26 and L/C No. LBW26IA100122.",
      type: 'bake_in_instruction',
      affectedDocuments: ['bill_of_lading'],
      targetField: 'bol.specialClauses'
    },
    {
      id: '47A.3',
      field: '47A',
      clauseNumber: 3,
      verbatimText: "+ Commercial invoice must show REX registration number.",
      plainEnglishSummary: "Commercial Invoice must print exporter's registered REX Number (INREX...).",
      type: 'bake_in_instruction',
      affectedDocuments: ['invoice'],
      targetField: 'invoice.rexNumber'
    },
    {
      id: '47A.4',
      field: '47A',
      clauseNumber: 4,
      verbatimText: "+ All documents must be issued in English language, except pre-printed forms and stamps.",
      plainEnglishSummary: "All presented documents must be in English language.",
      type: 'compliance_rule',
      affectedDocuments: ['all'],
      targetField: 'compliance.language'
    },
    {
      id: '47A.5',
      field: '47A',
      clauseNumber: 5,
      verbatimText: "+ Transferring bank is advising bank. Transferring bank must inform opening bank by all means. In absence of such notification we understand that no transfer has been effected and we will honour creditconform documents by any presenting bank, without notification to nominated transferring bank.",
      plainEnglishSummary: "Advising bank handles transfer notification obligations.",
      type: 'compliance_rule',
      affectedDocuments: ['all'],
      targetField: 'bank.transferTerms'
    },
    {
      id: '47A.6',
      field: '47A',
      clauseNumber: 6,
      verbatimText: "+ We are only obliged to pay under this l/c upon receipt of credit complying documents at our counters. UCP600 Art.7a, 7c will not apply, should we the issuing bank, not receive l/c conform documents at our counters for any reason e.g. if they are mislaid or lost in transit. After 10 banking days of the expiry date, we are under no obligation to pay this l/c, notwithstanding the fact that the l/c is available by negotiation with any bank in India. Documents need to be presented to us via a bank.",
      plainEnglishSummary: "Issuing bank disclaimer on transit loss: Documents must reach counter safely within 10 banking days of expiry.",
      type: 'compliance_rule',
      affectedDocuments: ['all'],
      targetField: 'bank.transitRisk'
    },
    {
      id: '47A.7',
      field: '47A',
      clauseNumber: 7,
      verbatimText: "+ Documents with discrepancies will be rejected. However, notwithstanding any prior notice of rejection by us, we reserve the right to accept a waiver of discrepancies from the applicant and subject to our concurrence with such waiver, we reserve the right to release documents against such waiver without notice to the presenter, provided that no written instructions to the contrary have been received by us from the presenter before such release. A fee of EUR 150,00 or equivalent plus additional charges will be deducted for each set of discrepant documents.",
      plainEnglishSummary: "Discrepancy rejection policy and waiver terms. Discrepancy deduction fee is EUR 150,00.",
      type: 'compliance_rule',
      affectedDocuments: ['all'],
      targetField: 'compliance.discrepancyFee'
    },
    {
      id: '47A.8',
      field: '47A',
      clauseNumber: 8,
      verbatimText: "+ All documents arriving at our counter after 2.30 p.m. on a banking day, the date of receipt will be considered as on the next banking day.",
      plainEnglishSummary: "Cut-off time for document receipt is 2:30 PM on a banking day.",
      type: 'compliance_rule',
      affectedDocuments: ['all'],
      targetField: 'compliance.bankingCutoff'
    },
    {
      id: '47A.9',
      field: '47A',
      clauseNumber: 9,
      verbatimText: "+ Where multiple presentations of documents are made on the same day, individual schedules must be created in order to avoid any delay in situations where some presentations comply and others do not. Where more than one complete presentation of documents is made under one cover letter or schedule for the full amount of all presentations, we will consider each complete presentation of documents to be independent of any other.",
      plainEnglishSummary: "Multiple presentations on same day must have individual schedules.",
      type: 'compliance_rule',
      affectedDocuments: ['all'],
      targetField: 'compliance.multiplePresentations'
    }
  ]
};

export const sampleDiscrepanciesWeber: Discrepancy[] = [
  {
    id: 'disc-1',
    field: 'Description of Goods (Field 45A)',
    severity: 'info',
    title: 'Goods Description Matches Verbatim with Contract Citation',
    contractValue: 'Ne 16/1 100 percent cotton carded compact yarn on cone unwax for weaving with 630 TPM, 625 CN TEX Ravali Brand (S/0467/25-26)',
    lcValue: 'Pos. 1 Sales contract No. S/0467/25-26 Specification: Ne 16/1 100 percent cotton carded compact yarn on cone unwax for weaving with 630 TPM, 625 CN TEX Ravali Brand Quantity in kg: 1.680,00 Price/kg in USD: 2,85 total Amount in USD: 4.788,00 CFR Hamburg, Germany',
    explanation: 'LC verbatim description exactly includes the sales contract reference and unit pricing conforming to UCP 600 Art 18c.',
    suggestedAction: 'Ensure all invoice line items reproduce the exact LC 45A text verbatim.'
  },
  {
    id: 'disc-2',
    field: 'Presentation Period (Field 48)',
    severity: 'review',
    title: 'Presentation Window is 15 Days (Shorter than standard 21 days)',
    contractValue: 'Standard 21 Days from B/L date',
    lcValue: '15 Days after B/L date',
    explanation: 'LC limits document presentation to 15 calendar days from B/L date instead of 21 days. Request MT707 amendment or ensure prompt 10-day courier dispatch.',
    suggestedAction: 'Apply MT707 Amendment #001 to extend presentation period to 21 days.'
  },
  {
    id: 'disc-3',
    field: 'Partial Shipment (Field 43P)',
    severity: 'info',
    title: 'Partial Shipment Not Allowed (Consistent with 1-lot LCL order)',
    contractValue: 'NOT ALLOWED',
    lcValue: 'NOT ALLOWED',
    explanation: 'Entire quantity of 1,680 KGS must be loaded in a single shipment under one Bill of Lading.',
    suggestedAction: 'Consolidate 37 cartons onto a single ocean bill of lading.'
  },
  {
    id: 'disc-4',
    field: 'Discrepancy Fee (Field 47A.8)',
    severity: 'info',
    title: 'Issuing Bank Discrepancy Penalty: EUR 150.00',
    contractValue: 'Standard Banking',
    lcValue: 'EUR 150,00 deducted for each set of discrepant documents',
    explanation: 'Landesbank Baden-Wuerttemberg will penalize non-conforming documents EUR 150.00.',
    suggestedAction: 'Auto-bake all 46A and 47A clauses in Stage 4 to achieve zero discrepancies.'
  }
];

export const sampleAmendment01: LCAmendment = {
  id: 'AMD-001',
  amendmentNo: '001',
  amendmentDate: '2026-03-25',
  narrative: 'SWIFT MT707 Amendment to Documentary Credit LBW26IA100122: Presentation period extended to 21 days; Expiry date extended to 15 May 2026.',
  changes: [
    {
      field: '31D (Expiry Date)',
      oldValue: '260425 (25 April 2026)',
      newValue: '260515 (15 May 2026)',
      impact: 'Extended expiry date by 20 calendar days in India'
    },
    {
      field: '48 (Period for Presentation)',
      oldValue: '15 Days after B/L date',
      newValue: '21 Days after B/L date',
      impact: 'Presentation period relaxed to standard 21 days from B/L issuing date'
    }
  ],
  appliedAt: '2026-03-25T14:30:00Z'
};

export const sampleFinalDocsWeber: FinalDocumentSet = {
  commercialInvoice: {
    exporter: sampleContractWeber.exporter,
    invoiceNo: 'LOL/0467/26-27',
    invoiceDate: '14-05-2026',
    consignee: 'TO ORDER OF\nLANDESBANK BADEN-WUERTTEMBERG\nAM VICTORIA-TURM 2\n68163 MANNHEIM, GERMANY',
    buyersOrderNo: 'S/0467/25-26',
    buyersOrderDate: '24-02-2026',
    lcReference: 'LBW26IA100122 DD. 11.03.2026',
    termsOfDelivery: 'CFR HAMBURG, GERMANY (AT 90 DAYS FROM B/L DATE UNDER LC)',
    countryOfOrigin: 'INDIA',
    countryOfFinalDestination: 'GERMANY',
    portOfLoading: 'GTI (JNPT, MUMBAI), INDIA',
    portOfDischarge: 'HAMBURG, GERMANY',
    finalDestination: 'HAMBURG, GERMANY',
    currency: 'USD',
    lineItems: [
      {
        marksAndNos: 'NE 16/1 KW COMPACT\nCARTON NOS : 1 - 37\nTOTAL GROSS WT : 1,772.30 KGS\nTOTAL NET WT : 1,678.32 KGS\nCONTAINER NO/SEAL NO : TGHU9283710 / SE-90124\nMFG.: DAMODAR INDUSTRIES LIMITED',
        noAndKindOfPkg: '37 CARTONS ON PINE PALLETS',
        description: 'Pos. 1 Sales contract No. S/0467/25-26 Specification: Ne 16/1 100 percent cotton carded compact yarn on cone unwax for weaving with 630 TPM, 625 CN TEX Ravali Brand Quantity in kg: 1.680,00 Price/kg in USD: 2,85 total Amount in USD: 4.788,00 CFR Hamburg, Germany',
        quantity: 1678.32,
        uom: 'KGS',
        rate: 2.85,
        amount: 4783.21
      }
    ],
    totalQuantity: 1678.32,
    totalAmount: 4783.21,
    amountInWords: 'US DOLLARS FOUR THOUSAND SEVEN HUNDRED EIGHTY THREE AND CENTS TWENTY ONE ONLY',
    declarationText: "We declare that this invoice shows the actual price of the goods\ndescribed and that all paraticulars are true and correct.",
    showExchangeRate: false,
    additionalDeclarations: [
      {
        clauseRef: '47A.3',
        text: 'Registered Exporter (REX) System No: INREX12345678W'
      }
    ],
    rexNumber: 'INREX12345678W'
  },
  packingList: {
    exporter: sampleContractWeber.exporter,
    invoiceNo: 'LOL/0467/26-27',
    invoiceDate: '14-05-2026',
    bakedPalletQuote: 'shipper declared: all goods are shipped with container LCL/LCL in neutral sea-worthy packing and on neutral cones but every pallet is clearly marked with count and lot number.',
    packingRows: [
      {
        lotNo: 'LOT-9921',
        count: 'Ne 16/1 KW COMPACT',
        noOfUnits: '37 CARTONS',
        containerSealNo: 'TGHU9283710 / SE-90124',
        netWtKg: 1678.32,
        grossWtKg: 1772.30,
        dimensions: '120 x 80 x 140 cm (Pine Pallets)'
      }
    ],
    totalNetWtKg: 1678.32,
    totalGrossWtKg: 1772.30
  },
  billOfLading: {
    exporter: sampleContractWeber.exporter,
    shipper: sampleContractWeber.exporter,
    invoiceNo: 'LOL/0467/26-27',
    invoiceDate: '14-05-2026',
    consignee: 'TO ORDER OF\nLANDESBANK BADEN-WUERTTEMBERG\nAM VICTORIA-TURM 2\n68163 MANNHEIM, GERMANY',
    notifyParty1: 'Weber u. Heusser GmbH u. Co. KG\nLauterbachstr. 19, 72459 ALBSTADT / Germany\nEmail: rd@weberheusser-yarns.com',
    notifyParty2: 'Sterac Transport + Logistik GmbH\nWaldweg 1-3, D-22145 Braak, Germany',
    portOfLoading: 'GTI (JNPT, MUMBAI), INDIA',
    portOfDischarge: 'HAMBURG, GERMANY',
    finalDestination: 'HAMBURG, GERMANY',
    marksAndNos: 'CARTON NOS: 1 - 37\nCONTAINER NO/SEAL NO: TGHU9283710 / SE-90124',
    packagesCountAndKind: '37 CARTONS ON PINE PALLETS',
    goodsDescription: '100 PERCENT COTTON CARDED COMPACT YARN ON CONES FOR WEAVING NE 16/1 KW COMPACT (37 CARTONS ON PINE PALLETS)\nSales Contract No. S/0467/25-26 and L/C no. LBW26IA100122 mentioned as per applicant requirement.',
    totalGrossWtKg: 1772.30,
    totalNetWtKg: 1678.32,
    freightStatus: 'FREIGHT PREPAID',
    cleanOnBoardClause: true
  },
  certificateOfOrigin: {
    exporter: sampleContractWeber.exporter,
    invoiceNo: 'LOL/0467/26-27',
    invoiceDate: '14-05-2026',
    consignee: 'TO ORDER (FOR ACCOUNT OF WEBER & HEUSSER GmbH & Co KG, GERMANY)',
    countryOfOrigin: 'INDIA',
    issuingAuthority: 'THE COTTON TEXTILES EXPORT PROMOTION COUNCIL (TEXPROCIL), MUMBAI',
    originDeclaration: 'We hereby declare that the goods described above are of 100% Indian origin and manufactured in India in accordance with applicable rules of origin.',
    goodsDescription: '100% COTTON CARDED COMPACT YARN ON CONES NE 16/1 KW COMPACT (37 CARTONS ON PINE PALLETS) - 1,678.320 KGS',
    marksAndNos: 'LOL/0467/26-27',
    quantityWithUom: '1,678.320 KGS',
    grossWeightKg: 1772.30,
    netWeightKg: 1678.32,
    portOfLoading: 'GTI (JNPT, MUMBAI), INDIA',
    portOfDischarge: 'HAMBURG, GERMANY',
    placeAndDateOfIssue: 'MUMBAI, DATE: 14-05-2026'
  },
  billOfExchange: {
    currency: 'USD',
    amount: 4783.21,
    invoiceNo: 'LOL/0467/26-27',
    invoiceDate: '14-05-2026',
    date: '14-05-2026',
    tenor: '90 days after B/L date',
    amountInWords: 'US DOLLARS FOUR THOUSAND SEVEN HUNDRED EIGHTY THREE AND CENTS TWENTY ONE ONLY',
    drawnUnderBank: 'LANDESBANK BADEN-WUERTTEMBERG, STUTTGART, GERMANY',
    lcNumber: 'LBW26IA100122',
    lcDate: '11-03-2026',
    drawee: 'LANDESBANK BADEN-WUERTTEMBERG, AM VICTORIA-TURM 2, 68163 MANNHEIM/GERMANY',
    drawer: sampleContractWeber.exporter,
    packagesShippedBy: 'S.S. / MSC CLAUDIA V.2604W',
    blAirBillRef: 'MEDU19827361',
    presentingBankProfile: sampleBankProfiles[0]
  },
  beneficiaryCertificates: [
    {
      id: 'bc-shipping-advice',
      title: "BENEFICIARY'S CERTIFICATE FOR SHIPPING ADVICE DISPATCH (FIELD 46A.6)",
      clauseRef: '46A.6',
      certType: 'shipment_advice_dispatch',
      invoiceNo: 'LOL/0467/26-27',
      lcNumber: 'LBW26IA100122',
      text: 'We, Lahoti Overseas Limited, hereby certify and confirm that we have sent a copy of shipping advice by email to rd@weberheusser-yarns.com (within 5 working days after B/L issuing date) communicating all exact shipping particulars including Vessel MSC CLAUDIA V.2604W, ETD GTI 08-Apr-2026, B/L No. MEDU19827361, Description of Goods: Ne 16/1 100% Cotton Compact Yarn, Quantity: 1,678.320 KGS, 37 Packages in Container TGHU9283710. A copy of the sent email is attached herewith.'
    },
    {
      id: 'bc-courier-coo',
      title: "BENEFICIARY'S DECLARATION OF DIRECT COURIER DISPATCH OF CERTIFICATE OF ORIGIN (FIELD 46A.5)",
      clauseRef: '46A.5',
      certType: 'custom',
      invoiceNo: 'LOL/0467/26-27',
      lcNumber: 'LBW26IA100122',
      text: 'We, Lahoti Overseas Limited, beneficiary under Documentary Credit No. LBW26IA100122, hereby solemnly certify and confirm that the Original Certificate of Origin issued by TEXPROCIL has been dispatched directly to the applicant Weber u. Heusser GmbH u. Co. KG, Lauterbachstr. 19, 72459 Albstadt/GERMANY via DHL Express Airway Bill No. 4910283741, strictly within seven (7) working days after B/L issuing date. A true copy of the courier receipt showing picked up date is attached herewith.'
    },
    {
      id: 'bc-uster-protocol',
      title: "DECLARATION OF CONFORMITY - USTER PROTOCOL TECHNICAL SPECIFICATION (FIELD 46A.7)",
      clauseRef: '46A.7',
      certType: 'custom',
      invoiceNo: 'LOL/0467/26-27',
      lcNumber: 'LBW26IA100122',
      text: 'This is to certify that the supplied 1,678.320 KGS of Ne 16/1 100% Cotton Carded Compact Yarn on Cones unwax for weaving with 630 TPM, 625 CN TEX (Ravali Brand) has undergone comprehensive laboratory testing and meets all Uster Statistics 5% benchmark standards for yarn evenness (U%), thin places (-50%), thick places (+50%), neps (+200%), and hairiness index.'
    }
  ]
};

export const sampleComplianceChecklistWeber: ComplianceChecklist = {
  blDate: '2026-04-10',
  presentationDeadline: '2026-04-25',
  lcExpiryDate: '2026-04-25',
  allPassed: false,
  items: [
    {
      id: 'chk-1',
      title: 'Presentation within 15 Days of B/L Date',
      clauseRef: 'Field 48',
      deadline: '25-Apr-2026',
      status: 'pending',
      description: 'Documents must reach the negotiating bank counter within 15 days of ocean B/L date.'
    },
    {
      id: 'chk-2',
      title: 'Shipment on or before Latest Shipment Date',
      clauseRef: 'Field 44C',
      deadline: '10-Apr-2026',
      status: 'verified',
      description: 'Vessel MSC CLAUDIA ETD is scheduled for 08-Apr-2026.'
    },
    {
      id: 'chk-3',
      title: 'Email Shipping Advice to rd@weberheusser-yarns.com',
      clauseRef: '46A.6',
      deadline: '15-Apr-2026',
      status: 'pending',
      description: 'Dispatch shipping advice within 5 working days of B/L and include email printout.'
    },
    {
      id: 'chk-4',
      title: 'Courier Original Certificate of Origin to Applicant',
      clauseRef: '46A.5',
      deadline: '17-Apr-2026',
      status: 'pending',
      description: 'Courier original COO directly to Lauterbachstr. 19 within 7 working days; attach DHL pickup receipt.'
    },
    {
      id: 'chk-5',
      title: 'Strict English Language & Zero Discrepancy Conformity',
      clauseRef: '47A.4 & 47A.8',
      status: 'verified',
      description: 'All 6 documents audited in English language to avoid EUR 150.00 discrepancy deduction fee.'
    }
  ]
};

// Aliases for backward compatibility
export const SAMPLE_CONTRACT_WEBER = sampleContractWeber;
export const SAMPLE_CONTRACT_SANJANA = sampleContractSanjana;
export const SAMPLE_EXPORT_DRAFT_WEBER = sampleExportDraftWeber;
export const SAMPLE_LC_WEBER = sampleLCWeber;
export const SAMPLE_COMPLIANCE_CHECKLIST_WEBER = sampleComplianceChecklistWeber;
