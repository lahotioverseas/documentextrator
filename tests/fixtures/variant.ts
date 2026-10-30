// A made-up second shipment that shares nothing with LOL/0138 except the exporter:
// different buyer, issuing bank, LC, goods, route (by sea) and tenor. Used to prove that
// every generated field comes from the uploaded documents rather than from built-in values.
import { LCDetails, PreShipmentInvoiceData, SaleContractData, ShipmentTransportDetails, LCClause } from '../../src/types';

const clause = (field: '46A' | '47A', n: number, marker: string, verbatimText: string): LCClause => ({
  id: `${field}.${n}`,
  field,
  clauseNumber: n,
  clauseMarker: marker,
  verbatimText,
  plainEnglishSummary: '',
  type: 'bake_in_instruction',
  affectedDocuments: ['all'],
  appliesToDocument: ['all']
});

export const contract: SaleContractData = {
  documentType: 'sales',
  contractNo: 'Y/0777/26-27',
  contractDate: '05-05-2026',
  exporter: { name: 'LAHOTI OVERSEAS LTD.', address: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI - 400034. INDIA.' },
  buyer: { name: 'DELTA SPINNING CO., LTD', address: '12 TAN THUAN ROAD, DISTRICT 7,\nHO CHI MINH CITY, VIETNAM.' },
  orderCurrency: 'USD',
  shipmentValidity: 'END AUGUST 2026',
  items: [{
    itemNo: 1,
    description: 'NE 30/1 100% COTTON COMBED COMPACT YARN FOR KNITTING',
    composition: '100% COTTON',
    quantity: 60000,
    uom: 'KGS',
    unitPrice: 2.85,
    netValue: 171000
  }],
  totalValue: 171000,
  totalValueWords: 'US DOLLAR ONE HUNDRED SEVENTY ONE THOUSAND ONLY',
  tolerance: '10%(+/-) ALLOWED',
  fclCount: '3 X 40 FT',
  insurance: "INSURANCE TO BUYER'S ACCOUNT",
  paymentTerms: 'BY IRREVOCABLE LC 60 DAYS FROM BL DATE',
  deliveryTerms: 'CFR CAT LAI',
  portOfLoading: 'NHAVA SHEVA',
  portOfDelivery: 'CFR CAT LAI',
  shipmentMode: 'SEA',
  packingType: 'CARTONS',
  transhipment: 'ALLOWED',
  partialShipment: 'ALLOWED',
  bankDetails: { payTo: 'DBS BANK INDIA LTD', swift: 'DBSSINBB', bankAddress: '', beneficiary: 'LAHOTI OVERSEAS LIMITED', beneficiaryAccNo: '811210000268' },
  documentRequirements: [],
  termsAndConditions: []
};

export const lc: LCDetails = {
  lcNumber: 'MK26ILC004471',
  issueDate: '260520',
  advisingBankRef: 'ADV7788',
  issuingBank: { name: 'MEKONG COMMERCIAL BANK', swift: 'MKCBVNVX', city: 'HO CHI MINH CITY', country: 'VN' },
  formOfCredit: 'IRREVOCABLE',
  applicableRules: 'UCP LATEST VERSION',
  expiryDate: '260915',
  expiryPlace: 'INDIA',
  applicant: {
    name: 'DELTA SPINNING CO., LTD.',
    address: '12 TAN THUAN ROAD, DISTRICT 7,\nHO CHI MINH CITY, VIETNAM.',
    country: 'VIETNAM'
  },
  beneficiary: { name: 'LAHOTI OVERSEAS LIMITED', address: '307 ARUN CHAMBERS, TARDEO ROAD, MUMBAI-400034, INDIA.' },
  currency: 'USD',
  amount: 171000,
  tolerancePercentage: { positive: 10, negative: 10 },
  availableWith: 'ANY BANK',
  availableBy: 'BY NEGOTIATION',
  tenor: '60 DAYS FROM B/L DATE',
  drawee: 'MKCBVNVX\nMEKONG COMMERCIAL BANK\nHO CHI MINH CITY',
  partialShipment: 'ALLOWED',
  transhipment: 'ALLOWED',
  portOfLoading: 'NHAVA SHEVA PORT, INDIA',
  portOfDischarge: 'CAT LAI PORT, VIETNAM',
  latestShipmentDate: '260831',
  goodsDescriptionVerbatim: [
    'NE 30/1 100% COTTON COMBED COMPACT YARN FOR KNITTING',
    'QTY 60,000 KGS RATE 2.85/KG',
    'TOTAL CFR CAT LAI PORT, VIETNAM USD 171,000.00',
    'AS PER PROFORMA INVOICE NO. Y/0777/26-27 DTD 05.05.2026',
    'CFR CAT LAI PORT, VIETNAM (INCOTERMS 2020).'
  ].join('\n'),
  goodsQuantity: 60000,
  goodsQuantityUom: 'KGS',
  unitPrice: 2.85,
  contractReference: 'Y/0777/26-27',
  presentationPeriodDays: 21,
  confirmationInstructions: 'WITHOUT',
  chargesNarrative: "ALL BANKING CHARGES OUTSIDE VIETNAM ARE FOR BENEFICIARY'S ACCOUNT.",
  field46AClauses: [
    clause('46A', 1, '1.', 'SIGNED COMMERCIAL INVOICE IN 3 COPIES SHOWING H.S. CODE 5205.24.'),
    clause('46A', 2, '2.', 'FULL SET OF CLEAN ON BOARD OCEAN BILLS OF LADING MADE OUT TO THE ORDER OF MEKONG COMMERCIAL BANK, HO CHI MINH CITY BRANCH MARKED FREIGHT PREPAID NOTIFY APPLICANT.'),
    clause('46A', 3, '3.', 'PACKING LIST IN 3 COPIES.'),
    clause('46A', 4, '4.', 'CERTIFICATE OF ORIGIN ISSUED BY CHAMBER OF COMMERCE.'),
    clause('46A', 5, '5.', "BENEFICIARY'S CERTIFICATE CERTIFYING THAT ONE SET OF NON-NEGOTIABLE DOCUMENTS HAS BEEN SENT TO THE APPLICANT BY E-MAIL: purchasing@deltaspin.vn")
  ],
  field47AClauses: [
    clause('47A', 1, '1.', 'ALL DOCUMENTS MUST SHOW THIS L/C NUMBER AND DATE.'),
    clause('47A', 2, '2.', 'DOCUMENTS PRESENTED LATER THAN 21 DAYS AFTER SHIPMENT ARE NOT ACCEPTABLE.')
  ]
};

export const preShipment: PreShipmentInvoiceData = {
  invoiceNo: 'LOL/0291/26-27',
  invoiceDate: '02/08/2026',
  buyersOrderNo: 'Y/0777/26-27',
  irnNo: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9',
  otherReference: 'IEC 0393012345',
  consignee: 'TO THE ORDER OF MEKONG COMMERCIAL BANK\nHO CHI MINH CITY BRANCH',
  buyer: 'DELTA SPINNING CO., LTD\n12 TAN THUAN ROAD, DISTRICT 7,\nHO CHI MINH CITY, VIETNAM.',
  preCarriageBy: 'BY TRUCK',
  placeOfReceipt: 'BHIWANDI',
  vesselFlightNo: undefined,
  portOfLoading: 'NHAVA SHEVA',
  portOfDischarge: 'CAT LAI',
  finalDestination: 'HO CHI MINH CITY',
  countryOfOrigin: 'INDIAN ORIGIN',
  countryOfFinalDestination: 'VIETNAM',
  termsOfDeliveryAndPayment: 'CFR CAT LAI\nLC NO. MK26ILC004471 DT. 20.05.2026\nAT 60 DAYS FROM B/L DATE',
  exporter: {
    name: 'LAHOTI OVERSEAS LIMITED',
    address: '307, ARUN CHAMBERS,\nTARDEO ROAD,\nMUMBAI - 400 034 INDIA',
    cin: 'L74999MH1995PLC087643',
    gstin: '27AAACL2578H1ZE',
    pan: 'AAACL2578H'
  },
  marksAndNos: 'DELTA SPINNING\nCAT LAI\nC/NO. 1-800',
  packageCount: 800,
  packageKind: 'CARTONS',
  goodsQuantity: 20000,
  goodsQuantityUom: 'KGS',
  totalAmount: 57000,
  currency: 'USD',
  grossWeightKg: 20850,
  netWeightKg: 20000,
  freightAmount: 1650,
  insuranceAmount: 0,
  exchangeRate: 95.2,
  hsnCode: '52052410',
  bankName: 'DBS BANK INDIA LTD'
};

export const shipment: ShipmentTransportDetails = {
  transportDocNo: 'MSKU7712345',
  transportDocDate: '10/08/2026',
  vehicleOrVessel: 'MAERSK KOWLOON V.632E',
  containerSealNo: 'MSKU8812345 / SL445566',
  documentsDate: '12.08.2026',
  negotiatingBankId: 'dbs-in'
};
