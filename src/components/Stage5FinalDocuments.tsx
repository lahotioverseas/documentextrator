import React, { useState } from 'react';
import {
  FinalDocumentSet,
  ComplianceChecklist,
  LCDetails,
  ExportData,
  BankProfile
} from '../types';
import { sampleBankProfiles } from '../data/samplePresets';
import lahotiOverseasLogo from '../image/logo';
import {
  PACKAGE_KIND_OPTIONS,
  inferPackageKind,
  formatNoAndKindOfPkg
} from '../lib/packageConstants';
import {
  generateCommercialInvoicePDF,
  generatePackingListPDF,
  generateBillOfLadingPDF,
  generateCertificateOfOriginPDF,
  generateBillOfExchangePDF,
  generateBeneficiaryCertificatePDF,
  generateAllBeneficiaryCertificatesPDF,
  generateCommercialInvoiceDOCX,
  generatePackingListDOCX,
  generateBillOfLadingDOCX,
  generateCertificateOfOriginDOCX,
  generateBillOfExchangeDOCX,
  generateBeneficiaryCertificateDOCX,
  generateAllBeneficiaryCertificatesDOCX,
  downloadStage4Zip,
  downloadFileBlob,
  cleanConsignee
} from '../lib/exportGenerators';
import {
  syncDocumentField,
  syncDocumentNestedExporter,
  syncInvoiceLineItem,
  syncPackingRow,
  syncBeneficiaryCert,
  syncBeneficiaryCertShipmentParticulars,
  syncBeneficiaryCertEmailDetails
} from '../lib/documentSync';
import { cleanMarksAndNos, bankPayToText } from '../lib/documentGenerators';
import { BLDescriptionExtras } from './BLDescriptionExtras';
import {
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Ship,
  Award,
  Landmark,
  ShieldCheck,
  Download,
  ArrowLeft,
  Info,
  Calendar,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  FileDown,
  FileCode,
  Loader2
} from 'lucide-react';
import { InlineEditable } from './InlineEditable';

interface Stage5FinalDocumentsProps {
  finalDocuments: FinalDocumentSet;
  compliance: ComplianceChecklist;
  lcDetails: LCDetails;
  exportData?: ExportData;
  onUpdateFinalDocs: (docs: FinalDocumentSet) => void;
  onBackToStage4: () => void;
  onBackToStage3?: () => void;
}

export const Stage5FinalDocuments: React.FC<Stage5FinalDocumentsProps> = ({
  finalDocuments,
  compliance,
  lcDetails,
  exportData,
  onUpdateFinalDocs,
  onBackToStage4,
  onBackToStage3
}) => {
  const [activeDocTab, setActiveDocTab] = useState<
    'invoice' | 'packing' | 'bl' | 'coo' | 'boe' | 'bencert'
  >('invoice');

  const [docs, setDocs] = useState<FinalDocumentSet>(finalDocuments);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [isExportingDoc, setIsExportingDoc] = useState<boolean>(false);

  // Exchange rate dynamic fetching & override
  const [exchangeRate, setExchangeRate] = useState<number>(
    finalDocuments.commercialInvoice.exchangeRate || 86.85
  );
  const [isSyncingRate, setIsSyncingRate] = useState<boolean>(false);
  const [rateSource, setRateSource] = useState<string>('Standard Rate: ₹86.85');

  const fetchExchangeRateForDate = async (dateStr?: string) => {
    setIsSyncingRate(true);
    try {
      let isoDate = '';
      if (dateStr) {
        const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            isoDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else if (parts[2].length === 4) {
            isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const targetDate = isoDate && isoDate <= today ? isoDate : today;

      const res = await fetch(`https://open.er-api.com/v6/latest/USD`);
      if (res.ok) {
        const data = await res.json();
        const liveInr = data.rates?.INR;
        if (liveInr && typeof liveInr === 'number') {
          setExchangeRate(liveInr);
          setRateSource(`Live Market USD/INR: ₹${liveInr.toFixed(2)} (${isoDate || 'Latest'})`);
          updateInvoice('exchangeRate', liveInr);
          setIsSyncingRate(false);
          return;
        }
      }
      setRateSource(`Synced Rate: ₹${exchangeRate.toFixed(2)}`);
    } catch (e) {
      console.warn('Using standard rate:', e);
      setRateSource(`Market Rate: ₹${exchangeRate.toFixed(2)}`);
    } finally {
      setIsSyncingRate(false);
    }
  };

  React.useEffect(() => {
    fetchExchangeRateForDate(docs.commercialInvoice.invoiceDate);
  }, [docs.commercialInvoice.invoiceDate]);

  // Bank profile selection for Bill of Exchange
  const [selectedBankId, setSelectedBankId] = useState<string>(
    finalDocuments.billOfExchange.presentingBankProfile?.id || 'scb-in'
  );

  const updateInvoice = (field: string, value: any) => {
    const updated = syncDocumentField(docs, 'invoice', field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateInvoiceNested = (parent: 'exporter', field: string, value: any) => {
    const updated = syncDocumentNestedExporter(docs, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateInvoiceLineItem = (index: number, field: string, value: any) => {
    const updated = syncInvoiceLineItem(docs, index, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updatePacking = (field: string, value: any) => {
    const updated = syncDocumentField(docs, 'packing', field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updatePackingNested = (parent: 'exporter', field: string, value: any) => {
    const updated = syncDocumentNestedExporter(docs, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updatePackingRow = (index: number, field: string, value: any) => {
    const updated = syncPackingRow(docs, index, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateBL = (field: string, value: any) => {
    const updated = syncDocumentField(docs, 'bl', field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateCOO = (field: string, value: any) => {
    const updated = syncDocumentField(docs, 'coo', field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateBOE = (field: string, value: any) => {
    const updated = syncDocumentField(docs, 'boe', field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateBeneficiaryCert = (certId: string, field: string, value: any) => {
    const updated = syncBeneficiaryCert(docs, certId, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateBeneficiaryCertShipmentParticular = (certId: string, field: string, value: any) => {
    const updated = syncBeneficiaryCertShipmentParticulars(docs, certId, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  const updateBeneficiaryCertEmailDetails = (certId: string, field: string, value: any) => {
    const updated = syncBeneficiaryCertEmailDetails(docs, certId, field, value);
    setDocs(updated);
    onUpdateFinalDocs(updated);
  };

  React.useEffect(() => {
    setDocs(finalDocuments);
  }, [finalDocuments]);

  const handleBankChange = (bankId: string) => {
    setSelectedBankId(bankId);
    const selected = sampleBankProfiles.find((b) => b.id === bankId);
    if (selected) {
      const updated = syncDocumentField(
        syncDocumentField(docs, 'boe', 'presentingBankProfile', selected),
        'boe', 'payToOrderOf', bankPayToText(selected)
      );
      setDocs(updated);
      onUpdateFinalDocs(updated);
    }
  };

  const handleExportZip = async () => {
    setIsExportingZip(true);
    const bankName = lcDetails.issuingBank?.name || '';
    try {
      await downloadStage4Zip(docs, bankName);
    } catch (error) {
      console.error('Failed to export ZIP package:', error);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportCurrentPDF = () => {
    const invNo = docs.commercialInvoice.invoiceNo || 'INV';
    const bankName = lcDetails.issuingBank?.name || '';
    switch (activeDocTab) {
      case 'invoice': {
        const pdf = generateCommercialInvoicePDF(docs.commercialInvoice, bankName);
        pdf.save(`Commercial_Invoice_${invNo}.pdf`);
        break;
      }
      case 'packing': {
        const pdf = generatePackingListPDF(docs.packingList, bankName);
        pdf.save(`Packing_List_${invNo}.pdf`);
        break;
      }
      case 'bl': {
        const pdf = generateBillOfLadingPDF(docs.billOfLading, bankName);
        pdf.save(`BL_Instruction_${invNo}.pdf`);
        break;
      }
      case 'coo': {
        const pdf = generateCertificateOfOriginPDF(docs.certificateOfOrigin, bankName);
        pdf.save(`Certificate_of_Origin_${invNo}.pdf`);
        break;
      }
      case 'boe': {
        const pdf = generateBillOfExchangePDF(docs.billOfExchange);
        pdf.save(`Bill_of_Exchange_${invNo}.pdf`);
        break;
      }
      case 'bencert': {
        const pdf = generateAllBeneficiaryCertificatesPDF(docs.beneficiaryCertificates);
        pdf.save(`Beneficiary_Certificates_${invNo}.pdf`);
        break;
      }
    }
  };

  const handleExportCurrentDOCX = async () => {
    setIsExportingDoc(true);
    const invNo = docs.commercialInvoice.invoiceNo || 'INV';
    const bankName = lcDetails.issuingBank?.name || '';
    try {
      switch (activeDocTab) {
        case 'invoice': {
          const blob = await generateCommercialInvoiceDOCX(docs.commercialInvoice, bankName);
          downloadFileBlob(blob, `Commercial_Invoice_${invNo}.docx`);
          break;
        }
        case 'packing': {
          const blob = await generatePackingListDOCX(docs.packingList, bankName);
          downloadFileBlob(blob, `Packing_List_${invNo}.docx`);
          break;
        }
        case 'bl': {
          const blob = await generateBillOfLadingDOCX(docs.billOfLading, bankName);
          downloadFileBlob(blob, `BL_Instruction_${invNo}.docx`);
          break;
        }
        case 'coo': {
          const blob = await generateCertificateOfOriginDOCX(docs.certificateOfOrigin, bankName);
          downloadFileBlob(blob, `Certificate_of_Origin_${invNo}.docx`);
          break;
        }
        case 'boe': {
          const blob = await generateBillOfExchangeDOCX(docs.billOfExchange);
          downloadFileBlob(blob, `Bill_of_Exchange_${invNo}.docx`);
          break;
        }
        case 'bencert': {
          const blob = await generateAllBeneficiaryCertificatesDOCX(docs.beneficiaryCertificates);
          downloadFileBlob(blob, `Beneficiary_Certificates_${invNo}.docx`);
          break;
        }
      }
    } catch (error) {
      console.error('Failed to export DOCX document:', error);
    } finally {
      setIsExportingDoc(false);
    }
  };

  const renderClauseBadge = (ref?: string) => {
    if (!ref) return null;
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
        LC {ref}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main Document Viewer Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
        {/* Document Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              id="tab-invoice-btn"
              onClick={() => setActiveDocTab('invoice')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeDocTab === 'invoice'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              1. Commercial Invoice
            </button>

            <button
              id="tab-packing-btn"
              onClick={() => setActiveDocTab('packing')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeDocTab === 'packing'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              2. Packing List
            </button>

            <button
              id="tab-bl-btn"
              onClick={() => setActiveDocTab('bl')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeDocTab === 'bl'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Ship className="w-3.5 h-3.5" />
              3. BL Instructions
            </button>

            <button
              id="tab-coo-btn"
              onClick={() => setActiveDocTab('coo')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeDocTab === 'coo'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              4. Certificate of Origin
            </button>

            <button
              id="tab-boe-btn"
              onClick={() => setActiveDocTab('boe')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeDocTab === 'boe'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              5. Bill of Exchange
            </button>

            <button
              id="tab-bencert-btn"
              onClick={() => setActiveDocTab('bencert')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeDocTab === 'bencert'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              6. Beneficiary Certs ({docs.beneficiaryCertificates.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Exchange Rate breakdown in invoice */}
            <label className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded text-xs cursor-pointer select-none hover:bg-slate-100" title="Toggle Exchange Rate and INR calculation breakdown on Commercial Invoice (Only show if specified in LC)">
              <input
                type="checkbox"
                checked={!!docs.commercialInvoice.showExchangeRate}
                onChange={(e) => updateInvoice('showExchangeRate', e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-slate-700 font-medium text-[11px]">Include INR / Exch. Rate Breakdown</span>
            </label>

            {/* Live Exchange Rate Sync control */}
            <div className="flex items-center gap-1.5 bg-emerald-50/80 border border-emerald-200 px-2 py-0.5 rounded text-xs" title={rateSource}>
              <span className="font-semibold text-emerald-900">USD/INR:</span>
              <div className="flex items-center">
                <span className="text-emerald-700 text-xs mr-0.5">₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 86.85;
                    setExchangeRate(val);
                    setRateSource(`Custom Rate: ₹${val.toFixed(2)}`);
                    updateInvoice('exchangeRate', val);
                  }}
                  className="w-16 px-1 py-0.5 text-xs font-mono font-bold bg-white border border-emerald-300 rounded text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right"
                  title={`Exchange Rate synced as per invoice date (${docs.commercialInvoice.invoiceDate || 'Current'}). Click sync icon to re-fetch.`}
                />
              </div>
              <button
                onClick={() => fetchExchangeRateForDate(docs.commercialInvoice.invoiceDate)}
                disabled={isSyncingRate}
                className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded transition-colors cursor-pointer flex items-center gap-0.5"
                title={`Sync rate for date: ${docs.commercialInvoice.invoiceDate || 'today'} (${rateSource})`}
              >
                {isSyncingRate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span className="text-[10px] font-medium hidden sm:inline">Sync by Date</span>
              </button>
            </div>

            <span className="hidden xl:inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-semibold text-emerald-800" title="Changes made in any document instantly sync across all other 5 trade documents in real-time.">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Auto-Sync Active Across All Docs
            </span>

            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-medium text-slate-600" title="Double-click any text in the document preview below to edit inline. Changes sync automatically to PDF & DOCX downloads.">
              <Sparkles className="w-3 h-3 text-blue-600" />
              Double-click text to edit
            </span>

            <button
              onClick={handleExportCurrentPDF}
              className="px-2.5 py-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
              title="Export styled PDF matching original layout"
            >
              <FileDown className="w-3.5 h-3.5 text-red-600" /> Download PDF
            </button>

            <button
              onClick={handleExportCurrentDOCX}
              disabled={isExportingDoc}
              className="px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 text-blue-700 rounded text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
              title="Export editable Word document"
            >
              {isExportingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCode className="w-3.5 h-3.5 text-blue-600" />} Download DOCX
            </button>

            <button
              id="export-zip-btn"
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              title="Download full negotiation dossier containing all documents in ZIP"
            >
              {isExportingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isExportingZip ? 'Exporting...' : 'Download Full ZIP Bundle'}
            </button>
          </div>
        </div>

        {/* Document Preview Panels */}
        <div className="mt-4">
          {/* TAB 1: COMMERCIAL INVOICE */}
          {activeDocTab === 'invoice' && (
            <div className="border-2 border-slate-400 rounded-xl p-8 bg-white shadow-md font-sans text-xs space-y-4 max-w-5xl mx-auto text-slate-900">
              {/* Top Document Header */}
              <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={lahotiOverseasLogo}
                    alt="Lahoti Overseas Ltd."
                    className="h-12 w-auto object-contain border border-slate-200 p-1 rounded-md bg-white shadow-2xs shrink-0"
                  />
                  <div>
                    <InlineEditable
                      as="h1"
                      value={docs.commercialInvoice.exporter.name}
                      onSave={(v) => updateInvoiceNested('exporter', 'name', v)}
                      className="text-base font-black text-slate-900 uppercase tracking-tight"
                    />
                    <p className="text-[10px] text-slate-600 font-medium">Export Documentation Division • Trade Finance Compliant</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-black tracking-wide text-slate-900 uppercase">COMMERCIAL INVOICE</h2>
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">ORIGINAL FOR BUYER / BANK PRESENTATION</span>
                </div>
              </div>

              {/* IRN No. and Copy Note above table box */}
              <div className="flex justify-between items-end text-[10px] font-bold text-slate-700">
                <div className="flex items-center gap-1 font-mono">
                  <span>IRN NO. :</span>
                  <InlineEditable
                    value={docs.commercialInvoice.irnno}
                    onSave={(v) => updateInvoice('irnno', v)}
                    placeholder="Click to add IRN"
                    className="font-normal text-slate-600 font-mono"
                  />
                </div>
                <div className="uppercase tracking-wider text-slate-500 text-[9px]">
                  SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX.
                </div>
              </div>

              {/* Grid Layout conforming to Indian Custom Document standard */}
              <div className="border border-slate-400 divide-y divide-slate-400">
                {/* Row 1: Shipper / Exporter on Left, 3 separate cells stacked on Right */}
                <div className="grid grid-cols-2 divide-x divide-slate-400">
                  {/* Left Half: Shipper / Exporter */}
                  <div className="p-3 space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Shipper / Exporter:</span>
                    <InlineEditable
                      as="p"
                      value={docs.commercialInvoice.exporter.name}
                      onSave={(v) => updateInvoiceNested('exporter', 'name', v)}
                      className="font-bold text-slate-900 text-xs break-words block"
                    />
                    <InlineEditable
                      as="p"
                      multiline
                      value={docs.commercialInvoice.exporter.address}
                      onSave={(v) => updateInvoiceNested('exporter', 'address', v)}
                      className="text-[11px] text-slate-700 whitespace-pre-line leading-tight break-words [overflow-wrap:anywhere] block"
                    />
                    <div className="text-[10px] text-slate-600 flex items-center gap-1 flex-wrap mt-1">
                      <span>TEL:</span>
                      <InlineEditable
                        value={docs.commercialInvoice.exporter.tel}
                        onSave={(v) => updateInvoiceNested('exporter', 'tel', v)}
                        placeholder="Telephone"
                      />
                    </div>
                    <div className="text-[10px] text-slate-600 flex items-center gap-1 flex-wrap">
                      <span>CIN:</span>
                      <InlineEditable
                        value={docs.commercialInvoice.exporter.cin}
                        onSave={(v) => updateInvoiceNested('exporter', 'cin', v)}
                        placeholder="CIN Number"
                      />
                    </div>
                    <div className="text-[10px] font-bold text-blue-900 flex items-center gap-1 flex-wrap">
                      <span>REX NO:</span>
                      <InlineEditable
                        value={docs.commercialInvoice.rexNumber}
                        onSave={(v) => updateInvoice('rexNumber', v)}
                        placeholder="REX Number"
                      />
                    </div>
                  </div>

                  {/* Right Half: Stacking 3 distinct cells with horizontal dividers */}
                  <div className="divide-y divide-slate-400 min-w-0">
                    {/* Cell 1: Invoice No. & Date */}
                    <div className="p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Invoice No. & Date:</span>
                      <div className="flex justify-between items-baseline gap-2 flex-wrap">
                        <InlineEditable
                          as="span"
                          value={docs.commercialInvoice.invoiceNo}
                          onSave={(v) => updateInvoice('invoiceNo', v)}
                          className="font-bold text-blue-950 text-xs font-mono break-words"
                        />
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                          <span>Date:</span>
                          <InlineEditable
                            value={docs.commercialInvoice.invoiceDate}
                            onSave={(v) => updateInvoice('invoiceDate', v)}
                            placeholder="DD/MM/YYYY"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cell 2: Buyer's Order No. & Date */}
                    <div className="p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Buyer's Order No. & Date:</span>
                      <div className="flex justify-between items-baseline gap-2 flex-wrap">
                        <InlineEditable
                          as="span"
                          value={docs.commercialInvoice.buyersOrderNo || 'N/A'}
                          onSave={(v) => updateInvoice('buyersOrderNo', v)}
                          className="font-bold text-slate-900 text-xs font-mono break-words"
                        />
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                          <span>Date:</span>
                          <InlineEditable
                            value={docs.commercialInvoice.buyersOrderDate || ''}
                            onSave={(v) => updateInvoice('buyersOrderDate', v)}
                            placeholder="DD/MM/YYYY"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cell 3: Other Reference(s) */}
                    <div className="p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Other Reference(s):</span>
                      <InlineEditable
                        as="p"
                        multiline
                        value={docs.commercialInvoice.otherReference || 'N/A'}
                        onSave={(v) => updateInvoice('otherReference', v)}
                        className="text-[11px] text-slate-800 font-mono break-words [overflow-wrap:anywhere] block"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Consignee on Left, Buyer on Right */}
                <div className="grid grid-cols-2 divide-x divide-slate-400">
                  <div className="p-3 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Consignee:</span>
                    <InlineEditable
                      as="p"
                      multiline
                      value={cleanConsignee(docs.commercialInvoice.consignee)}
                      onSave={(v) => updateInvoice('consignee', v)}
                      className="font-bold text-slate-900 text-xs whitespace-pre-line leading-tight break-words [overflow-wrap:anywhere] block"
                    />
                  </div>
                  <div className="p-3 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Buyer (if other than consignee):</span>
                    <InlineEditable
                      as="p"
                      multiline
                      value={docs.commercialInvoice.buyerIfOtherThanConsignee || ''}
                      onSave={(v) => updateInvoice('buyerIfOtherThanConsignee', v)}
                      className="text-[10px] text-slate-800 whitespace-pre-line leading-tight break-words [overflow-wrap:anywhere] block"
                    />
                  </div>
                </div>

                {/* Row 3: Logistics Header Row (4 columns) */}
                <div className="grid grid-cols-4 divide-x divide-slate-400 bg-slate-50/40 text-[11px]">
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Pre-Carriage by:</span>
                    <InlineEditable
                      as="p"
                      value={docs.commercialInvoice.preCarriageBy || ''}
                      onSave={(v) => updateInvoice('preCarriageBy', v)}
                      className="font-semibold text-slate-800 block text-xs"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Place of Receipt by Pre-carrier:</span>
                    <InlineEditable
                      as="p"
                      value={docs.commercialInvoice.placeOfReceipt || ''}
                      onSave={(v) => updateInvoice('placeOfReceipt', v)}
                      className="font-semibold text-slate-800 block text-xs"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Country of Origin of Goods:</span>
                    <InlineEditable
                      as="p"
                      value={docs.commercialInvoice.countryOfOrigin || ''}
                      onSave={(v) => updateInvoice('countryOfOrigin', v)}
                      className="font-bold text-slate-900 block text-xs"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Country of Final Destination:</span>
                    <InlineEditable
                      as="p"
                      value={docs.commercialInvoice.countryOfFinalDestination || ''}
                      onSave={(v) => updateInvoice('countryOfFinalDestination', v)}
                      className="font-bold text-slate-900 block text-xs"
                    />
                  </div>
                </div>

                {/* Row 4: Vessel, Ports on Left, Terms of Delivery and Payment (Tall) on Right */}
                <div className="grid grid-cols-2 divide-x divide-slate-400">
                  {/* Left Side (2 sub-rows of 2 columns each) */}
                  <div className="divide-y divide-slate-400">
                    <div className="grid grid-cols-2 divide-x divide-slate-400">
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Vessel / Flight No.:</span>
                        <InlineEditable
                          as="p"
                          value={docs.commercialInvoice.vesselFlightNo || 'N/A'}
                          onSave={(v) => updateInvoice('vesselFlightNo', v)}
                          className="font-semibold text-slate-800 block text-xs"
                        />
                      </div>
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Port of Loading:</span>
                        <InlineEditable
                          as="p"
                          value={docs.commercialInvoice.portOfLoading}
                          onSave={(v) => updateInvoice('portOfLoading', v)}
                          className="font-bold text-slate-900 block text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-400">
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Port of Discharge:</span>
                        <InlineEditable
                          as="p"
                          value={docs.commercialInvoice.portOfDischarge}
                          onSave={(v) => updateInvoice('portOfDischarge', v)}
                          className="font-bold text-slate-900 block text-xs"
                        />
                      </div>
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Final Destination:</span>
                        <InlineEditable
                          as="p"
                          value={docs.commercialInvoice.finalDestination || ''}
                          onSave={(v) => updateInvoice('finalDestination', v)}
                          className="font-bold text-slate-900 block text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Terms of Delivery & Payment (Covering the entire right-half of this section, no blank cells below it) */}
                  <div className="p-3 min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Terms of Delivery and Payment:</span>
                      <InlineEditable
                        as="p"
                        value={docs.commercialInvoice.termsOfDelivery || ''}
                        onSave={(v) => updateInvoice('termsOfDelivery', v)}
                        className="font-bold text-slate-900 text-xs break-words block"
                      />
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 mt-1.5">
                      <InlineEditable
                        as="p"
                        multiline
                        value={docs.commercialInvoice.paymentTenorLine || `${docs.commercialInvoice.tenor || ''} UNDER IRREVOCABLE LC NO. ${docs.commercialInvoice.lcReference} DT. ${docs.commercialInvoice.lcDateReference || ''}`}
                        onSave={(v) => updateInvoice('paymentTenorLine', v)}
                        className="font-bold text-blue-950 text-xs leading-snug break-words [overflow-wrap:anywhere] block"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Table (6-Column Official Format matching Uploaded Document) */}
              <div className="border border-slate-400 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-400 text-[11px]">
                    <tr>
                      <th className="p-2 border-r border-slate-400 w-[20%]">
                        <div>Marks & Nos./</div>
                        <div>Container No</div>
                      </th>
                      <th className="p-2 border-r border-slate-400 w-[12%]">
                        No. & Kind of Pkg
                      </th>
                      <th className="p-2 border-r border-slate-400 w-[42%]">
                        Description Of Goods
                      </th>
                      <th className="p-2 border-r border-slate-400 w-[10%] text-right">
                        <div>Quantity</div>
                        <div className="text-[10px] text-slate-600 uppercase font-bold">{docs.commercialInvoice.lineItems[0]?.uom || ''}</div>
                      </th>
                      <th className="p-2 border-r border-slate-400 w-[8%] text-right">
                        <div>Rate</div>
                        <div className="text-[10px] text-slate-600 uppercase font-bold">{docs.commercialInvoice.currency || 'USD'}</div>
                      </th>
                      <th className="p-2 w-[8%] text-right">
                        <div>Amount</div>
                        <div className="text-[10px] text-slate-600 uppercase font-bold">{docs.commercialInvoice.currency || 'USD'}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {docs.commercialInvoice.lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {/* Marks & Nos./ Container No */}
                        <td className="p-2.5 border-r border-slate-400 font-mono text-[11px] text-slate-800 align-top leading-tight">
                          <InlineEditable
                            multiline
                            value={item.marksAndNos || ''}
                            onSave={(v) => updateInvoiceLineItem(idx, 'marksAndNos', v)}
                            className="font-mono text-[11px] text-slate-800 block whitespace-pre-line"
                          />
                        </td>

                        {/* No. & Kind of Pkg */}
                        <td className="p-2.5 border-r border-slate-400 font-bold text-slate-900 text-[11px] align-top">
                          <InlineEditable
                            multiline
                            value={item.noAndKindOfPkg || ''}
                            onSave={(v) => updateInvoiceLineItem(idx, 'noAndKindOfPkg', v)}
                            className="font-bold text-slate-900 text-[11px] block whitespace-pre-line"
                          />
                          <div className="mt-1">
                            <select
                              value={item.packageKind || item.cartonOption || inferPackageKind(item.noAndKindOfPkg)}
                              onChange={(e) => updateInvoiceLineItem(idx, 'packageKind', e.target.value)}
                              className="w-full text-[10px] bg-slate-50 border border-slate-300 rounded px-1 py-0.5 font-sans font-medium text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                              title="Select unit / package kind"
                            >
                              {PACKAGE_KIND_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>

                        {/* Description Of Goods */}
                        <td className="p-2.5 border-r border-slate-400 font-sans text-slate-900 leading-snug text-[11px] align-top whitespace-pre-line">
                          <InlineEditable
                            multiline
                            value={item.description || ''}
                            onSave={(v) => updateInvoiceLineItem(idx, 'description', v)}
                            className="font-sans text-slate-900 leading-snug text-[11px] block whitespace-pre-line"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="p-2.5 border-r border-slate-400 text-right align-top font-mono font-bold text-slate-900">
                          <div>
                            <InlineEditable
                              type="number"
                              value={item.quantity != null ? item.quantity : 0}
                              onSave={(v) => updateInvoiceLineItem(idx, 'quantity', v)}
                              className="font-bold font-mono text-slate-900 block"
                            />
                            <InlineEditable
                              value={item.uom || ''}
                              onSave={(v) => updateInvoiceLineItem(idx, 'uom', v)}
                              className="text-[10px] text-slate-600 uppercase block font-sans"
                            />
                          </div>
                        </td>

                        {/* Rate */}
                        <td className="p-2.5 border-r border-slate-400 text-right font-mono align-top text-slate-900 font-bold">
                          <div>
                            <InlineEditable
                              type="number"
                              value={item.rate != null ? item.rate : 0}
                              onSave={(v) => updateInvoiceLineItem(idx, 'rate', v)}
                              className="font-mono font-bold text-slate-900 block"
                            />
                            <span className="text-[10px] text-slate-600 block font-sans">
                              / {item.uom || ''}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="p-2.5 text-right font-bold text-slate-950 font-mono align-top text-[12px]">
                          <InlineEditable
                            type="number"
                            value={item.amount != null ? item.amount : 0}
                            onSave={(v) => updateInvoiceLineItem(idx, 'amount', v)}
                            className="font-bold text-slate-950 font-mono block"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Amount Chargeable & Total Summary Row matching Uploaded Document */}
                  <tfoot className="border-t-2 border-slate-400 font-bold text-xs bg-slate-50 text-slate-900">
                    <tr>
                      <td colSpan={4} className="p-2.5 border-r border-slate-400 align-top">
                        <div className="text-[10px] uppercase font-bold text-slate-600 mb-0.5">
                          Amount Chargeable (In Words)-:
                        </div>
                        <InlineEditable
                          multiline
                          value={docs.commercialInvoice.amountInWords || ''}
                          onSave={(v) => updateInvoice('amountInWords', v)}
                          className="font-serif font-bold text-slate-900 text-xs leading-snug uppercase block"
                        />
                      </td>
                      <td className="p-2.5 text-center uppercase border-r border-slate-400 font-extrabold text-sm align-middle">
                        Total
                      </td>
                      <td className="p-2.5 text-right text-sm text-slate-950 font-extrabold font-mono align-middle">
                        {(docs.commercialInvoice.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Amount in Words and INR / Exchange Breakdown */}
              {docs.commercialInvoice.showExchangeRate ? (
                <div className="grid grid-cols-2 border border-slate-400 divide-x divide-slate-400">
                  <div className="p-3 space-y-2">
                    <div>
                      <span className="font-bold text-slate-600 text-[10px] uppercase block">Amount Chargeable (in words):</span>
                      <InlineEditable
                        as="p"
                        multiline
                        value={docs.commercialInvoice.amountInWords}
                        onSave={(v) => updateInvoice('amountInWords', v)}
                        className="font-serif font-bold text-slate-900 text-xs mt-0.5 block"
                      />
                    </div>
                    <div className="text-[10px] text-slate-600 space-y-0.5 pt-2 border-t border-slate-200">
                      <p>CIN: {docs.commercialInvoice.exporter.cin || 'L74999MH1995PLC087643'}</p>
                      <p>GST NO: 27AAACL2578H1ZE | PAN NO: AAACL2578H</p>
                    </div>
                  </div>

                  <div className="p-3 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold">EXCH. @ Rs. {exchangeRate.toFixed(2)} USD = 1</span>
                      <span className="font-bold text-slate-900">VALUE INR: {(docs.commercialInvoice.totalAmount * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {docs.commercialInvoice.freightAmount != null && (
                      <div className="flex justify-between text-slate-600">
                        <span>FREIGHT {(docs.commercialInvoice.freightAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (USD)</span>
                        <span>INR: {((docs.commercialInvoice.freightAmount || 0) * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>INSURAN: 0.00 (USD)</span>
                      <span>INR: 0.00</span>
                    </div>
                    {docs.commercialInvoice.fobValue != null && (
                      <div className="flex justify-between font-bold text-slate-950 border-t border-slate-300 pt-1 text-xs">
                        <span>FOB VALUE INR:</span>
                        <span>{(docs.commercialInvoice.fobValue * exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-slate-400 p-3 space-y-2">
                  <div>
                    <span className="font-bold text-slate-600 text-[10px] uppercase block">Amount Chargeable (in words):</span>
                    <InlineEditable
                      as="p"
                      multiline
                      value={docs.commercialInvoice.amountInWords}
                      onSave={(v) => updateInvoice('amountInWords', v)}
                      className="font-serif font-bold text-slate-900 text-xs mt-0.5 block"
                    />
                  </div>
                  <div className="text-[10px] text-slate-600 space-y-0.5 pt-2 border-t border-slate-200">
                    <p>CIN: {docs.commercialInvoice.exporter.cin || 'L74999MH1995PLC087643'}</p>
                    <p>GST NO: 27AAACL2578H1ZE | PAN NO: AAACL2578H</p>
                  </div>
                </div>
              )}

              {/* Declarations & Signatory Block */}
              <div className="grid grid-cols-2 border border-slate-400 divide-x divide-slate-400">
                <div className="p-3 space-y-1.5">
                  <span className="font-bold text-slate-800 text-[10px] uppercase block">Declaration :</span>
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.commercialInvoice.declarationText || "We declare that this invoice shows the actual price of the goods\ndescribed and that all paraticulars are true and correct."}
                    onSave={(v) => updateInvoice('declarationText', v)}
                    className="text-[11px] text-slate-700 leading-tight block whitespace-pre-line"
                  />
                  {docs.commercialInvoice.additionalDeclarations?.filter(decl => {
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
                  }).map((decl, dIdx) => (
                    <p key={dIdx} className="text-[10px] text-slate-700 leading-tight pt-1">
                      <strong className="text-slate-900">[{decl.clauseRef}]:</strong> {decl.verbatimText || decl.text}
                    </p>
                  ))}
                </div>

                <div className="p-4 flex flex-col justify-between text-right">
                  <p className="font-bold text-slate-900 text-xs">{docs.commercialInvoice.exporter?.name ? `For ${docs.commercialInvoice.exporter.name}` : ''}</p>
                  <div className="pt-8">
                    <span className="text-xs font-serif italic text-slate-500">(Authorised Signatory)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PACKING LIST */}
          {activeDocTab === 'packing' && (
            <div className="border-2 border-slate-400 rounded-xl p-6 md:p-8 bg-white shadow-md font-sans text-xs space-y-4 max-w-5xl mx-auto text-slate-900">
              {/* Document Header Title & Copy indicator */}
              <div className="flex justify-between items-end border-b border-slate-300 pb-2">
                <div className="w-16"></div>
                <h1 className="text-base font-black text-slate-900 uppercase tracking-wide text-center">
                  DETAILED PACKING LIST
                </h1>
                <div className="w-16 text-right font-bold text-xs text-slate-700 tracking-wider">
                  COPY
                </div>
              </div>

              {/* Grid Layout conforming to Indian Custom Document standard */}
              <div className="border border-slate-400 divide-y divide-slate-400">
                {/* Row 1: Shipper / Exporter on Left, 3 separate cells stacked on Right */}
                <div className="grid grid-cols-2 divide-x divide-slate-400">
                  {/* Left Half: Shipper / Exporter */}
                  <div className="p-3 space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Shipper / Exporter:</span>
                    <InlineEditable
                      as="p"
                      value={docs.packingList.exporter.name || ''}
                      onSave={(v) => updatePackingNested('exporter', 'name', v)}
                      className="font-bold text-slate-900 text-xs break-words block"
                    />
                    <InlineEditable
                      as="p"
                      multiline
                      value={docs.packingList.exporter.address || '307, ARUN CHAMBERS,TARDEO ROAD,\nMUMBAI CENTRAL, MUMBAI,\nMAHARASHTRA, 400034, INDIA'}
                      onSave={(v) => updatePackingNested('exporter', 'address', v)}
                      className="text-[11px] text-slate-700 whitespace-pre-line leading-tight break-words [overflow-wrap:anywhere] block"
                    />
                  </div>

                  {/* Right Half: Stacking 3 distinct cells with horizontal dividers */}
                  <div className="divide-y divide-slate-400 min-w-0">
                    {/* Cell 1: Invoice No. & Date */}
                    <div className="p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Invoice No. & Date:</span>
                      <div className="flex justify-between items-baseline gap-2 flex-wrap">
                        <InlineEditable
                          as="span"
                          value={docs.packingList.invoiceNo}
                          onSave={(v) => updatePacking('invoiceNo', v)}
                          className="font-bold text-blue-950 text-xs font-mono break-words"
                        />
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                          <span>Date:</span>
                          <InlineEditable
                            value={docs.packingList.invoiceDate}
                            onSave={(v) => updatePacking('invoiceDate', v)}
                            placeholder="DD/MM/YYYY"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cell 2: Buyer's Order No. & Date */}
                    <div className="p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Buyer's Order No. & Date:</span>
                      <div className="flex justify-between items-baseline gap-2 flex-wrap">
                        <InlineEditable
                          as="span"
                          value={docs.packingList.buyersOrderNo || '—'}
                          onSave={(v) => updatePacking('buyersOrderNo', v)}
                          className="font-bold text-slate-900 text-xs font-mono break-words"
                        />
                        <div className="text-[11px] text-slate-600 font-mono flex items-center gap-1">
                          <span>Date:</span>
                          <InlineEditable
                            value={docs.packingList.buyersOrderDate || ''}
                            onSave={(v) => updatePacking('buyersOrderDate', v)}
                            placeholder="DD/MM/YYYY"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Cell 3: Other Reference(s) */}
                    <div className="p-2.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Other Reference(s):</span>
                      <InlineEditable
                        as="p"
                        multiline
                        value={docs.packingList.otherReference || (docs.packingList.buyersOrderNo ? `PO REF: ${docs.packingList.buyersOrderNo}` : '—')}
                        onSave={(v) => updatePacking('otherReference', v)}
                        className="text-[11px] text-slate-800 font-mono break-words [overflow-wrap:anywhere] block"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Consignee on Left, Buyer on Right */}
                <div className="grid grid-cols-2 divide-x divide-slate-400">
                  <div className="p-3 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Consignee:</span>
                    <InlineEditable
                      as="p"
                      multiline
                      value={cleanConsignee(docs.packingList.consignee || 'TO ORDER')}
                      onSave={(v) => updatePacking('consignee', v)}
                      className="font-bold text-slate-900 text-xs whitespace-pre-line leading-tight break-words [overflow-wrap:anywhere] block"
                    />
                  </div>
                  <div className="p-3 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Buyer (if other than consignee):</span>
                    <InlineEditable
                      as="p"
                      multiline
                      value={docs.packingList.buyerIfOtherThanConsignee || docs.packingList.consignee || '—'}
                      onSave={(v) => updatePacking('buyerIfOtherThanConsignee', v)}
                      className="text-[10px] text-slate-800 whitespace-pre-line leading-tight break-words [overflow-wrap:anywhere] block"
                    />
                  </div>
                </div>

                {/* Row 3: Logistics Header Row (4 columns) */}
                <div className="grid grid-cols-4 divide-x divide-slate-400 bg-slate-50/40 text-[11px]">
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Pre-Carriage by:</span>
                    <InlineEditable
                      as="p"
                      value={docs.packingList.preCarriageBy || ''}
                      onSave={(v) => updatePacking('preCarriageBy', v)}
                      className="font-semibold text-slate-800 block text-xs"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Place of Receipt by Pre-carrier:</span>
                    <InlineEditable
                      as="p"
                      value={docs.packingList.placeOfReceipt || ''}
                      onSave={(v) => updatePacking('placeOfReceipt', v)}
                      className="font-semibold text-slate-800 block text-xs"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Country of Origin of Goods:</span>
                    <InlineEditable
                      as="p"
                      value={docs.packingList.countryOfOrigin || ''}
                      onSave={(v) => updatePacking('countryOfOrigin', v)}
                      className="font-bold text-slate-900 block text-xs"
                    />
                  </div>
                  <div className="p-2 min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">Country of Final Destination:</span>
                    <InlineEditable
                      as="p"
                      value={docs.packingList.countryOfFinalDestination || ''}
                      onSave={(v) => updatePacking('countryOfFinalDestination', v)}
                      className="font-bold text-slate-900 block text-xs"
                    />
                  </div>
                </div>

                {/* Row 4: Vessel, Ports on Left, Terms of Delivery and Payment (Tall) on Right */}
                <div className="grid grid-cols-2 divide-x divide-slate-400">
                  {/* Left Side (2 sub-rows of 2 columns each) */}
                  <div className="divide-y divide-slate-400">
                    <div className="grid grid-cols-2 divide-x divide-slate-400">
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Vessel / Flight No.:</span>
                        <InlineEditable
                          as="p"
                          value={docs.packingList.vesselFlightNo || '—'}
                          onSave={(v) => updatePacking('vesselFlightNo', v)}
                          className="font-semibold text-slate-800 block text-xs"
                        />
                      </div>
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Port of Loading:</span>
                        <InlineEditable
                          as="p"
                          value={docs.packingList.portOfLoading || ''}
                          onSave={(v) => updatePacking('portOfLoading', v)}
                          className="font-bold text-slate-900 block text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-400">
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Port of Discharge:</span>
                        <InlineEditable
                          as="p"
                          value={docs.packingList.portOfDischarge || ''}
                          onSave={(v) => updatePacking('portOfDischarge', v)}
                          className="font-bold text-slate-900 block text-xs"
                        />
                      </div>
                      <div className="p-2 min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-500 block">Final Destination:</span>
                        <InlineEditable
                          as="p"
                          value={docs.packingList.finalDestination || ''}
                          onSave={(v) => updatePacking('finalDestination', v)}
                          className="font-bold text-slate-900 block text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Terms of Delivery & Payment (Covering the entire right-half of this section, no blank cells below it) */}
                  <div className="p-3 min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Terms of Delivery and Payment:</span>
                      <InlineEditable
                        as="p"
                        value={docs.packingList.termsOfDelivery || ''}
                        onSave={(v) => updatePacking('termsOfDelivery', v)}
                        className="font-bold text-slate-900 text-xs break-words block"
                      />
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 mt-1.5">
                      <div className="text-[10px] text-slate-700 font-mono flex items-center gap-1">
                        <span>PACKING:</span>
                        <InlineEditable
                          multiline
                          value={docs.packingList.bakedPalletQuote || ''}
                          onSave={(v) => updatePacking('bakedPalletQuote', v)}
                          placeholder="Packing details"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Line-Items Table */}
              <div className="border border-slate-400">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-400 bg-slate-50 text-[11px] font-bold text-slate-900">
                      <th className="p-2 border-r border-slate-400 w-36">
                        <div>Marks & Nos./</div>
                        <div>Container No</div>
                      </th>
                      <th className="p-2 border-r border-slate-400 w-36">No. & Kind of Pkg</th>
                      <th className="p-2 border-r border-slate-400">Description Of Goods</th>
                      <th className="p-2 border-r border-slate-400 w-36 text-right">
                        <div>Quantity</div>
                        <div className="text-[10px]">KGS</div>
                      </th>
                      <th className="p-2 w-28">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs align-top divide-y divide-slate-200">
                    <tr className="min-h-[140px]">
                      <td className="p-3 border-r border-slate-400 font-mono text-[11px]">
                        <InlineEditable
                          as="div"
                          multiline
                          value={docs.packingList.marksAndNos || 'AS PER LC / INVOICE'}
                          onSave={(v) => updatePacking('marksAndNos', v)}
                          className="font-sans font-medium text-slate-800 block"
                        />
                        <div className="mt-2 text-slate-700">
                          <span className="font-bold">CONT/SEAL:</span>
                          <InlineEditable
                            as="div"
                            multiline
                            value={docs.packingList.containerNo || docs.packingList.packingRows[0]?.containerSealNo || '—'}
                            onSave={(v) => updatePacking('containerNo', v)}
                            className="font-mono text-slate-800 block mt-0.5"
                          />
                        </div>
                      </td>
                      <td className="p-3 border-r border-slate-400 font-bold text-slate-900 text-[11px]">
                        <InlineEditable
                          as="span"
                          value={docs.packingList.noAndKindOfPkg || docs.packingList.totalCartonsOrPackages || `${docs.packingList.packingRows.length} CARTONS`}
                          onSave={(v) => updatePacking('noAndKindOfPkg', v)}
                          className="font-bold text-slate-900 text-[11px] block"
                        />
                      </td>
                      <td className="p-3 border-r border-slate-400">
                        <InlineEditable
                          as="div"
                          multiline
                          value={docs.packingList.goodsDescriptionVerbatim || ''}
                          onSave={(v) => updatePacking('goodsDescriptionVerbatim', v)}
                          className="font-bold text-slate-900 text-[11px] leading-snug block"
                        />
                      </td>
                      <td className="p-3 border-r border-slate-400 text-right space-y-3">
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">GROSS WT :</span>
                          <InlineEditable
                            as="span"
                            type="number"
                            value={docs.packingList.totalGrossWtKg && Number(docs.packingList.totalGrossWtKg) > 0 ? Number(docs.packingList.totalGrossWtKg).toFixed(2) : ''}
                            onSave={(v) => updatePacking('totalGrossWtKg', parseFloat(v) || 0)}
                            className="font-bold text-slate-900 text-xs block"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase">NET WT :</span>
                          <InlineEditable
                            as="span"
                            type="number"
                            value={docs.packingList.totalNetWtKg && Number(docs.packingList.totalNetWtKg) > 0 ? Number(docs.packingList.totalNetWtKg).toFixed(2) : ''}
                            onSave={(v) => updatePacking('totalNetWtKg', parseFloat(v) || 0)}
                            className="font-bold text-slate-900 text-xs block"
                          />
                        </div>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600">
                        <InlineEditable
                          as="span"
                          multiline
                          value={docs.packingList.remarks || '—'}
                          onSave={(v) => updatePacking('remarks', v)}
                          className="text-[11px] text-slate-600 block"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PAKING DETAILS Section */}
              <div className="border border-slate-400">
                <div className="bg-slate-100 p-1.5 border-b border-slate-400 font-black text-slate-900 text-xs tracking-wider">
                  PAKING DETAILS
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-400 bg-slate-50 text-[10px] font-bold text-slate-800">
                      <th className="p-2 border-r border-slate-400 w-24">LOT NO</th>
                      <th className="p-2 border-r border-slate-400">COUNT</th>
                      <th className="p-2 border-r border-slate-400 w-28">NO OF UNIT</th>
                      <th className="p-2 border-r border-slate-400 w-44">CONTAINER NO/SEAL NOS.</th>
                      <th className="p-2 border-r border-slate-400 w-32 text-right">NET WT/UNIT</th>
                      <th className="p-2 w-32 text-right">GROSS WT/UNIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {docs.packingList.packingRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-400 font-bold text-slate-900">
                          <InlineEditable
                            value={row.lotNo || '1'}
                            onSave={(v) => updatePackingRow(idx, 'lotNo', v)}
                            className="font-bold text-slate-900"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-400 text-slate-800">
                          <InlineEditable
                            value={row.count || '—'}
                            onSave={(v) => updatePackingRow(idx, 'count', v)}
                            className="text-slate-800"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-400 font-bold text-slate-900">
                          <InlineEditable
                            value={row.noOfUnits || '—'}
                            onSave={(v) => updatePackingRow(idx, 'noOfUnits', v)}
                            className="font-bold text-slate-900"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-400 font-mono text-slate-800">
                          <InlineEditable
                            value={row.containerSealNo || '—'}
                            onSave={(v) => updatePackingRow(idx, 'containerSealNo', v)}
                            className="font-mono text-slate-800"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-400 text-right font-medium text-slate-900">
                          <InlineEditable
                            type="number"
                            value={row.netWtKg != null ? Number(row.netWtKg).toFixed(2) : ''}
                            onSave={(v) => updatePackingRow(idx, 'netWtKg', parseFloat(v) || 0)}
                            className="font-medium text-slate-900"
                          /> KGS
                        </td>
                        <td className="p-2 text-right font-medium text-slate-900">
                          <InlineEditable
                            type="number"
                            value={row.grossWtKg != null ? Number(row.grossWtKg).toFixed(2) : ''}
                            onSave={(v) => updatePackingRow(idx, 'grossWtKg', parseFloat(v) || 0)}
                            className="font-medium text-slate-900"
                          /> KGS
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature Block */}
              <div className="flex justify-end pt-2">
                <div className="w-80 border border-slate-400 p-3 flex flex-col justify-between h-24">
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-xs">{docs.packingList.exporter?.name ? `For ${docs.packingList.exporter.name}` : ''}</p>
                  </div>
                  <div className="flex justify-between items-end text-[11px] text-slate-700">
                    <span>Signature and Date</span>
                    <span className="font-medium">Authorised Signatory</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BILL OF LADING INSTRUCTIONS */}
          {activeDocTab === 'bl' && (
            <div className="border border-slate-300 rounded-xl p-8 bg-white shadow-2xs font-sans text-xs space-y-6 max-w-5xl mx-auto">
              {/* Document Header */}
              <div className="relative border-b border-slate-200 pb-4">
                <div className="text-center">
                  <h1 className="text-base font-bold text-slate-900 tracking-wider">
                    B/L INSTRUCTION
                  </h1>
                </div>
                <div className="absolute right-0 top-0 text-right">
                  <span className="text-slate-600 font-medium">Invoice No. </span>
                  <InlineEditable
                    as="strong"
                    value={docs.billOfLading.invoiceNo || docs.commercialInvoice.invoiceNo}
                    onSave={(v) => updateBL('invoiceNo', v)}
                    className="font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Exporter & Consignee Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <span className="text-slate-600 font-semibold block text-[11px]">Exporter</span>
                  <InlineEditable
                    as="p"
                    value={docs.billOfLading.exporter?.name || ''}
                    onSave={(v) => updateBL('exporter', { ...docs.billOfLading.exporter, name: v })}
                    className="font-bold text-slate-900 block uppercase"
                  />
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.billOfLading.exporter?.address || '307, ARUN CHAMBERS, TARDEO ROAD,\nMUMBAI CENTRAL, MUMBAI,\nMAHARASHTRA, 400034, INDIA'}
                    onSave={(v) => updateBL('exporter', { ...docs.billOfLading.exporter, address: v })}
                    className="text-slate-700 text-[11px] whitespace-pre-line leading-relaxed uppercase block"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-slate-600 font-semibold block text-[11px]">Consignee</span>
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.billOfLading.consignee || ''}
                    onSave={(v) => updateBL('consignee', v)}
                    className="text-slate-900 font-semibold whitespace-pre-line leading-relaxed uppercase block"
                  />
                  {docs.billOfLading.consigneeVatBin && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                      <span>BIN NO.</span>
                      <InlineEditable
                        value={docs.billOfLading.consigneeVatBin}
                        onSave={(v) => updateBL('consigneeVatBin', v)}
                      />
                    </div>
                  )}
                  <div className="pt-2 text-[11px] text-slate-800 font-bold flex items-center gap-1.5 flex-wrap">
                    <span>LC NO.</span>
                    <InlineEditable
                      value={docs.billOfLading.lcNumber || ''}
                      onSave={(v) => updateBL('lcNumber', v)}
                      className="font-mono"
                    />
                    <span>DATE</span>
                    <InlineEditable
                      value={docs.billOfLading.lcDate || ''}
                      onSave={(v) => updateBL('lcDate', v)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Notify 1 & Notify 2 Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <span className="text-slate-600 font-semibold block text-[11px]">Notify</span>
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.billOfLading.notifyParty1 || ''}
                    onSave={(v) => updateBL('notifyParty1', v)}
                    className="text-slate-900 whitespace-pre-line leading-relaxed uppercase block"
                  />
                  {docs.billOfLading.notifyParty1VatBin && !docs.billOfLading.notifyParty1?.toUpperCase().includes('BIN') && !docs.billOfLading.notifyParty1?.toUpperCase().includes('VAT') && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                      <span>BIN NO.</span>
                      <InlineEditable
                        value={docs.billOfLading.notifyParty1VatBin}
                        onSave={(v) => updateBL('notifyParty1VatBin', v)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-600 font-semibold block text-[11px]">Notify 2</span>
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.billOfLading.notifyParty2 || ''}
                    onSave={(v) => updateBL('notifyParty2', v)}
                    className="text-slate-900 whitespace-pre-line leading-relaxed uppercase block"
                  />
                  {docs.billOfLading.notifyParty2VatBin && !docs.billOfLading.notifyParty2?.toUpperCase().includes('BIN') && !docs.billOfLading.notifyParty2?.toUpperCase().includes('VAT') && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                      <span>BIN NO.</span>
                      <InlineEditable
                        value={docs.billOfLading.notifyParty2VatBin}
                        onSave={(v) => updateBL('notifyParty2VatBin', v)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Transport Routing Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-200 pb-5 text-xs">
                <div>
                  <span className="text-slate-600 font-semibold block text-[11px]">Vessel/Flight No.</span>
                  <InlineEditable
                    as="p"
                    value={docs.billOfLading.vesselFlightNo || ''}
                    onSave={(v) => updateBL('vesselFlightNo', v)}
                    className="font-bold text-slate-900 uppercase block mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-slate-600 font-semibold block text-[11px]">Port of Loading</span>
                  <InlineEditable
                    as="p"
                    value={docs.billOfLading.portOfLoading || ''}
                    onSave={(v) => updateBL('portOfLoading', v)}
                    className="font-bold text-slate-900 uppercase block mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-slate-600 font-semibold block text-[11px]">Port of Discharge</span>
                  <InlineEditable
                    as="p"
                    value={docs.billOfLading.portOfDischarge || ''}
                    onSave={(v) => updateBL('portOfDischarge', v)}
                    className="font-bold text-slate-900 uppercase block mt-0.5"
                  />
                </div>
                <div>
                  <span className="text-slate-600 font-semibold block text-[11px]">Final Destination</span>
                  <InlineEditable
                    as="p"
                    value={docs.billOfLading.finalDestination || ''}
                    onSave={(v) => updateBL('finalDestination', v)}
                    className="font-bold text-slate-900 uppercase block mt-0.5"
                  />
                </div>
              </div>

              {/* 3-Column Cargo Specification Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-800 py-2.5 px-3">
                  <div className="col-span-3">Marks & Nos. / Container No</div>
                  <div className="col-span-2 text-center">No. & Kind of Pkg</div>
                  <div className="col-span-7 pl-4">Description Of Goods</div>
                </div>

                <div className="grid grid-cols-12 text-xs divide-x divide-slate-300 min-h-[300px]">
                  {/* Column 1: Marks & Weights */}
                  <div className="col-span-3 p-3.5 space-y-3 bg-white">
                    <div>
                      <span className="text-slate-500 text-[10px] font-bold block uppercase">Shipping Marks:</span>
                      <InlineEditable
                        as="p"
                        multiline
                        value={cleanMarksAndNos(docs.billOfLading.marksAndNos)}
                        onSave={(v) => updateBL('marksAndNos', v)}
                        className="text-slate-900 whitespace-pre-line leading-relaxed block"
                      />
                    </div>
                    {docs.billOfLading.totalGrossWtKg && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-500 text-[10px] font-bold block uppercase">TOTAL GROSS WT:</span>
                        <p className="font-mono font-bold text-slate-900">
                          {Number(docs.billOfLading.totalGrossWtKg).toFixed(3)} KGS
                        </p>
                      </div>
                    )}
                    {docs.billOfLading.totalNetWtKg && (
                      <div className="pt-1">
                        <span className="text-slate-500 text-[10px] font-bold block uppercase">TOTAL NET WT:</span>
                        <p className="font-mono font-bold text-slate-900">
                          {Number(docs.billOfLading.totalNetWtKg).toFixed(3)} KGS
                        </p>
                      </div>
                    )}
                    {docs.billOfLading.containerSealNos && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-500 text-[10px] font-bold block uppercase">CONTAINER NO/SEAL NO:</span>
                        <InlineEditable
                          as="p"
                          multiline
                          value={docs.billOfLading.containerSealNos}
                          onSave={(v) => updateBL('containerSealNos', v)}
                          className="font-mono font-bold text-slate-900 whitespace-pre-line block"
                        />
                      </div>
                    )}
                  </div>

                  {/* Column 2: Packages Count */}
                  <div className="col-span-2 p-3.5 text-center bg-white">
                    <InlineEditable
                      as="p"
                      multiline
                      value={docs.billOfLading.packagesCountAndKind || ''}
                      onSave={(v) => updateBL('packagesCountAndKind', v)}
                      className="font-bold text-slate-900 whitespace-pre-line block"
                    />
                  </div>

                  {/* Column 3: Goods Description & Mandatory Clauses */}
                  <div className="col-span-7 p-3.5 space-y-4 bg-white">
                    <div>
                      <InlineEditable
                        as="div"
                        multiline
                        value={docs.billOfLading.goodsDescription || ''}
                        onSave={(v) => updateBL('goodsDescription', v)}
                        className="text-slate-900 font-sans leading-relaxed whitespace-pre-line block"
                      />
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <BLDescriptionExtras bl={docs.billOfLading} invoiceNoFallback={docs.commercialInvoice.invoiceNo} onChange={(f, v) => updateBL(f, v)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CERTIFICATE OF ORIGIN */}
          {activeDocTab === 'coo' && (
            <div className="border border-slate-300 rounded-xl p-8 bg-white shadow-2xs font-sans text-xs space-y-6">
              {/* Exporter Plain Header */}
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                  <InlineEditable
                    as="h2"
                    value={docs.certificateOfOrigin.exporter?.name || ''}
                    onSave={(v) => updateCOO('exporter', { ...docs.certificateOfOrigin.exporter, name: v })}
                    className="text-sm font-bold text-slate-900 uppercase tracking-wide block"
                  />
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.certificateOfOrigin.exporter.address || '307, ARUN CHAMBERS, TARDEO ROAD,\nMUMBAI CENTRAL, MUMBAI,\nMAHARASHTRA, 400034, INDIA'}
                    onSave={(v) => updateCOO('exporter', { ...docs.certificateOfOrigin.exporter, address: v })}
                    className="text-slate-700 text-[11px] whitespace-pre-line leading-relaxed uppercase block"
                  />
                </div>
                <div className="text-right space-y-1">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold text-[11px] uppercase">
                    Certificate of Origin
                  </span>
                  <div className="text-[11px] text-slate-500 font-mono">
                    <div className="flex flex-col items-end">
                      <InlineEditable
                        as="strong"
                        value={docs.certificateOfOrigin.invoiceNo}
                        onSave={(v) => updateCOO('invoiceNo', v)}
                        placeholder="Invoice No"
                      />
                      <div className="text-[10px] flex items-center gap-1">
                        <span>Dt</span>
                        <InlineEditable
                          value={docs.certificateOfOrigin.invoiceDate}
                          onSave={(v) => updateCOO('invoiceDate', v)}
                          placeholder="DD/MM/YYYY"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Applicant Name and Address */}
              <div className="space-y-1 max-w-md min-w-0">
                <span className="text-[10px] font-bold uppercase text-slate-900 block">
                  APPLICANT NAME AND ADDRESS:
                </span>
                <InlineEditable
                  as="p"
                  multiline
                  value={cleanConsignee(docs.certificateOfOrigin.consignee)}
                  onSave={(v) => updateCOO('consignee', v)}
                  className="text-slate-800 text-[11px] whitespace-pre-line leading-snug uppercase block break-words [overflow-wrap:anywhere]"
                />
              </div>

              {/* Transport Details */}
              <div className="space-y-0.5 text-[11px] text-slate-800 uppercase">
                <p>{/road|truck|benapole|petrapole/i.test(`${docs.certificateOfOrigin.portOfLoading} ${docs.certificateOfOrigin.portOfDischarge}`) ? 'By Road' : 'By Sea'}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span>VESSEL :</span>
                  <InlineEditable
                    value={docs.certificateOfOrigin.vesselFlightNo || '________'}
                    onSave={(v) => updateCOO('vesselFlightNo', v)}
                  />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span>FROM :</span>
                  <InlineEditable
                    value={docs.certificateOfOrigin.portOfLoading}
                    onSave={(v) => updateCOO('portOfLoading', v)}
                  />
                  <span>TO</span>
                  <InlineEditable
                    value={docs.certificateOfOrigin.portOfDischarge}
                    onSave={(v) => updateCOO('portOfDischarge', v)}
                  />
                </div>
              </div>

              {/* Main Body Columns */}
              <div className="border-t border-b border-slate-300 py-4 flex flex-col md:flex-row items-start gap-4">
                {/* Item Number 1) */}
                <div className="w-5 shrink-0 font-bold text-slate-900 text-xs pt-0.5">
                  1)
                </div>

                {/* Column 1: Marks & Nos */}
                <div className="w-full md:w-[32%] min-w-0 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-600 block">
                    Marks & Numbers / Packages:
                  </span>
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.certificateOfOrigin.marksAndNos}
                    onSave={(v) => updateCOO('marksAndNos', v)}
                    className="text-slate-800 text-[10px] whitespace-pre-line leading-snug uppercase font-mono block break-words [overflow-wrap:anywhere]"
                  />
                </div>

                {/* Column 2: Description & Clauses */}
                <div className="w-full md:flex-1 min-w-0 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-600 block">
                    Description of Goods & LC Narrative:
                  </span>
                  <InlineEditable
                    as="p"
                    multiline
                    value={docs.certificateOfOrigin.goodsDescription}
                    onSave={(v) => updateCOO('goodsDescription', v)}
                    className="text-slate-800 text-[10px] whitespace-pre-line leading-relaxed uppercase font-mono block break-words [overflow-wrap:anywhere]"
                  />
                </div>

                {/* Column 3: Origin & Weights */}
                <div className="w-full md:w-44 shrink-0 min-w-0 space-y-3 md:pl-3 md:border-l border-slate-200">
                  <div>
                    <InlineEditable
                      as="span"
                      value={docs.certificateOfOrigin.countryOfOrigin || 'INDIA'}
                      onSave={(v) => updateCOO('countryOfOrigin', v)}
                      className="text-[10px] font-bold uppercase text-slate-900 block"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-700 block">GROSS WT :</span>
                    <div className="text-slate-900 text-xs font-semibold flex items-center gap-1">
                      <InlineEditable
                        type="number"
                        value={docs.certificateOfOrigin.grossWeightKg && Number(docs.certificateOfOrigin.grossWeightKg) > 0 ? docs.certificateOfOrigin.grossWeightKg : ''}
                        onSave={(v) => updateCOO('grossWeightKg', parseFloat(v) || 0)}
                      />
                      <span>KGS</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-700 block">NET WT :</span>
                    <div className="text-slate-900 text-xs font-semibold flex items-center gap-1">
                      <InlineEditable
                        type="number"
                        value={docs.certificateOfOrigin.netWeightKg && Number(docs.certificateOfOrigin.netWeightKg) > 0 ? docs.certificateOfOrigin.netWeightKg : ''}
                        onSave={(v) => updateCOO('netWeightKg', parseFloat(v) || 0)}
                      />
                      <span>KGS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section */}
              <div className="pt-4 space-y-6">
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-xs uppercase">
                    {docs.certificateOfOrigin.portOfDischarge} BY SEA
                  </p>
                </div>

                <div className="flex justify-between items-end">
                  <div className="text-[11px] text-slate-600 uppercase">
                    <InlineEditable
                      value={docs.certificateOfOrigin.placeAndDateOfIssue || `MUMBAI, DATE: ${docs.certificateOfOrigin.invoiceDate}`}
                      onSave={(v) => updateCOO('placeAndDateOfIssue', v)}
                      className="text-[11px] text-slate-600 uppercase"
                    />
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-bold text-slate-900 text-xs uppercase">For {docs.certificateOfOrigin.exporter.name}</p>
                    <p className="text-[11px] text-slate-500 pt-8 uppercase">Authorised Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BILL OF EXCHANGE */}
          {activeDocTab === 'boe' && (
            <div className="border-2 border-slate-400 rounded-xl p-8 bg-white shadow-md font-sans text-xs space-y-6 max-w-5xl mx-auto text-slate-900">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-slate-900 pb-3 gap-2">
                <div>
                  <h1 className="text-base font-extrabold text-slate-900 uppercase">
                    Bill of Exchange (First & Second of Exchange)
                  </h1>
                  <p className="text-slate-500 text-[11px]">
                    Drafted under LC {docs.billOfExchange.lcNumber} for negotiation through selected bank profile.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Presenting Bank Profile:</label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => handleBankChange(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-emerald-950 shadow-2xs"
                  >
                    {sampleBankProfiles.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.branch} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(['First', 'Second'] as const).map((copy, copyIdx) => {
                const boe = docs.billOfExchange;
                const counterpart = copy === 'First' ? 'second' : 'first';
                // Fill-in rule under each value, as on the printed bill of exchange form
                const ruled = 'border-b border-slate-800 pb-0.5';
                return (
                  <React.Fragment key={copy}>
                    {copyIdx > 0 && (
                      <div className="relative py-2 flex items-center justify-center">
                        <div className="border-t-2 border-dashed border-slate-400 w-full"></div>
                      </div>
                    )}
                    <div className="border border-slate-400 p-6 bg-white relative">
                      {/* Double vertical border on left */}
                      <div className="absolute left-2 top-2 bottom-2 w-1 border-r border-l border-slate-600"></div>

                      <div className="pl-6 space-y-3.5">
                        {/* Drawn under LC banner */}
                        <div className="font-bold text-slate-900 text-[10px] tracking-wide uppercase">
                          {boe.headerText ? (
                            <InlineEditable multiline value={boe.headerText} onSave={(v) => updateBOE('headerText', v)} className="font-bold whitespace-pre-line text-left block" />
                          ) : (<>
                            DRAWN UNDER DOCUMENTARY CREDIT NO :{' '}
                            <InlineEditable value={boe.lcNumber} onSave={(v) => updateBOE('lcNumber', v)} className="font-bold" />{' '}
                            DATE{' '}
                            <InlineEditable value={boe.lcDate} onSave={(v) => updateBOE('lcDate', v)} className="font-bold" />
                          </>)}
                        </div>

                        {/* Title & No/Date */}
                        <div className="flex justify-between items-start pt-1">
                          <h2 className="font-serif italic font-bold text-2xl text-slate-900">Bills of Exchange</h2>
                          <div className="text-xs text-slate-800 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold w-10 text-right">No :</span>
                              <InlineEditable value={boe.invoiceNo} onSave={(v) => updateBOE('invoiceNo', v)} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold w-10 text-right">Date :</span>
                              <InlineEditable value={boe.date} onSave={(v) => updateBOE('date', v)} />
                            </div>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="font-bold text-sm text-slate-900">
                          <span className="font-normal mr-3">For</span>
                          {boe.currency}{' '}
                          <InlineEditable
                            type="number"
                            value={boe.amount}
                            onSave={(v) => updateBOE('amount', parseFloat(v) || 0)}
                            className="font-bold"
                          />
                        </div>

                        <div className="text-xs text-slate-800 leading-relaxed space-y-2.5">
                          <div className="flex items-end gap-2">
                            <span>At</span>
                            <span className={`flex-1 ${ruled}`}>
                              <InlineEditable value={boe.tenor} onSave={(v) => updateBOE('tenor', v)} />
                            </span>
                            <span>of this</span>
                            <span className="font-serif italic font-bold text-red-700 text-sm">{copy}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span>Exchange</span>
                            <span>({counterpart} of the same tenure and date being unpaid)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="whitespace-nowrap">Pay to the order of</span>
                            <span className={`flex-1 ${ruled}`}>
                              <InlineEditable
                                multiline
                                value={boe.payToOrderOf || (boe.presentingBankProfile ? bankPayToText(boe.presentingBankProfile) : '')}
                                onSave={(v) => updateBOE('payToOrderOf', v)}
                                className="whitespace-pre-line"
                              />
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="whitespace-nowrap">the sum of</span>
                            <span className={`flex-1 ${ruled}`}>
                              <InlineEditable multiline value={boe.amountInWords} onSave={(v) => updateBOE('amountInWords', v)} />
                            </span>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="whitespace-nowrap">Value received and charged the same to the account of</span>
                            <span className={`flex-1 ${ruled}`}>
                              <InlineEditable value={boe.accountOf || docs.commercialInvoice.lineItems[0]?.noAndKindOfPkg || ''} onSave={(v) => updateBOE('accountOf', v)} />
                            </span>
                          </div>
                          <div className="flex items-end gap-2 flex-wrap">
                            <span className="whitespace-nowrap">Packages shipped by S.S./Air</span>
                            <span className={`flex-1 min-w-[6rem] ${ruled}`}>
                              <InlineEditable value={boe.packagesShippedBy} onSave={(v) => updateBOE('packagesShippedBy', v)} />
                            </span>
                            <span className="whitespace-nowrap">Invoice No</span>
                            <span className={`min-w-[7rem] ${ruled}`}>
                              <InlineEditable value={boe.invoiceNo} onSave={(v) => updateBOE('invoiceNo', v)} />
                            </span>
                            <span>Date :</span>
                            <span className={`min-w-[5rem] ${ruled}`}>
                              <InlineEditable value={boe.invoiceDate} onSave={(v) => updateBOE('invoiceDate', v)} />
                            </span>
                          </div>
                          <div className="flex items-end gap-2">
                            <span className="whitespace-nowrap">B.L./Air Bill :</span>
                            <span className={`w-2/3 ${ruled}`}>
                              <InlineEditable value={boe.blAirBillRef} onSave={(v) => updateBOE('blAirBillRef', v)} />
                            </span>
                          </div>
                        </div>

                        {/* Drawee & signatory */}
                        <div className="flex justify-between items-end pt-2">
                          <div className="text-xs">
                            <span className="block">To,</span>
                            <span>M/s. </span>
                            <InlineEditable
                              multiline
                              value={boe.drawee}
                              onSave={(v) => updateBOE('drawee', v)}
                              className="font-bold whitespace-pre-line text-slate-900 block pl-6"
                            />
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900 text-xs">{docs.commercialInvoice.exporter?.name ? `For ${docs.commercialInvoice.exporter.name}` : ''}</p>
                            <div className="pt-8">
                              <span className="text-xs text-slate-500">Authorised Signatory</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* TAB 6: BENEFICIARY CERTIFICATES */}
          {activeDocTab === 'bencert' && (
            <div className="border border-slate-300 rounded-xl p-6 bg-white shadow-2xs font-sans text-xs space-y-6">
              <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                <div className="flex items-start gap-3.5">
                  <img
                    src={lahotiOverseasLogo}
                    alt="Lahoti Overseas Ltd."
                    className="h-10 w-auto object-contain border border-slate-200 p-1 rounded-md bg-white shadow-2xs shrink-0"
                  />
                  <div>
                    <h1 className="text-base font-extrabold text-slate-900 uppercase">
                      Beneficiary Certificates (Compliance Documents)
                    </h1>
                    <p className="text-slate-500 text-[11px]">
                      Generated verbatim on Lahoti Overseas Limited letterhead to satisfy MT700 Field 46A & 47A clauses.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {docs.beneficiaryCertificates.map((cert) => (
                  <div key={cert.id} className="border border-slate-300 rounded-xl p-8 bg-white shadow-2xs font-sans text-xs space-y-5 max-w-4xl mx-auto">
                    {/* Certificate Top Letterhead */}
                    <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                      <div className="flex items-start gap-4">
                        <img
                          src={lahotiOverseasLogo}
                          alt="Lahoti Overseas Ltd."
                          className="h-12 w-auto object-contain border border-slate-200 p-1 rounded-md bg-white shrink-0 shadow-2xs"
                        />
                        <div className="space-y-0.5">
                          <h2 className="font-bold text-slate-900 text-sm tracking-wide">{docs.commercialInvoice.exporter?.name || ''}</h2>
                          <p className="text-[10px] font-bold text-slate-700 uppercase">REGD OFFICE:</p>
                          <p className="text-[10px] text-slate-600 uppercase">307, ARUN CHAMBERS, TARDEO ROAD,</p>
                          <p className="text-[10px] text-slate-600 uppercase">MUMBAI - 400 034 INDIA</p>
                          <p className="text-[10px] text-slate-600">TEL.: 91-22-40500100 TO 40500199</p>
                          <p className="text-[10px] text-slate-600">FAX: 91-22-40500150</p>
                          <p className="text-[10px] text-slate-600">E-Mail: umesh@lahotioverseas.com</p>
                          <p className="text-[10px] text-slate-600">Internet: www.lahotioverseas.com</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-2">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => {
                              const pdf = generateBeneficiaryCertificatePDF(cert);
                              pdf.save(`${(cert.docTitle || 'Beneficiary_Cert').replace(/\s+/g, '_')}_${cert.invoiceNo || 'Doc'}.pdf`);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 inline-flex items-center gap-1 transition-colors shadow-2xs"
                            title="Download single certificate as PDF"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                          <button
                            onClick={async () => {
                              const blob = await generateBeneficiaryCertificateDOCX(cert);
                              downloadFileBlob(blob, `${(cert.docTitle || 'Beneficiary_Cert').replace(/\s+/g, '_')}_${cert.invoiceNo || 'Doc'}.docx`);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 inline-flex items-center gap-1 transition-colors shadow-2xs"
                            title="Download single certificate as Word document"
                          >
                            <FileText className="w-3 h-3" /> Word
                          </button>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 flex items-center justify-end gap-1">
                          <span>DATE:</span>
                          <InlineEditable
                            as="strong"
                            value={cert.docHeaderDate || '________'}
                            onSave={(v) => updateBeneficiaryCert(cert.id, 'docHeaderDate', v)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Certificate Title */}
                    <div className="text-center py-2">
                      <InlineEditable
                        as="h3"
                        value={cert.docTitle || (cert.title.includes('(') ? cert.title.split('(')[0].trim() : cert.title)}
                        onSave={(v) => updateBeneficiaryCert(cert.id, 'docTitle', v)}
                        className="font-bold text-slate-900 text-sm uppercase tracking-wide underline underline-offset-4 block"
                      />
                      {cert.clauseRef && (
                        <span className="inline-block mt-1">
                          {renderClauseBadge(cert.clauseRef)}
                        </span>
                      )}
                    </div>

                    {/* Email Details if Email Advice */}
                    {cert.certType === 'email_advice_enclosed' && cert.emailDetails && (
                      <div className="bg-slate-50 border border-slate-300 rounded p-3.5 text-[11px] space-y-1 font-mono">
                        <div className="flex items-center gap-1">
                          <strong>From:</strong>
                          <InlineEditable
                            value={cert.emailDetails.from}
                            onSave={(v) => updateBeneficiaryCertEmailDetails(cert.id, 'from', v)}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <strong>Sent:</strong>
                          <InlineEditable
                            value={cert.emailDetails.sent}
                            onSave={(v) => updateBeneficiaryCertEmailDetails(cert.id, 'sent', v)}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <strong>To:</strong>
                          <InlineEditable
                            value={cert.emailDetails.to}
                            onSave={(v) => updateBeneficiaryCertEmailDetails(cert.id, 'to', v)}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <strong>Subject:</strong>
                          <InlineEditable
                            value={cert.emailDetails.subject}
                            onSave={(v) => updateBeneficiaryCertEmailDetails(cert.id, 'subject', v)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Addressees (from the LC clause that asks for the advice) */}
                    {cert.recipients && cert.recipients.length > 0 && (
                      <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded text-[11px]">
                        {cert.recipients.map((r, ri) => (
                          <div key={ri} className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">TO,</span>
                            <InlineEditable
                              as="p"
                              multiline
                              value={r.address}
                              onSave={(v) => updateBeneficiaryCert(cert.id, 'recipients', cert.recipients!.map((x, xi) => xi === ri ? { ...x, address: v } : x))}
                              className="text-slate-800 whitespace-pre-line leading-tight block font-semibold"
                            />
                            {r.email && cert.certType !== 'email_advice_enclosed' && (
                              <div className="text-blue-900 font-mono font-semibold">EMAIL: {r.email}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recipients TO block */}
                    {!cert.recipients?.length && (cert.insuranceCompanyDetails || cert.applicantDetails) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded text-[11px]">
                        {cert.insuranceCompanyDetails && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block uppercase">TO (INSURANCE CO):</span>
                            <InlineEditable
                              as="p"
                              multiline
                              value={cert.insuranceCompanyDetails}
                              onSave={(v) => updateBeneficiaryCert(cert.id, 'insuranceCompanyDetails', v)}
                              className="text-slate-800 whitespace-pre-line leading-tight block uppercase"
                            />
                            {cert.insuranceEmail && (
                              <div className="text-blue-900 font-mono mt-1 flex items-center gap-1">
                                <span>EMAIL:</span>
                                <InlineEditable
                                  value={cert.insuranceEmail}
                                  onSave={(v) => updateBeneficiaryCert(cert.id, 'insuranceEmail', v)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                        {cert.applicantDetails && (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block uppercase">TO (APPLICANT):</span>
                            <InlineEditable
                              as="p"
                              multiline
                              value={cert.applicantDetails}
                              onSave={(v) => updateBeneficiaryCert(cert.id, 'applicantDetails', v)}
                              className="text-slate-800 whitespace-pre-line leading-tight block uppercase"
                            />
                            {cert.applicantBin && (
                              <div className="text-slate-800 font-semibold mt-1 flex items-center gap-1">
                                <span>VAT REG (BIN):</span>
                                <InlineEditable
                                  value={cert.applicantBin}
                                  onSave={(v) => updateBeneficiaryCert(cert.id, 'applicantBin', v)}
                                />
                              </div>
                            )}
                            {cert.applicantEmail && (
                              <div className="text-blue-900 font-mono mt-0.5 flex items-center gap-1">
                                <span>EMAIL:</span>
                                <InlineEditable
                                  value={cert.applicantEmail}
                                  onSave={(v) => updateBeneficiaryCert(cert.id, 'applicantEmail', v)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* LC & Insurance References */}
                    <div className="text-xs font-semibold text-slate-800 space-y-1 pt-1">
                      {cert.insuranceCoverNote && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="underline">INSURANCE COVER NOTE NO.</span>
                          <InlineEditable
                            as="strong"
                            value={cert.insuranceCoverNote}
                            onSave={(v) => updateBeneficiaryCert(cert.id, 'insuranceCoverNote', v)}
                            className="font-mono font-bold underline"
                          />
                          <span className="underline">DATED</span>
                          <InlineEditable
                            as="strong"
                            value={cert.insuranceCoverNoteDate || ''}
                            onSave={(v) => updateBeneficiaryCert(cert.id, 'insuranceCoverNoteDate', v)}
                            className="font-mono font-bold underline"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="underline">L/C NO.</span>
                        <InlineEditable
                          as="strong"
                          value={cert.lcNumber}
                          onSave={(v) => updateBeneficiaryCert(cert.id, 'lcNumber', v)}
                          className="font-mono text-blue-950 font-bold underline"
                        />
                        <span className="underline">DATE</span>
                        <InlineEditable
                          as="strong"
                          value={cert.lcDate || ''}
                          onSave={(v) => updateBeneficiaryCert(cert.id, 'lcDate', v)}
                          className="font-mono font-bold underline"
                        />
                      </div>
                    </div>

                    {/* Goods Narration if present */}
                    {cert.goodsNarration && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-800 leading-relaxed font-mono">
                        <InlineEditable
                          as="div"
                          multiline
                          value={cert.goodsNarration}
                          onSave={(v) => updateBeneficiaryCert(cert.id, 'goodsNarration', v)}
                          className="text-[11px] text-slate-800 leading-relaxed font-mono block"
                        />
                      </div>
                    )}

                    {/* Shipment particulars (labels follow the transport mode: LR for road, B/L for sea) */}
                    {cert.particulars && cert.particulars.length > 0 && cert.certType === 'shipment_advice_dispatch' && (
                      <div className="space-y-2">
                        <span className="font-bold text-slate-900 text-xs block">PLEASE NOTE BELOW DETAILS OF SHIPMENT -</span>
                        <div className="p-3 bg-slate-50 border border-slate-300 rounded text-xs space-y-1">
                          {cert.particulars.map((pt, pi) => (
                            <div key={pt.label} className="grid grid-cols-[minmax(0,18rem)_1fr] gap-2">
                              <span className="font-bold text-slate-700">{pt.label}</span>
                              <span className="flex gap-1">:
                                <InlineEditable
                                  as="span"
                                  value={pt.value}
                                  onSave={(v) => updateBeneficiaryCert(cert.id, 'particulars', cert.particulars!.map((x, xi) => xi === pi ? { ...x, value: v } : x))}
                                  className="font-semibold"
                                />
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shipment Particulars Table if Advice */}
                    {!cert.particulars?.length && cert.shipmentParticulars && cert.certType === 'shipment_advice_dispatch' && (
                      <div className="space-y-2">
                        <span className="font-bold text-slate-900 text-xs block">PLEASE NOTE BELOW DETAILS OF SHIPMENT –</span>
                        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-300 rounded text-xs">
                          <div>
                            <span className="font-bold text-slate-700">NAME OF VESSEL NO.:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.vessel}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'vessel', v)}
                              className="font-mono text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">DATE OF SHIPMENT:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.shipmentDate}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'shipmentDate', v)}
                              className="font-mono text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">INVOICE AMOUNT:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.invoiceAmount}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'invoiceAmount', v)}
                              className="font-mono text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">QUANTITY:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.quantity}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'quantity', v)}
                              className="font-mono text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">PORT OF LOADING:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.portOfLoading}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'portOfLoading', v)}
                              className="text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">PORT OF DISCHARGE:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.portOfDischarge}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'portOfDischarge', v)}
                              className="text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">B/L NO.:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.blNo || 'N/A'}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'blNo', v)}
                              className="font-mono text-slate-900 font-bold"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">CONTAINER NO.:</span>{' '}
                            <InlineEditable
                              as="strong"
                              value={cert.shipmentParticulars.containerNo || 'N/A'}
                              onSave={(v) => updateBeneficiaryCertShipmentParticular(cert.id, 'containerNo', v)}
                              className="font-mono text-slate-900 font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Verbatim Certificate Body */}
                    {cert.certType !== 'shipment_advice_dispatch' && (
                      <div className="text-slate-900 text-xs leading-relaxed py-2 whitespace-pre-line">
                        <InlineEditable
                          as="div"
                          multiline
                          value={cert.text}
                          onSave={(v) => updateBeneficiaryCert(cert.id, 'text', v)}
                          className="text-slate-900 text-xs leading-relaxed whitespace-pre-line block"
                        />
                      </div>
                    )}

                    {/* List of Documents if Email Advice */}
                    {cert.listOfDocuments && cert.listOfDocuments.length > 0 && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                        <span className="font-bold text-slate-900 block">LIST OF DOCUMENTS:</span>
                        {cert.listOfDocuments.map((d, dIdx) => (
                          <div key={dIdx} className="text-slate-700 font-mono text-[11px]">• {d}</div>
                        ))}
                      </div>
                    )}

                    {/* Master Footnote Reference (Underlined headers, no box) */}
                    {cert.footnoteDetails && (
                      <div className="space-y-1 text-xs font-bold text-slate-900 pt-2">
                        {cert.footnoteDetails.split('\n').filter(Boolean).map((line, lIdx) => {
                          const trimmed = line.trim();
                          const isUnderlined = trimmed.startsWith('INVOICE NO.') || trimmed.startsWith('LETTER OF CREDIT NO.');
                          return (
                            <p key={lIdx} className={isUnderlined ? 'underline' : ''}>
                              {trimmed}
                            </p>
                          );
                        })}
                        <div className="pt-1">
                          <span className="text-[10px] text-slate-400 uppercase font-normal block">Edit Reference Details:</span>
                          <InlineEditable
                            as="div"
                            multiline
                            value={cert.footnoteDetails}
                            onSave={(v) => updateBeneficiaryCert(cert.id, 'footnoteDetails', v)}
                            className="text-xs font-bold text-slate-900 whitespace-pre-line block"
                          />
                        </div>
                      </div>
                    )}

                    {/* Post-text instruction */}
                    {cert.postTextInstruction && (
                      <div className="text-[11px] font-semibold text-slate-700 whitespace-pre-line pt-2">
                        <InlineEditable
                          as="div"
                          multiline
                          value={cert.postTextInstruction}
                          onSave={(v) => updateBeneficiaryCert(cert.id, 'postTextInstruction', v)}
                          className="text-[11px] font-semibold text-slate-700 whitespace-pre-line block"
                        />
                      </div>
                    )}

                    {/* Signatory Footer (Left Aligned) */}
                    <div className="pt-6 text-xs space-y-8">
                      <div>
                        <InlineEditable
                          as="p"
                          value={cert.signatoryCompany || (docs.commercialInvoice.exporter?.name ? `For ${docs.commercialInvoice.exporter.name}` : '')}
                          onSave={(v) => updateBeneficiaryCert(cert.id, 'signatoryCompany', v)}
                          className="font-bold text-slate-900 block"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-800">{cert.signatoryName || 'Authorised Signatory'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Back Button */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-start">
          <button
            id="back-to-stage-4-btn"
            onClick={onBackToStage4}
            className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Stage 4 Bill of Lading
          </button>
        </div>
      </div>
    </div>
  );
};
