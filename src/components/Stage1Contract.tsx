import React, { useState } from 'react';
import { SaleContractData, ContractLineItem } from '../types';
import { convertFileToVisionParts } from '../lib/pdfVisionHelper';
import { numberToWords, mergeContractItemDescription } from '../lib/documentGenerators';
import { sanitizeExtractedData, detectFieldsNeedingManualEntry } from '../lib/antiHallucination';
import lahotiOverseasLogo from '../image/logo';
import {
  Upload,
  FileText,
  Sparkles,
  Building2,
  Package,
  CircleDollarSign,
  Ship,
  Landmark,
  FileCheck2,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';

interface Stage1ContractProps {
  contractData: SaleContractData | null;
  onSaveContract: (data: SaleContractData, docMetadata?: { name: string; size: string; pageCount: number }) => void;
  onProceedToStage2: () => void;
  onLoadPreset: (preset: 'weber' | 'sanjana') => void;
}

export const Stage1Contract: React.FC<Stage1ContractProps> = ({
  contractData,
  onSaveContract,
  onProceedToStage2,
  onLoadPreset
}) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUploaded, setLastUploaded] = useState<{ file: File; type: 'sales' | 'purchase' } | null>(null);
  const [manualEntryFlags, setManualEntryFlags] = useState<Array<{ field: string; label: string; reason: string }>>([]);
  const [documentMismatch, setDocumentMismatch] = useState<{ expected: 'sales' | 'purchase'; detected: 'sales' | 'purchase' } | null>(null);

  // Form state
  const [formData, setFormData] = useState<SaleContractData | null>(contractData);

  // Update local state when prop updates
  React.useEffect(() => {
    setFormData(contractData);
    if (contractData) {
      const required = [
        'contractNo',
        'contractDate',
        'exporter.name',
        'buyer.name',
        'buyer.address',
        'orderCurrency',
        'totalValue',
        'paymentTerms',
        'deliveryTerms',
        'portOfLoading',
        'portOfDelivery'
      ];
      const missing = detectFieldsNeedingManualEntry(contractData, required);
      setManualEntryFlags(missing);
    }
  }, [contractData]);

  const processFile = async (file: File, expectedType: 'sales' | 'purchase') => {
    setIsExtracting(true);
    setErrorMessage(null);
    setManualEntryFlags([]);
    setDocumentMismatch(null);
    setExtractProgress('Converting PDF pages to multimodal vision inputs...');

    try {
      const { pages, extractedText } = await convertFileToVisionParts(file);

      setExtractProgress(`Sending ${pages.length || 1} page vision inputs to Gemini API...`);

      const payload = {
        imageParts: pages.map(p => ({ mimeType: p.mimeType, data: p.data })),
        textContent: extractedText
      };

      const res = await fetch('/api/extract-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let json: any;
      try {
        const resText = await res.text();
        json = JSON.parse(resText);
      } catch (parseErr) {
        throw new Error(`Server returned invalid response (${res.status} ${res.statusText}). Please retry uploading the contract.`);
      }

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Failed to extract contract details from Gemini API (${res.status})`);
      }

      // Apply strict client-side anti-hallucination sanitization
      const sanitized: SaleContractData = sanitizeExtractedData(json.data);
      // Every line of an item's description in one field (the AI sometimes splits them)
      sanitized.items = (sanitized.items || []).map(mergeContractItemDescription);

      if (!sanitized.documentType) {
        sanitized.documentType = expectedType;
      }

      // Check for document type mismatch (e.g. uploaded in sales slot but identified as purchase, or vice-versa)
      if (sanitized.documentType && sanitized.documentType !== expectedType) {
        setDocumentMismatch({
          expected: expectedType,
          detected: sanitized.documentType
        });
      }

      // Detect fields needing manual entry
      const requiredFields = [
        'contractNo',
        'contractDate',
        'exporter.name',
        'buyer.name',
        'buyer.address',
        'orderCurrency',
        'totalValue',
        'paymentTerms',
        'deliveryTerms',
        'portOfLoading',
        'portOfDelivery'
      ];
      const missing = detectFieldsNeedingManualEntry(sanitized, requiredFields);
      setManualEntryFlags(missing);

      // Add field sources metadata
      sanitized.fieldSources = {
        contractNo: { source: 'Contract Header, Page 1', confidence: sanitized.contractNo ? 'high' : 'low', excerpt: sanitized.contractNo || 'N/A' },
        buyer: { source: 'Buyer Section, Page 1', confidence: sanitized.buyer?.name ? 'high' : 'low', excerpt: sanitized.buyer?.name || 'N/A' },
        totalValue: { source: 'Price & Total Table', confidence: sanitized.totalValue ? 'high' : 'low', excerpt: `${sanitized.orderCurrency || ''} ${sanitized.totalValue || ''}` },
        deliveryTerms: { source: 'Terms Section, Page 1', confidence: sanitized.deliveryTerms ? 'high' : 'low', excerpt: sanitized.deliveryTerms || 'N/A' }
      };

      setFormData(sanitized);
      onSaveContract(sanitized, {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        pageCount: pages.length || 1
      });
      setExtractProgress('');
    } catch (err: any) {
      console.error('Contract extraction error:', err);
      setErrorMessage(err.message || 'Error parsing document with Gemini Vision');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, expectedType: 'sales' | 'purchase') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastUploaded({ file, type: expectedType });
    await processFile(file, expectedType);
  };

  const handleRetry = () => {
    if (lastUploaded) {
      processFile(lastUploaded.file, lastUploaded.type);
    }
  };

  const handleItemChange = (index: number, field: keyof ContractLineItem, value: any) => {
    if (!formData) return;
    const updatedItems = [...formData.items];
    const item = { ...updatedItems[index], [field]: value };

    // Auto-calculate netValue if qty or unitPrice changed
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
      item.netValue = Math.round(qty * price * 100) / 100;
    }

    updatedItems[index] = item;
    const newTotal = updatedItems.reduce((acc, it) => acc + (it.netValue || 0), 0);

    const updatedData: SaleContractData = {
      ...formData,
      items: updatedItems,
      totalValue: newTotal,
      totalValueWords: numberToWords(newTotal, formData.orderCurrency || 'USD')
    };

    setFormData(updatedData);
    onSaveContract(updatedData);
  };

  const handleAddItem = () => {
    if (!formData) return;
    const newItem: ContractLineItem = {
      itemNo: formData.items.length + 1,
      description: 'Ne 16/1 100% Cotton Carded Compact Yarn',
      specification: 'Ne 16/1 KW COMPACT',
      composition: '100% COTTON',
      quantity: 1000,
      uom: 'KG',
      unitPrice: 2.85,
      netValue: 2850.00
    };
    const updatedItems = [...formData.items, newItem];
    const newTotal = updatedItems.reduce((acc, it) => acc + (it.netValue || 0), 0);
    const updatedData: SaleContractData = {
      ...formData,
      items: updatedItems,
      totalValue: newTotal,
      totalValueWords: numberToWords(newTotal, formData.orderCurrency || 'USD')
    };
    setFormData(updatedData);
    onSaveContract(updatedData);
  };

  const handleRemoveItem = (index: number) => {
    if (!formData || formData.items.length <= 1) return;
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const newTotal = updatedItems.reduce((acc, it) => acc + (it.netValue || 0), 0);
    const updatedData: SaleContractData = {
      ...formData,
      items: updatedItems,
      totalValue: newTotal,
      totalValueWords: numberToWords(newTotal, formData.orderCurrency || 'USD')
    };
    setFormData(updatedData);
    onSaveContract(updatedData);
  };

  const handleFieldChange = (section: keyof SaleContractData | string, field: string, value: any) => {
    if (!formData) return;
    let updatedData: SaleContractData;

    if (section === 'exporter' || section === 'buyer' || section === 'bankDetails') {
      updatedData = {
        ...formData,
        [section]: {
          ...(formData as any)[section],
          [field]: value
        }
      };
    } else {
      updatedData = {
        ...formData,
        [field]: value
      };
    }

    setFormData(updatedData);
    onSaveContract(updatedData);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Upload Zone without top buttons */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="border-b border-slate-100 pb-5 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-bold text-slate-900">Sales & Purchase Contract Management</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Select whether you are processing a Sales Contract or Purchase Contract. Gemini Vision automatically audits and identifies document types.
          </p>
        </div>



        {/* Loading / Extraction State */}
        {isExtracting && (
          <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center gap-3 text-blue-900 text-xs font-medium animate-pulse mb-4">
            <Sparkles className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-semibold">{extractProgress || 'Auditing trade document with Gemini Multimodal Vision...'}</p>
              <p className="text-[11px] text-blue-700 mt-0.5">Extracting exact goods descriptions, document type classification, and commercial parameters.</p>
            </div>
          </div>
        )}

        {/* Error Alert State */}
        {errorMessage && !isExtracting && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-3 text-rose-900 text-xs mb-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 text-sm">Contract Extraction Notice</p>
                <p className="text-rose-700 mt-1">{errorMessage}</p>
                <div className="mt-3 flex items-center gap-2">
                  {lastUploaded && (
                    <button
                      onClick={handleRetry}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Extraction
                    </button>
                  )}
                  {onLoadPreset && !formData && (
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        onLoadPreset('weber');
                      }}
                      className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 rounded-md font-medium text-xs transition-colors"
                    >
                      Load Sample Contract
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-semibold px-2 py-1 rounded-sm hover:bg-rose-100/50"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Big centered upload buttons when no data or at bottom/top */}
        {!formData && !isExtracting && (
          <div className="py-12 px-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center my-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
              <Upload className="w-8 h-8" />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-800">Upload Sales or Purchase Contract</h3>
              <p className="text-xs text-slate-500 mt-1">
                Select your contract document (PDF or scanned image) to initiate AI-powered multimodal audit and extraction.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-lg pt-2">
              <label
                htmlFor="sales-contract-upload-big"
                className="cursor-pointer flex-1 py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 whitespace-nowrap"
              >
                <Upload className="w-5 h-5 shrink-0" />
                <span>Upload Sales Contract</span>
                <input
                  id="sales-contract-upload-big"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleFileUpload(e, 'sales')}
                  className="hidden"
                />
              </label>

              <label
                htmlFor="purchase-contract-upload-big"
                className="cursor-pointer flex-1 py-4 px-6 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 whitespace-nowrap"
              >
                <Upload className="w-5 h-5 shrink-0" />
                <span>Upload Purchase Contract</span>
                <input
                  id="purchase-contract-upload-big"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleFileUpload(e, 'purchase')}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Document Type Mismatch Warning Banner */}
        {documentMismatch && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900 text-xs mb-4 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 text-sm">
                  ⚠️ Document Type Mismatch Identified
                </span>
                <span className="text-[10px] bg-amber-200 px-2 py-0.5 rounded font-semibold text-amber-900">
                  AI Auditor Detection
                </span>
              </div>
              <p className="text-amber-800 mt-1">
                You initiated upload via the <strong>{documentMismatch.expected.toUpperCase()} Contract</strong> button, but Gemini Vision identified this uploaded document as a <strong>{documentMismatch.detected.toUpperCase()} Contract / Order</strong>.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    if (formData) {
                      setFormData({ ...formData, documentType: documentMismatch.detected });
                    }
                    setDocumentMismatch(null);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-semibold text-xs transition-colors"
                >
                  Switch Mode to {documentMismatch.detected.toUpperCase()}
                </button>
                <button
                  onClick={() => setDocumentMismatch(null)}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-md font-medium text-xs transition-colors"
                >
                  Keep Current
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Anti-Hallucination: Manual Entry Flags Alert */}
        {manualEntryFlags.length > 0 && formData && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs mb-4 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950">
                  Anti-Hallucination Notice: {manualEntryFlags.length} Field{manualEntryFlags.length > 1 ? 's' : ''} Flagged for Manual Entry
                </span>
                <span className="text-[10px] bg-amber-200/70 font-semibold px-2 py-0.5 rounded text-amber-900">
                  Safeguard Active
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                The model was instructed never to invent or assume missing data. The following fields were absent in the source document and left blank for your verification:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {manualEntryFlags.map((flag, idx) => (
                  <span
                    key={idx}
                    title={flag.reason}
                    className="px-2 py-0.5 bg-white rounded border border-amber-300 text-amber-900 text-[11px] font-mono font-medium flex items-center gap-1 shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    {flag.label}: <em>Needs entry</em>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}



        {/* Form Content if Data is present */}
        {formData && (
          <div className="space-y-6 pt-2">
            {/* Confidence & Source Summary Badge */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">Audited Contract:</span>
                <span className="font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                  {formData.contractNo}
                </span>
                <span className="text-slate-500">• Dated {formData.contractDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Verbatim Character Extraction
                </span>
              </div>
            </div>

            {/* Section 1: Parties & Order Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Exporter Block */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                    <img
                      src={lahotiOverseasLogo}
                      alt="Lahoti Overseas Logo"
                      className="w-5 h-5 object-contain bg-white rounded border border-slate-300 p-0.5"
                    />
                    Exporter (Seller) Details
                  </div>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                    Page 1 Header
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={formData.exporter?.name || ''}
                      onChange={(e) => handleFieldChange('exporter', 'name', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Registered Address</label>
                    <textarea
                      rows={2}
                      value={formData.exporter?.address || ''}
                      onChange={(e) => handleFieldChange('exporter', 'address', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Tel / Contact</label>
                      <input
                        type="text"
                        value={formData.exporter?.tel || ''}
                        onChange={(e) => handleFieldChange('exporter', 'tel', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Email</label>
                      <input
                        type="text"
                        value={formData.exporter?.email || ''}
                        onChange={(e) => handleFieldChange('exporter', 'email', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Buyer Block */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                    Buyer (Applicant) Details
                  </div>
                  <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-medium border border-teal-200">
                    From Contract, Page 1
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Buyer Name</label>
                    <input
                      type="text"
                      value={formData.buyer?.name || ''}
                      onChange={(e) => handleFieldChange('buyer', 'name', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Buyer Full Address</label>
                    <textarea
                      rows={2}
                      value={formData.buyer?.address || ''}
                      onChange={(e) => handleFieldChange('buyer', 'address', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Order / Contract No.</label>
                      <input
                        type="text"
                        value={formData.contractNo || ''}
                        onChange={(e) => handleFieldChange('root', 'contractNo', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Order Date</label>
                      <input
                        type="text"
                        value={formData.contractDate || ''}
                        onChange={(e) => handleFieldChange('root', 'contractDate', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Items Table */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  Line Items & Verbatim Goods Description
                </div>
                <button
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 bg-white rounded-lg overflow-hidden">
                  <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2 min-w-[320px]">Verbatim Description of Goods</th>
                      <th className="p-2 w-24">Quantity</th>
                      <th className="p-2 w-20">UOM</th>
                      <th className="p-2 w-24">Unit Price ({formData.orderCurrency})</th>
                      <th className="p-2 w-28 text-right">Net Value</th>
                      <th className="p-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2 text-center text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="p-2">
                          <textarea
                            rows={Math.max(2, (item.description || '').split('\n').length)}
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full p-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded font-mono text-slate-800 leading-relaxed focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full p-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded font-medium focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.uom}
                            onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                            className="w-full p-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded text-center uppercase font-bold focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="w-full p-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded font-medium focus:bg-white"
                          />
                        </td>
                        <td className="p-2 text-right font-bold text-slate-900">
                          {formData.orderCurrency} {item.netValue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
                          {formData.items.length > 1 && (
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Commercial & Delivery Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Financials & Tolerance */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                    <CircleDollarSign className="w-3.5 h-3.5 text-amber-600" />
                    Financial Values & Tolerance
                  </div>
                  <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                    From Contract, Page 1
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Order Currency</label>
                      <input
                        type="text"
                        value={formData.orderCurrency || 'USD'}
                        onChange={(e) => handleFieldChange('root', 'orderCurrency', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-slate-800 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Total Value</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.totalValue || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const updated = {
                            ...formData,
                            totalValue: val,
                            totalValueWords: numberToWords(val, formData.orderCurrency || 'USD')
                          };
                          setFormData(updated);
                          onSaveContract(updated);
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-bold text-emerald-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Amount in Words</label>
                    <textarea
                      rows={2}
                      value={formData.totalValueWords || ''}
                      onChange={(e) => handleFieldChange('root', 'totalValueWords', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-700 text-xs font-serif"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Quantity/Amount Tolerance</label>
                      <input
                        type="text"
                        value={formData.tolerance || ''}
                        onChange={(e) => handleFieldChange('root', 'tolerance', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Container/FCL Summary</label>
                      <input
                        type="text"
                        value={formData.fclCount || ''}
                        onChange={(e) => handleFieldChange('root', 'fclCount', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipping & Logistics */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                    <Ship className="w-3.5 h-3.5 text-cyan-600" />
                    Shipment & Logistics Terms
                  </div>
                  <span className="text-[10px] bg-cyan-50 text-cyan-800 px-1.5 py-0.5 rounded font-medium border border-cyan-200">
                    From Terms & Conditions
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Payment Terms</label>
                    <input
                      type="text"
                      value={formData.paymentTerms || ''}
                      onChange={(e) => handleFieldChange('root', 'paymentTerms', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Delivery Terms (Incoterms)</label>
                      <input
                        type="text"
                        value={formData.deliveryTerms || ''}
                        onChange={(e) => handleFieldChange('root', 'deliveryTerms', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md font-semibold text-slate-800 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Shipment Validity</label>
                      <input
                        type="text"
                        value={formData.shipmentValidity || ''}
                        onChange={(e) => handleFieldChange('root', 'shipmentValidity', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Port of Loading</label>
                      <input
                        type="text"
                        value={formData.portOfLoading || ''}
                        onChange={(e) => handleFieldChange('root', 'portOfLoading', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Port of Delivery</label>
                      <input
                        type="text"
                        value={formData.portOfDelivery || ''}
                        onChange={(e) => handleFieldChange('root', 'portOfDelivery', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Mode</label>
                      <input
                        type="text"
                        value={formData.shipmentMode || 'SEA'}
                        onChange={(e) => handleFieldChange('root', 'shipmentMode', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Transhipment</label>
                      <input
                        type="text"
                        value={formData.transhipment || 'ALLOWED'}
                        onChange={(e) => handleFieldChange('root', 'transhipment', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 text-xs uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Partial Shipment</label>
                      <input
                        type="text"
                        value={formData.partialShipment || 'ALLOWED'}
                        onChange={(e) => handleFieldChange('root', 'partialShipment', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-slate-700 text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Banking & Free-text Requirements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Bank Details */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                    <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                    Seller Banking Instructions
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                    From Bank Details Block
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Pay To Bank</label>
                      <input
                        type="text"
                        value={formData.bankDetails?.payTo || ''}
                        onChange={(e) => handleFieldChange('bankDetails', 'payTo', e.target.value)}
                        className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-md font-medium text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Bank SWIFT</label>
                      <input
                        type="text"
                        value={formData.bankDetails?.swift || ''}
                        onChange={(e) => handleFieldChange('bankDetails', 'swift', e.target.value)}
                        className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-md font-mono text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Beneficiary Account No.</label>
                    <input
                      type="text"
                      value={formData.bankDetails?.beneficiaryAccNo || ''}
                      onChange={(e) => handleFieldChange('bankDetails', 'beneficiaryAccNo', e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-md font-mono text-slate-800 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Intermediary Bank</label>
                      <input
                        type="text"
                        value={formData.bankDetails?.intermediaryBank || ''}
                        onChange={(e) => handleFieldChange('bankDetails', 'intermediaryBank', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Intermediary SWIFT</label>
                      <input
                        type="text"
                        value={formData.bankDetails?.intermediarySwift || ''}
                        onChange={(e) => handleFieldChange('bankDetails', 'intermediarySwift', e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md font-mono text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Free-Text Requirements */}
              <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-800">
                    <FileCheck2 className="w-3.5 h-3.5 text-purple-600" />
                    Document Requirements & Special Clauses
                  </div>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium border border-purple-200">
                    Page 2 Clauses
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="text-[11px] text-slate-500">
                    Free-text requirements extracted verbatim from contract:
                  </p>
                  <ul className="space-y-1.5">
                    {(formData.documentRequirements || []).map((req, i) => (
                      <li key={i} className="p-2 bg-white rounded border border-slate-200 text-slate-700 text-xs flex items-start gap-2">
                        <span className="text-emerald-700 font-bold">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom Action bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                All fields are audited & ready. Next: upload the LC (Stage 2).
              </div>
              <button
                id="proceed-to-stage-2-btn"
                onClick={onProceedToStage2}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-colors"
              >
                Auto-Draft Stage 2 Documents
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
