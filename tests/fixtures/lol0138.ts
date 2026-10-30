// Shipment LOL/0138/26-27 to Sanjana Fabrics under Sonali Bank LC 033026020021.
// Each fixture is what the AI extraction should return for the real document.
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
  contractNo: 'S/0403/25-26',
  contractDate: '14-01-2026',
  exporter: { name: 'LAHOTI OVERSEAS LTD.', address: '307, ARUN CHAMBERS, TARDEO ROAD, MUMBAI CENTRAL, MUMBAI. MAHARASHTRA - 400034. INDIA.' },
  buyer: { name: 'SANJANA FABRICS LTD', address: 'MAHANA, DUPTARA, RUPGONJ,\nNARAYANGONJ, BANGLADESH.' },
  orderCurrency: 'USD',
  shipmentValidity: 'END APRIL 2026',
  items: [{
    itemNo: 1,
    description: '20OE X 20KW+70D 114X56 73" 2/2 "S" TWILL',
    composition: '100% COTTON FEBRIC, COMPOSITION : 98% COTTON+2% SPANDEX, YARN: OE X KW, SELVEDGE LENO: 24 M',
    quantity: 465635,
    uom: 'YARD',
    unitPrice: 1.01,
    netValue: 470291.35
  }],
  totalValue: 470291.35,
  totalValueWords: 'US DOLLAR FOUR HUNDRED SEVENTY THOUSAND TWO HUNDRED NINETY ONE AND THIRTY FIVE CENTS ONLY',
  tolerance: '5%(+/-) ALLOWED',
  fclCount: '465,635 YARD ( 11 FCL X 40 HQ Ft. )',
  insurance: "INSURANCE TO SELLER'S ACCOUNT",
  paymentTerms: 'BY IRREVOCABLE, UNRESTRICTED, LC 90 DAYS FROM BL DATE',
  deliveryTerms: 'END APRIL 2026',
  portOfLoading: 'ANY INDIAN PORT',
  portOfDelivery: 'CPT BENAPOLE',
  shipmentMode: 'SEA',
  packingType: 'PACKING IN IN ROLLS',
  transhipment: 'ALLOWED',
  partialShipment: 'ALLOWED',
  bankDetails: { payTo: 'DBS BANK INDIA LTD', swift: 'DBSSINBB', bankAddress: '', beneficiary: 'LAHOTI OVERSEAS LIMITED', beneficiaryAccNo: '811210000268' },
  documentRequirements: [],
  termsAndConditions: []
};

export const lc: LCDetails = {
  lcNumber: '033026020021',
  issueDate: '260416',
  advisingBankRef: 'ILC0010176267',
  issuingBank: { name: 'SONALI BANK PLC', swift: 'BSONBDDHLOD', city: 'DHAKA', country: 'BD' },
  formOfCredit: 'IRREVOCABLE',
  applicableRules: 'UCP LATEST VERSION',
  expiryDate: '260710',
  expiryPlace: 'IN INDIA',
  applicant: {
    name: 'SANJANA FABRICS LTD.',
    address: 'MAHANA, DUPTARA, RUPGONJ,\nNARAYANGONJ,BANGLADESH.',
    country: 'BANGLADESH'
  },
  beneficiary: { name: 'LAHOTI OVERSEAS LIMITED.', address: '307 ARUN CHAMBERS,TARDEO\nROAD,MUMBAI-400034,INDIA.' },
  currency: 'USD',
  amount: 174730,
  tolerancePercentage: { positive: 5, negative: 5 },
  availableWith: 'ANY BANK IN INDIA',
  availableBy: 'BY NEGOTIATION',
  tenor: '90 DAYS FROM L/R DATE.',
  drawee: 'BSONBDDHLOD\nSONALI BANK PLC\nLOCAL OFFICE\nDHAKA BD',
  partialShipment: 'NOT ALLOWED',
  transhipment: 'NOT ALLOWED',
  portOfLoading: 'PETRAPOLE,INDIA',
  portOfDischarge: 'BENAPOLE,BANGLADESH.',
  latestShipmentDate: '260625',
  goodsDescriptionVerbatim: [
    'GREY FABRICS',
    "20OE X 20KW+70D 114X56 73'' 2/2 ''S'' TWILL COMPOSITION",
    '98% COTTON+2% SPANDEX(CONTAMINATION CONTROLLED) QTY 173,000',
    'YARDS RATE 1.0100/YARD.',
    '',
    'TOTAL CPT BENAPOLE,BANGLADESH. USD 174,730.00',
    '(INCLUDING FREIGHT CHARGE USD 7,000.00)',
    '',
    'SPECIFICATION, QUALITY, QUANTITY,PACKING, MARKING AND ALL OTHER',
    "DETAILS OF THE GOODS STRICTLY AS PER BENEFICIARY'S PROFORMA",
    'INVOICE NO.S/0403B2/25-26 DTD 14.01.2026 AS AGREED BETWEEN',
    'APPLICANT AND BENEFICIARY.',
    'CPT BENAPOLE,BANGLADESH(INCOTERMS 2020).'
  ].join('\n'),
  goodsQuantity: 173000,
  goodsQuantityUom: 'YARDS',
  unitPrice: 1.01,
  freightTotal: 7000,
  contractReference: 'S/0403B2/25-26',
  presentationPeriodDays: 21,
  confirmationInstructions: 'WITHOUT',
  chargesNarrative: "ALL BANKING CHARGES OUTSIDE OF BANGLADESH ARE ON BENEFICIARY'S ACCOUNT.",
  field46AClauses: [
    clause('46A', 1, 'A)', 'SIGNED COMMERCIAL INVOICE IN 06 COPIES CERTIFYING MERCHANDISE ARE OF INDIA ORIGIN INVOICE ARE TO BE SHOWN H.S CODE NO.5209.12.00, TIN NO.714245426517,IRC NO.BA-0169290,BIN NO-000358148-0303.'),
    clause('46A', 2, 'B)', 'FULL SET PLUS 05 COPIES TRUCK RECEIPT CONSIGNEE:TO THE ORDER OF SONALI BANK PLC.,LOCAL OFFICE, MOTIJHEEL C/A,DHAKA MARKED FREIGHT PREPAID, NOTIFY:-(i) APPLICANT, (ii) SONALI BANK PLC. LOCAL OFFICE, 35-44, MOTIJHEEL C/A, DHAKA, BANGLADESH BIN-000000063-0002.'),
    clause('46A', 3, 'C)', 'SIGNED PACKING LIST IN 05 COPIES.'),
    clause('46A', 4, 'D)', "BENEFICIARY'S CERTIFICATE STATING THAT ORIGINAL CERTIFICATE OF ORIGIN OR E-CERTIFICATE OF ORIGIN ISSUED BY COMPETENT AUTHORITY IN 3 COPIES."),
    clause('46A', 5, 'E)', "INSURANCE AT BUYER'S CARE. ALL SHIPMENT UNDER THIS CREDIT MUST BE ADVISED BY COURIER TO THE APPLICANT E-MAIL: info@asiatic-group.com,SONALI BANK PLC., LOCAL OFFICE, MOTIJHEEL C/A,DHAKA E-MAIL:localcorp@sonalibank.com.bd AND TO INSURANCE COMPANY: PROVATI INSURANCE PLC.,HATKHOLA BRANCH, ROOM NO:22,BHUIYAN MANSION(4TH FLOOR),6 MOTIJHEEL C/A,DHAKA-1000,BANGLADESH, E-MAIL:piclhkb@gmail.com MENTIONING COVER NOTE NO.PIPLC/HKB/MC-2026/04/0054, DTD.13.04.2026 WITHIN SEVEN DAYS OF SHIPMENT AND A COPY TO ACCOMPANY THE SHIPPING DOCUMENTS."),
    clause('46A', 6, 'F)', 'ONE COMPLETE SET NON-NEGOTIABLE SHIPPING DOCUMENTS TO BE SENT TO THE APPLICANT BY E-MAIL:info@asiatic-group.com AND A CERTIFICATE TO THIS EFFECT TO ACCOMPANY THE ORIGINAL SHIPPING DOCUMENTS.')
  ],
  field47AClauses: [
    clause('47A', 1, '01.', 'BENEFICIARY MUST CERTIFY ON THE INVOICE THAT THE GOODS SHIPPED ARE STRICTLY IN ACCORDANCE WITH THE TERMS OF THE PROFORMA INVOICE.'),
    clause('47A', 2, '02.', 'OUR L/C NUMBER, DATE,H.S.CODE,GOODS DESCRIPTION, BIN NO.000358148-0303 MUST BE MENTIONED IN ALL DOCUMENTS.'),
    clause('47A', 3, '03.', 'COUNTRY OF ORIGIN TO BE MENTIONED IN ALL PACKAGES.'),
    clause('47A', 4, '04.', 'SHIPMENTS AND TRANSSHIPMENT, IF ANY, MUST BE EFFECTED BY COMPANIES HONOURING BANGLADESHI LAWS AND REGULATIONS REGARDING TRUCK RECEIPT,SHIPMENTS AND TRANSSHIPMENT.'),
    clause('47A', 5, '05.', 'USD.50.00 PLUS SWIFT CHARGES FOR USD.30.00 TO BE CHARGED FROM EACH SET OF DISCREPANT DOCUMENTS. HOWEVER, PAYMENT/HANDLING CHARGES USD20.00 TO BE DEDUCTED FROM EACH SET OF DOCUMENTS.'),
    clause('47A', 6, '06.', 'ALL DOCUMENTS TO BE PREPARED IN ENGLISH LANGUAGE EXCEPT PRE-PRINTED FORMS AND STAMPS.'),
    clause('47A', 7, '07.', "BENEFICIARY MUST SEND THE SHIPPING ADVICE TO SONALI BANK PLC., LOCAL OFFICE THROUGH E-MAIL localcorp@sonalibank.com.bd AFTER SHIPMENT THE ACTUAL VALUE OF GOODS SHIPPED, TRUCK RECEIPT, NUMBER AND DATE AND BENEFICIARY'S CERTIFICATE MUST ACCOMPANY THE ORIGINAL SHIPPING DOCUMENTS."),
    clause('47A', 8, '08.', 'ALL DOCUMENTS SHOULD BE SIGNED AND DATED.'),
    clause('47A', 9, '09.', 'FOB VALUE AND FREIGHT CHARGE SHOULD BE MENTIONED IN ALL COMMERCIAL INVOICE.'),
    clause('47A', 10, '10.', 'DESPITE THE TENOR OF THE LC IS AT 90 DAYS FROM THE DATE OF L/R DATE.'),
    clause('47A', 11, '11.', 'THIS L/C IS OPENED UNDER BOND.')
  ]
};

export const preShipment: PreShipmentInvoiceData = {
  invoiceNo: 'LOL/0138/26-27',
  invoiceDate: '11/06/2026',
  buyersOrderNo: 'S/0403/25-26',
  // Header boxes as printed on the pre-shipment invoice (IRN, pre-carriage, place of receipt and vessel are blank on it)
  irnNo: undefined,
  otherReference: 'BL No.',
  consignee: 'TO THE ORDER OF SONALI BANK PLC\nMOJIJHEEL C/A DHAKA',
  buyer: 'SANJANA FABRICS LTD\nMAHANA, DUPTARA, RUPGONJ,\nNARAYANGONJ, BANGLADESH.',
  preCarriageBy: undefined,
  placeOfReceipt: undefined,
  vesselFlightNo: undefined,
  portOfLoading: 'PETRAPOLE',
  portOfDischarge: 'BENAPOLE',
  finalDestination: 'BENAPOLE',
  countryOfOrigin: 'INDIAN ORIGIN',
  countryOfFinalDestination: 'BANGLADESH',
  termsOfDeliveryAndPayment: 'CPT BENAPOLE,BANGLADESH(INCOTERM 2020)\nLC NO.033026020021-PP DT. 16.04.2026\n\nAT 90 DAYS FROM LR DATE',
  exporter: {
    name: 'LAHOTI OVERSEAS LIMITED',
    address: '307, ARUN CHAMBERS,\nTARDEO ROAD,\nMUMBAI - 400 034 INDIA',
    cin: 'L74999MH1995PLC087643',
    gstin: '27AAACL2578H1ZE',
    pan: 'AAACL2578H'
  },
  marksAndNos: 'COTTON FABRICS\nROLL NOS :\n1 - 76\nTOTAL GROSS WT :\n7,755.500 KGS\nTOTAL NET WT :\n7679.500 KGS\nCONTAINER NO/SEAL NO :',
  packageCount: 76,
  packageKind: 'ROLLS',
  goodsQuantity: 21210.57,
  goodsQuantityUom: 'YARDS',
  customsQuantity: 35962.2,
  customsQuantityUom: 'SQ MTR',
  customsRate: 0.5957,
  totalAmount: 21422.68,
  currency: 'USD',
  grossWeightKg: 7755.5,
  netWeightKg: 7679.5,
  freightAmount: 1200,
  insuranceAmount: 0,
  exchangeRate: 94.9,
  hsnCode: '52091290',
  customsDescription: 'WOVEN FABRICS OF COTTON UNBLEACHED\nCONTAINING 85% MORE BY WEIGHT OF COTTON\nWEITHING MORE THAN 200G/M2 GSM-213',
  manufacturer: 'ESHITA TEXTILE',
  epcgLicence: '3131003052/02.02.2024',
  drawbackSrNo: '520901B',
  adCode: '6690001-6000009',
  bankName: 'DBS BANK INDIA LTD'
};

export const shipment: ShipmentTransportDetails = {
  transportDocNo: '26554',
  transportDocDate: '20/06/2026',
  customsEntryNo: '60120260010037517',
  customsEntryDate: '20.06.2026',
  documentsDate: '22.06.2026',
  negotiatingBankId: 'scb-in'
};
