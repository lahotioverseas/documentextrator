export interface ExporterParty {
  name: string;
  address: string;
  tel?: string;
  fax?: string;
  email?: string;
  web?: string;
  cin?: string;
  rexNo?: string;
  taxId?: string;
  pan?: string;
  gstin?: string;
}

export interface BuyerParty {
  name: string;
  address: string;
  country?: string;
  contactPerson?: string;
  taxId?: string;
  bin?: string;
  tin?: string;
  email?: string;
}

export interface ContractLineItem {
  itemNo: number;
  description: string; // VERBATIM
  specification?: string;
  composition?: string;
  yarnDetails?: string;
  quantity: number;
  uom: string; // YARD, KG, MTR, LBS
  unitPrice: number;
  netValue: number;
}

export interface BankDetails {
  payTo: string;
  swift: string;
  bankAddress: string;
  beneficiary: string;
  beneficiaryAccNo: string;
  intermediaryBank?: string;
  intermediarySwift?: string;
  intermediaryAccNo?: string;
  abaNo?: string;
}

export interface FieldConfidence {
  source: string; // e.g. "From Contract, Page 1"
  confidence: 'high' | 'medium' | 'low';
  excerpt?: string;
}

export interface SaleContractData {
  documentType?: 'sales' | 'purchase';
  contractNo: string;
  contractDate: string;
  exporter: ExporterParty;
  buyer: BuyerParty;
  orderCurrency: string;
  shipmentValidity: string;
  refCorrespondence?: string;
  items: ContractLineItem[];
  totalValue: number;
  totalValueWords: string;
  tolerance: string; // e.g. "5%(+/-) ALLOWED"
  fclCount: string; // e.g. "465,635 YARD (11 FCL X 40 HQ Ft.)"
  insurance: string; // "INSURANCE TO SELLER'S ACCOUNT"
  paymentTerms: string; // "BY IRREVOCABLE, UNRESTRICTED, LC 90 DAYS FROM BL DATE"
  deliveryTerms: string; // "CPT BENAPOLE" or "CFR HAMBURG, GERMANY"
  portOfLoading: string; // "ANY INDIAN PORT"
  portOfDelivery: string; // "CPT BENAPOLE"
  shipmentMode: string; // "SEA"
  packingType: string; // "PACKING IN ROLLS"
  transhipment: string; // "ALLOWED" | "NOT ALLOWED"
  partialShipment: string; // "ALLOWED" | "NOT ALLOWED"
  bankDetails: BankDetails;
  documentRequirements: string[];
  termsAndConditions: string[];
  fieldSources?: Record<string, FieldConfidence>;
}

export interface PackingRow {
  lotNo: string;
  count: string;
  noOfUnits: string; // e.g. "37 CARTONS"
  containerSealNo: string;
  netWtKg: number | null;
  grossWtKg: number | null;
  dimensions?: string;
  shippingMarks?: string;
}

export interface ExportLineItem {
  marksAndNos: string;
  noAndKindOfPkg: string;
  description: string;
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
  hsCode?: string;
  purchaseContractNo?: string;
  itemCount?: string;
  grossWt?: number;
  netWt?: number;
  ratePer?: string;
  ratePer400?: number;
  unitOfRate?: string;
  noOfCartons?: number;
  packageKind?: string;
  cartonOption?: string;
  itemDescription1?: string;
  specification?: string;
}

export interface ExportData {
  exporter: ExporterParty;
  invoiceNo: string;
  invoiceDate: string;
  exporterRef?: string;
  irnno?: string;
  buyersOrderNo: string;
  buyersOrderDate: string;
  blNo?: string;
  otherReference?: string;
  consignee: string; // "TO ORDER" or full address
  buyerIfOtherThanConsignee: string;
  countryOfOrigin: string; // "INDIAN ORIGIN"
  countryOfFinalDestination: string;
  termsOfDelivery?: string;
  preCarriageBy?: string;
  placeOfReceiptByPreCarrier?: string;
  vesselFlightNo?: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  termsOfDeliveryAndPayment: string;
  lineItems: ExportLineItem[];
  packingRows: PackingRow[];
  totalQuantity: number;
  totalNetWtKg: number | null;
  totalGrossWtKg: number | null;
  totalCartons?: number;
  totalAmount: number;
  currency: string;
  amountInWords: string;
  declarationText: string;
  rexNumber?: string;
  lcNumberReference?: string;
  lcReference?: string;
  lcDateReference?: string;
  freightAmount?: number; // freight for THIS shipment (from pre-shipment invoice)
  insuranceAmount?: number;
  exchangeRate?: number;
  appliedClauseBadges?: Record<string, string[]>; // fieldPath -> ["LC clause 46A.1", "LC clause 47A.3"]
}

export type ClauseCategory =
  | 'document_requirement'
  | 'declaration'
  | 'shipping_rule'
  | 'banking_condition'
  | 'special_instruction'
  | 'discrepancy_rule';

export type ClauseType = 'bake_in_instruction' | 'compliance_rule';
export type AffectedDocument =
  | 'invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'certificate_of_origin'
  | 'bill_of_exchange'
  | 'beneficiary_certificate'
  | 'all';

export interface LCClause {
  id: string; // "46A.1", "47A.2"
  field: '46A' | '47A' | '45A' | '48' | 'OTHER';
  clauseNumber: number;
  clauseMarker?: string;
  verbatimText: string; // Character-for-character
  plainEnglishSummary: string;
  instructionSummary?: string;
  category?: ClauseCategory;
  type: ClauseType;
  affectedDocuments: AffectedDocument[];
  appliesToDocument?: AffectedDocument[];
  isAutoAppliable?: boolean;
  targetField?: string;
  instructionDetail?: string;
}

export interface LCDetails {
  lcNumber: string;
  issueDate: string; // e.g. "2026-03-11" or "260311"
  advisingBankRef?: string;
  advisingBank?: {
    name: string;
    branch?: string;
    swift?: string;
    address?: string;
  };
  issuingBank: {
    name: string;
    swift?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  formOfCredit: string; // "IRREVOCABLE TRANSFERABLE"
  applicableRules: string; // "UCP LATEST VERSION"
  expiryDate: string; // "2026-04-25"
  expiryPlace: string; // "India"
  applicant: BuyerParty;
  beneficiary: ExporterParty;
  currency: string; // "USD"
  amount: number;
  tolerancePercentage: {
    positive: number;
    negative: number;
  };
  availableWith: string; // "Any Bank in India"
  availableBy: string; // "BY NEGOTIATION"
  tenor: string; // "90 days after B/L date"
  partialShipment: string; // "NOT ALLOWED"
  transhipment: string; // "ALLOWED"
  portOfLoading: string; // "Any Port in India"
  portOfDischarge: string; // "Hamburg in Germany"
  placeOfReceipt?: string; // 44A place of taking in charge / dispatch, when the LC states one
  placeOfFinalDestination?: string; // 44B place of final destination, when the LC states one
  latestShipmentDate: string; // "2026-04-10"
  goodsDescriptionVerbatim: string; // Exact 45A content
  contractReference: string; // "S/0467/25-26"
  irnNumber?: string;
  periodForPresentationDays?: number;
  presentationPeriodDays?: number; // Field 48 (e.g. 15 or 21)
  confirmationInstructions: string; // "WITHOUT"
  stepReference?: string; // e.g. "ISS 000"
  chargesNarrative?: string; // Field 71D
  instructionsToBank?: string; // Field 78
  drawee?: string; // Field 42A verbatim, e.g. "BSONBDDHLOD\nSONALI BANK PLC\nLOCAL OFFICE\nDHAKA BD"
  goodsQuantity?: number; // Total quantity covered by the LC (from 45A), e.g. 173000
  goodsQuantityUom?: string; // e.g. "YARDS"
  unitPrice?: number; // Rate stated in 45A, e.g. 1.01
  freightTotal?: number; // Freight included in the LC amount, e.g. 7000
  goodsItems?: LCGoodsItem[]; // one entry per product listed in 45A (an LC can cover several)
  applicantBank?: string; // Field 51D, verbatim
  field46AClauses: LCClause[];
  field47AClauses: LCClause[];
}

/** One product of LC field 45A, e.g. "NE 30/1 ... QUANTITY: 63,957.60 KG, UNIT PRICE: 2.720 PER KGS". */
export interface LCGoodsItem {
  description: string; // this product's lines exactly as in 45A, without the quantity/price line
  quantity: number; // quantity the LC allows for this product
  uom: string; // "KG", "YARDS"
  unitPrice: number;
  amount?: number;
  contractRef?: string; // sales contract / proforma invoice the product belongs to, when 45A says
}

/** One product line of the pre-shipment invoice (a shipment can carry several products). */
export interface PreShipmentItem {
  description: string; // "100 PERCENT PHYSICAL BCI COTTON CARDED GREY YARN ON CONES FOR KNITTING\nNE 30/1 KH-PHYSICAL BCI COTTON"
  quantity: number;
  uom: string;
  rate: number;
  amount: number;
  marksAndNos?: string;
  packageCount?: number;
  packageKind?: string;
  netWeightKg?: number | null;
  grossWeightKg?: number | null;
}

/**
 * Data read from the pre-shipment (GST / customs) invoice that Lahoti prepares
 * before the truck/vessel leaves. It carries the facts of ONE shipment.
 */
export interface PreShipmentInvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  irnNo?: string;
  buyersOrderNo?: string;
  buyersOrderDate?: string;
  otherReference?: string;
  exporter?: ExporterParty;
  consignee?: string;
  buyer?: string; // "Buyer (if other than consignee)" box, verbatim
  preCarriageBy?: string;
  placeOfReceipt?: string;
  vesselFlightNo?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  finalDestination?: string;
  countryOfOrigin?: string;
  countryOfFinalDestination?: string;
  termsOfDeliveryAndPayment?: string; // whole box verbatim, line breaks kept
  marksAndNos: string; // verbatim block, e.g. "COTTON FABRICS\nROLL NOS :\n1 - 76\nTOTAL GROSS WT :\n..."
  packageCount: number; // 76
  packageKind: string; // "ROLLS"
  goodsQuantity: number; // shipment quantity in LC unit, e.g. 21210.57
  goodsQuantityUom: string; // "YARDS"
  customsQuantity?: number; // quantity in the customs unit, e.g. 35962.2
  customsQuantityUom?: string; // "SQ MTR"
  customsRate?: number;
  totalAmount: number; // 21422.68
  currency: string;
  grossWeightKg: number | null;
  netWeightKg: number | null;
  freightAmount?: number; // 1200
  insuranceAmount?: number;
  exchangeRate?: number; // 94.90
  hsnCode?: string; // Indian ITC-HS, e.g. "52091290"
  customsDescription?: string; // tariff description lines
  manufacturer?: string;
  epcgLicence?: string;
  drawbackSrNo?: string;
  adCode?: string;
  bankName?: string;
  items?: PreShipmentItem[]; // every product line; totals above cover the whole invoice
}

/**
 * Transport-document facts that only exist after the goods are handed to the carrier
 * (LR / truck receipt for road, B/L for sea). Entered at the B/L stage.
 */
export interface ShipmentTransportDetails {
  transportDocNo: string; // LR / B/L number, e.g. "26554"
  transportDocDate: string; // e.g. "20/06/2026" — this is the date of shipment
  vehicleOrVessel?: string; // truck no. or vessel/voyage
  containerSealNo?: string;
  shippingBillNo?: string;
  shippingBillDate?: string;
  customsEntryNo?: string; // B.C.P. entry no. at land port, e.g. "60120260010037517"
  customsEntryDate?: string;
  documentsDate?: string; // date printed on certificates, e.g. "22.06.2026"
  negotiatingBankId?: string;
}

/** One shipment (= one commercial invoice) drawn against an LC. */
export interface LCShipmentRecord {
  invoiceNo: string;
  invoiceDate: string;
  quantity: number;
  quantityUom: string;
  amount: number;
  freightAmount?: number;
  transportDocNo?: string;
  transportDocDate?: string;
  items?: LCShipmentItemUse[]; // per-product use when the LC lists several products
  status: 'draft' | 'shipped';
  updatedAt: string;
}

/** Quantity/value of one LC 45A product used by a shipment. */
export interface LCShipmentItemUse {
  lcItemIndex: number; // index into LCDetails.goodsItems
  quantity: number;
  amount: number;
}

/** Persistent record of an LC and every shipment made under it. Keyed by LC number. */
export interface LCLedgerEntry {
  lcNumber: string;
  lcDetails: LCDetails;
  contractData?: SaleContractData | null;
  shipments: LCShipmentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Discrepancy {
  id: string;
  field: string;
  severity: 'amendment_required' | 'review' | 'info';
  title: string;
  contractValue: string;
  lcValue: string;
  explanation: string;
  suggestedAction: string;
}

export interface LCAmendment {
  id: string;
  amendmentNo: string;
  amendmentDate: string;
  narrative: string;
  changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    impact: string;
  }>;
  patchedClauses?: LCClause[];
  appliedAt: string;
}

export interface BankProfile {
  id: string;
  bankName: string;
  branch: string;
  city: string;
  swift?: string;
  accountNo?: string;
}

export interface AppliedClauseTrace {
  clauseId: string;
  field: '46A' | '47A' | '45A' | '48' | 'OTHER';
  verbatimText: string;
  targetField: string;
  summary: string;
}

export interface CommercialInvoiceFinal {
  isPreShipment?: boolean; // GST "SUPPLY MEANT FOR EXPORT" invoice instead of the commercial invoice
  exporter: ExporterParty;
  invoiceNo: string;
  invoiceDate: string;
  irnno?: string;
  otherReference?: string;
  consignee: string;
  buyerIfOtherThanConsignee?: string;
  notifyParty?: string;
  buyersOrderNo: string;
  buyersOrderDate: string;
  lcReference: string;
  lcDateReference?: string;
  termsOfDelivery: string;
  countryOfOrigin: string;
  countryOfFinalDestination: string;
  preCarriageBy?: string;
  placeOfReceipt?: string;
  vesselFlightNo?: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  currency: string;
  lineItems: ExportLineItem[];
  totalQuantity: number;
  totalAmount: number;
  amountInWords: string;
  declarationText: string;
  additionalDeclarations?: Array<{ clauseRef: string; text: string; verbatimText?: string }>;
  rexNumber?: string;
  fobValue?: number;
  freightAmount?: number;
  showFobFreightSplit?: boolean;
  exchangeRate?: number;
  showExchangeRate?: boolean;
  paymentTenorLine?: string;
  tenor?: string;
  appliedClauseTraces?: AppliedClauseTrace[];
}

export interface PackingListFinal {
  exporter: ExporterParty;
  invoiceNo: string;
  invoiceDate: string;
  exporterRef?: string;
  buyersOrderNo?: string;
  buyersOrderDate?: string;
  otherReference?: string;
  consignee?: string;
  buyerIfOtherThanConsignee?: string;
  countryOfOrigin?: string;
  countryOfFinalDestination?: string;
  preCarriageBy?: string;
  placeOfReceipt?: string;
  vesselFlightNo?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  finalDestination?: string;
  termsOfDelivery?: string;
  marksAndNos?: string;
  containerNo?: string;
  noAndKindOfPkg?: string;
  goodsDescriptionVerbatim?: string;
  remarks?: string;
  bakedPalletQuote: string;
  packingRows: PackingRow[];
  totalNetWtKg: number | null;
  totalGrossWtKg: number | null;
  totalCartonsOrPackages?: string;
  appliedClauseTraces?: AppliedClauseTrace[];
}

export interface BillOfLadingFinal {
  exporter: ExporterParty;
  shipper: ExporterParty;
  invoiceNo: string;
  invoiceDate?: string;
  consignee: string;
  consigneeVatBin?: string;
  buyerIfOtherThanConsignee?: string;
  notifyParty1: string;
  notifyParty1VatBin?: string;
  notifyParty2?: string;
  notifyParty2VatBin?: string;
  vesselFlightNo?: string;
  portOfLoading: string;
  portOfDischarge: string;
  finalDestination: string;
  marksAndNos: string;
  packagesCountAndKind: string;
  goodsDescription: string;
  totalGrossWtKg: number | null;
  totalNetWtKg: number | null;
  containerSealNos?: string;
  freightStatus: string;
  shippingBillNo?: string;
  shippingBillDate?: string;
  freeDetentionClause?: string;
  agentDetailsAtDestination?: string;
  blWeightCheckClause?: string;
  lcNumber?: string;
  lcDate?: string;
  insuranceCoverNote?: string;
  exportLcSclNo?: string;
  vatApplicant?: string;
  vatIssuingBank?: string;
  // LC identifiers printed under the description ("H.S.CODE NO. ..., TIN NO. ...," / "IRC NO. ..., BIN NO. ...")
  hsCodeNo?: string;
  tinNo?: string;
  ircNo?: string;
  binNo?: string;
  underBond?: boolean; // "THIS L/C IS OPENED UNDER BOND."
  cleanOnBoardClause: boolean;
  appliedClauseTraces?: AppliedClauseTrace[];
}

export interface CertificateOfOriginFinal {
  exporter: ExporterParty;
  invoiceNo: string;
  invoiceDate: string;
  consignee: string;
  countryOfOrigin: string;
  issuingAuthority: string;
  originDeclaration: string;
  goodsDescription: string;
  marksAndNos: string;
  quantityWithUom: string;
  grossWeightKg?: number | null;
  netWeightKg?: number | null;
  portOfLoading: string;
  portOfDischarge: string;
  vesselFlightNo?: string;
  placeAndDateOfIssue: string;
  vatApplicant?: string;
  vatIssuingBank?: string;
  containerSealNos?: string;
  cartonCountOrPackages?: string;
  hsCode?: string;
  lcNumber?: string;
  lcDate?: string;
  contractReference?: string;
  insuranceCoverNote?: string;
  termsOfDelivery?: string;
  appliedClauseTraces?: AppliedClauseTrace[];
}

export interface BillOfExchangeFinal {
  currency: string;
  amount: number;
  invoiceNo: string;
  invoiceDate: string;
  date: string;
  tenor: string;
  amountInWords: string;
  drawnUnderBank: string;
  lcNumber: string;
  lcDate: string;
  drawee: string;
  drawer: ExporterParty;
  accountOf?: string;
  packagesShippedBy?: string;
  blAirBillRef?: string;
  headerText?: string; // "DRAWN UNDER DOCUMENTARY CREDIT NO : ..." + LC reference lines
  payToOrderOf?: string; // negotiating bank block; overrides presentingBankProfile text
  presentingBankProfile?: BankProfile;
  appliedClauseTraces?: AppliedClauseTrace[];
}

export interface BeneficiaryCertFinal {
  id: string;
  exporter?: ExporterParty;
  title: string;
  docTitle?: string; // 'DECLARATION OF SHIPMENT' | 'BENEFICIARY CERTIFICATE'
  clauseRef: string;
  certType: 'shipment_advice_dispatch' | 'email_advice_enclosed' | 'country_of_origin' | 'importer_tin_bin' | 'non_negotiable_docs' | 'custom';
  docHeaderDate?: string;
  invoiceNo: string;
  lcNumber: string;
  lcDate?: string;
  insuranceCoverNote?: string;
  insuranceCoverNoteDate?: string;
  applicantDetails?: string;
  applicantBin?: string;
  applicantEmail?: string;
  insuranceCompanyDetails?: string;
  insuranceEmail?: string;
  emailDetails?: {
    from: string;
    sent: string;
    to: string;
    subject: string;
  };
  goodsNarration?: string;
  shipmentParticulars?: {
    vessel: string;
    shipmentDate: string;
    invoiceAmount: string;
    quantity: string;
    portOfLoading: string;
    portOfDischarge: string;
    blNo: string;
    containerNo: string;
  };
  listOfDocuments?: string[];
  // Generic addressee blocks and particulars table; when present renderers use these
  // instead of the insurance/applicant fields and the fixed sea-freight labels.
  recipients?: Array<{ address: string; email?: string }>;
  particulars?: Array<{ label: string; value: string }>;
  footnoteDetails?: string;
  postTextInstruction?: string;
  text: string;
  closingNote?: string;
  signatoryName?: string;
  signatoryCompany?: string;
  appliedClauseTraces?: AppliedClauseTrace[];
}

export interface FinalDocumentSet {
  commercialInvoice: CommercialInvoiceFinal;
  packingList: PackingListFinal;
  billOfLading: BillOfLadingFinal;
  certificateOfOrigin: CertificateOfOriginFinal;
  billOfExchange: BillOfExchangeFinal;
  beneficiaryCertificates: BeneficiaryCertFinal[];
}

export interface ComplianceChecklistItem {
  id: string;
  title: string;
  clauseRef: string;
  deadline?: string;
  status: 'verified' | 'pending' | 'action_needed';
  description: string;
}

export interface ComplianceChecklist {
  blDate: string;
  presentationDeadline: string;
  lcExpiryDate: string;
  allPassed: boolean;
  items: ComplianceChecklistItem[];
}

export interface SourceDocument {
  id: string;
  name: string;
  type: 'contract' | 'lc' | 'amendment' | 'packing_draft' | 'preshipment';
  uploadedAt: string;
  size: string;
  pageCount?: number;
  previewUrl?: string;
}

export interface WorkflowState {
  currentStage: 1 | 2 | 3 | 4 | 5;
  sourceDocuments: SourceDocument[];
  contractData: SaleContractData | null;
  exportDraftData: ExportData | null;
  preShipmentData?: PreShipmentInvoiceData | null;
  shipmentDetails?: ShipmentTransportDetails | null;
  lcDetails: LCDetails | null;
  billOfLading: BillOfLadingFinal | null;
  amendments: LCAmendment[];
  discrepancies: Discrepancy[];
  finalDocuments: FinalDocumentSet | null;
  complianceChecklist: ComplianceChecklist | null;
}
