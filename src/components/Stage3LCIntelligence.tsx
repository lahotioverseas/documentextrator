import React, { useState } from 'react';
import {
  LCDetails,
  LCClause,
  Discrepancy,
  LCAmendment,
  SaleContractData,
  ExportData
} from '../types';
import { convertFileToVisionParts } from '../lib/pdfVisionHelper';
import { AmendmentDiffModal } from './AmendmentDiffModal';
import { InlineEditable } from './InlineEditable';
import { lcGoodsItems } from '../lib/documentGenerators';
import {
  ShieldAlert,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  FileCode2,
  Filter,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Building,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  FileText,
  Ship,
  Info,
  CheckCircle2,
  FileCheck,
  Eye
} from 'lucide-react';

interface Stage3LCIntelligenceProps {
  contractData: SaleContractData | null;
  exportDraftData: ExportData | null;
  lcDetails: LCDetails | null;
  discrepancies: Discrepancy[];
  amendments: LCAmendment[];
  onSaveLCDetails: (lc: LCDetails, docMetadata?: { name: string; size: string; pageCount: number }) => void;
  onSaveDiscrepancies: (discrepancies: Discrepancy[]) => void;
  onAddAmendment: (amendment: LCAmendment) => void;
  onProceedToStage4: () => void;
  onBackToStage2: () => void;
  onLoadPresetLC: () => void;
  onLoadSampleAmendment: () => void;
}

export const Stage3LCIntelligence: React.FC<Stage3LCIntelligenceProps> = ({
  contractData,
  exportDraftData,
  lcDetails,
  discrepancies,
  amendments,
  onSaveLCDetails,
  onSaveDiscrepancies,
  onAddAmendment,
  onProceedToStage4,
  onBackToStage2,
  onLoadPresetLC,
  onLoadSampleAmendment
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUploadedLCFile, setLastUploadedLCFile] = useState<File | null>(null);
  const [clauseCategoryFilter, setClauseCategoryFilter] = useState<string>('all');
  const [docFilter, setDocFilter] = useState<string>('all');
  const [autoAppliableFilter, setAutoAppliableFilter] = useState<boolean | null>(null);
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const lcProducts = lcDetails ? lcGoodsItems(lcDetails) : [];

  // Staged amendment for diff verification review
  const [pendingAmendment, setPendingAmendment] = useState<LCAmendment | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Process LC file
  const processLCFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessStatus('Rendering scanned SWIFT MT700 pages to high-resolution images...');

    try {
      const { pages, extractedText } = await convertFileToVisionParts(file);

      setProcessStatus(`Extracting structured SWIFT fields & 46A/47A verbatim clauses from document (${pages.length || 1} pages)...`);

      // 1. Extract LC Structured Data
      const extractRes = await fetch('/api/extract-lc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageParts: pages.map(p => ({ mimeType: p.mimeType, data: p.data })),
          textContent: extractedText
        })
      });

      let extractJson: any;
      try {
        const resText = await extractRes.text();
        extractJson = JSON.parse(resText);
      } catch (parseErr) {
        throw new Error(`Server returned invalid response (${extractRes.status} ${extractRes.statusText}). Please retry uploading the LC.`);
      }

      if (!extractRes.ok || !extractJson.success || !extractJson.data) {
        throw new Error(extractJson.error || `Failed to extract MT700 fields (${extractRes.status})`);
      }

      const rawLC = extractJson.data;

      // 2. Classify raw 46A and 47A clauses
      setProcessStatus('Classifying 46A/47A clauses by category, document target, and auto-baking rules...');

      const allRawClauses = [
        ...(rawLC.raw46AClauses || []).map((c: any, i: number) => ({
          id: `46A.${c.clauseNumber || i + 1}`,
          field: '46A',
          clauseNumber: c.clauseNumber || i + 1,
          clauseMarker: c.clauseMarker || `${c.clauseNumber || i + 1}.`,
          verbatimText: c.verbatimText
        })),
        ...(rawLC.raw47AClauses || []).map((c: any, i: number) => ({
          id: `47A.${c.clauseNumber || i + 1}`,
          field: '47A',
          clauseNumber: c.clauseNumber || i + 1,
          clauseMarker: c.clauseMarker || `+`,
          verbatimText: c.verbatimText
        }))
      ];

      let classifiedClauses: any[] = [];
      try {
        const classifyRes = await fetch('/api/classify-clauses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clauses: allRawClauses })
        });
        const classifyJson = await classifyRes.json();
        if (classifyJson.data) {
          classifiedClauses = classifyJson.data;
        }
      } catch (classifyErr) {
        console.warn('Clause classification API warning, using heuristic mapping:', classifyErr);
      }

      // Merge classifications while preserving exact verbatim text
      const finalClauses: LCClause[] = allRawClauses.map(raw => {
        const matched = classifiedClauses.find(c => c.id === raw.id || (c.clauseNumber === raw.clauseNumber && c.field === raw.field));
        const appliesTo = matched?.appliesToDocument || matched?.affectedDocuments || (raw.field === '46A' ? ['invoice', 'packing_list'] : ['all']);
        const summary = matched?.instructionSummary || matched?.plainEnglishSummary || raw.verbatimText.slice(0, 100) + '...';
        const isAuto = matched?.isAutoAppliable !== undefined ? matched.isAutoAppliable : (matched?.type === 'bake_in_instruction' || raw.field === '46A');

        return {
          id: raw.id,
          field: raw.field as any,
          clauseNumber: raw.clauseNumber,
          clauseMarker: raw.clauseMarker,
          verbatimText: raw.verbatimText, // strictly character-for-character verbatim
          category: matched?.category || (raw.field === '46A' ? 'document_requirement' : 'banking_condition'),
          instructionSummary: summary,
          plainEnglishSummary: summary,
          type: matched?.type || (isAuto ? 'bake_in_instruction' : 'compliance_rule'),
          affectedDocuments: appliesTo,
          appliesToDocument: appliesTo,
          isAutoAppliable: isAuto,
          targetField: matched?.targetField || (isAuto ? 'invoice.declarationText' : undefined),
          instructionDetail: matched?.instructionDetail || (isAuto ? summary : undefined)
        };
      });

      const field46AClauses = finalClauses.filter(c => c.field === '46A' || c.id.startsWith('46A'));
      const field47AClauses = finalClauses.filter(c => c.field === '47A' || c.id.startsWith('47A'));

      const completeLC: LCDetails = {
        ...rawLC,
        field46AClauses,
        field47AClauses
      };

      onSaveLCDetails(completeLC, {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        pageCount: pages.length || 1
      });

      // 3. Reconcile against Stage 1/2 Contract and Pre-Shipment draft
      if (contractData) {
        setProcessStatus('Running discrepancy reconciliation between LC, Contract & Draft...');
        try {
          const reconRes = await fetch('/api/reconcile-lc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contractData,
              exportDraftData,
              lcDetails: completeLC
            })
          });

          const reconJson = await reconRes.json();
          if (reconJson.data) {
            onSaveDiscrepancies(reconJson.data);
          }
        } catch (reconErr) {
          console.warn('LC reconciliation API warning:', reconErr);
        }
      }

      setProcessStatus('');
    } catch (err: any) {
      console.error('LC extraction failed:', err);
      setErrorMessage(err.message || 'Failed to extract Letter of Credit fields');
    } finally {
      setIsProcessing(false);
    }
  };

  // File Upload Handler for MT700 LC
  const handleLCUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLastUploadedLCFile(file);
    await processLCFile(file);
  };

  const handleLCRetry = () => {
    if (lastUploadedLCFile) {
      processLCFile(lastUploadedLCFile);
    }
  };

  // Upload MT707 Amendment
  const handleAmendmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lcDetails) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessStatus('Extracting SWIFT MT707 Amendment changes...');

    try {
      const { pages, extractedText } = await convertFileToVisionParts(file);

      const res = await fetch('/api/extract-amendment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageParts: pages.map(p => ({ mimeType: p.mimeType, data: p.data })),
          textContent: extractedText,
          currentLC: lcDetails
        })
      });

      let json: any;
      try {
        const resText = await res.text();
        json = JSON.parse(resText);
      } catch (parseErr) {
        throw new Error(`Server returned invalid response (${res.status} ${res.statusText}). Please retry uploading the amendment.`);
      }

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Failed to extract amendment (${res.status})`);
      }

      const amd: LCAmendment = {
        ...json.data,
        id: `AMD-${Date.now()}`,
        appliedAt: new Date().toISOString()
      };

      // Set pending amendment and open interactive diff modal
      setPendingAmendment(amd);
      setShowDiffModal(true);
      setShowAmendmentModal(false);
    } catch (err: any) {
      console.error('Amendment extraction error:', err);
      setErrorMessage(`Amendment error: ${err.message || 'Failed to extract amendment'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter clauses
  const allClauses = [
    ...(lcDetails?.field46AClauses || []),
    ...(lcDetails?.field47AClauses || [])
  ];

  const filteredClauses = allClauses.filter(clause => {
    // Category filter
    if (clauseCategoryFilter !== 'all') {
      if (clauseCategoryFilter === '46A' && clause.field !== '46A') return false;
      if (clauseCategoryFilter === '47A' && clause.field !== '47A') return false;
      if (clauseCategoryFilter === 'bake_in' && !clause.isAutoAppliable && clause.type !== 'bake_in_instruction') return false;
      if (clauseCategoryFilter === 'compliance' && clause.isAutoAppliable) return false;
      if (['document_requirement', 'declaration', 'shipping_rule', 'banking_condition', 'special_instruction', 'discrepancy_rule'].includes(clauseCategoryFilter)) {
        if (clause.category !== clauseCategoryFilter) return false;
      }
    }

    // Auto-appliable filter
    if (autoAppliableFilter !== null) {
      if (clause.isAutoAppliable !== autoAppliableFilter) return false;
    }

    // Document target filter
    if (docFilter !== 'all') {
      const docs = clause.appliesToDocument || clause.affectedDocuments || [];
      if (!docs.includes(docFilter as any) && !docs.includes('all')) {
        return false;
      }
    }
    return true;
  });

  const handleLCFieldUpdate = (fieldPath: string, newValue: any) => {
    if (!lcDetails) return;
    const clone = JSON.parse(JSON.stringify(lcDetails));
    
    const parts = fieldPath.split('.');
    if (parts.length === 1) {
      clone[parts[0]] = newValue;
    } else if (parts.length === 2) {
      if (!clone[parts[0]]) clone[parts[0]] = {};
      clone[parts[0]][parts[1]] = newValue;
    } else if (parts.length === 3) {
      if (!clone[parts[0]]) clone[parts[0]] = {};
      if (!clone[parts[0]][parts[1]]) clone[parts[0]][parts[1]] = {};
      clone[parts[0]][parts[1]][parts[2]] = newValue;
    }

    onSaveLCDetails(clone);
  };

  const handleClauseUpdate = (clauseId: string, field: 'verbatimText' | 'instructionSummary', newValue: string) => {
    if (!lcDetails) return;
    const updateClauses = (clauses?: LCClause[]) =>
      (clauses || []).map(c => c.id === clauseId ? { ...c, [field]: newValue } : c);

    const clone: LCDetails = {
      ...lcDetails,
      field46AClauses: updateClauses(lcDetails.field46AClauses),
      field47AClauses: updateClauses(lcDetails.field47AClauses)
    };
    onSaveLCDetails(clone);
  };

  // Discrepancy counts
  const criticalCount = discrepancies.filter(d => d.severity === 'amendment_required').length;
  const reviewCount = discrepancies.filter(d => d.severity === 'review').length;
  const infoCount = discrepancies.filter(d => d.severity === 'info').length;

  const getSeverityBadge = (sev: Discrepancy['severity']) => {
    switch (sev) {
      case 'amendment_required':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
            Amendment Required
          </span>
        );
      case 'review':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Review & Align
          </span>
        );
      case 'info':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Conforming / Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Upload Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-bold text-slate-900">LC & Clause Intelligence</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label
              htmlFor="lc-upload-input"
              className="cursor-pointer px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload
              <input
                id="lc-upload-input"
                type="file"
                accept=".pdf,image/*"
                onChange={handleLCUpload}
                className="hidden"
                disabled={isProcessing}
              />
            </label>

            {lcDetails && (
              <button
                id="upload-mt707-amendment-btn"
                onClick={() => setShowAmendmentModal(true)}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-purple-900 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <FileCode2 className="w-4 h-4 text-purple-700" />
                Apply MT707 Amendment
              </button>
            )}
          </div>
        </div>

        {/* Error Alert State */}
        {errorMessage && !isProcessing && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-3 text-rose-900 text-xs mb-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 text-sm">Letter of Credit Extraction Notice</p>
                <p className="text-rose-700 mt-1">{errorMessage}</p>
                <div className="mt-3 flex items-center gap-2">
                  {lastUploadedLCFile && (
                    <button
                      onClick={handleLCRetry}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Extraction
                    </button>
                  )}
                  {onLoadPresetLC && !lcDetails && (
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        onLoadPresetLC();
                      }}
                      className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-800 rounded-md font-medium text-xs transition-colors"
                    >
                      Load Sample MT700 LC
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

        {/* Processing State */}
        {isProcessing && (
          <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center gap-3 text-blue-900 text-xs font-medium animate-pulse mb-4">
            <Sparkles className="w-5 h-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-semibold">{processStatus}</p>
              <p className="text-[11px] text-blue-700 mt-0.5">Auditing verbatim bank clauses with Gemini multimodal vision models...</p>
            </div>
          </div>
        )}

        {/* If no LC is loaded yet */}
        {!lcDetails && !isProcessing && (
          <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/60">
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 mb-4">No Letter of Credit Loaded</h3>
            <label
              htmlFor="lc-upload-input"
              className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload
            </label>
          </div>
        )}

        {/* LC Details Content */}
        {lcDetails && (
          <div className="space-y-6 pt-2">
            {/* 1. DISCREPANCY & RECONCILIATION AUDIT BANNER (ABOVE LC SUMMARY) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>LC Reconciliation & Discrepancy Audit</span>
                  </div>
                  <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    {discrepancies.length} Checked
                  </span>
                  {criticalCount > 0 && (
                    <span className="text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                      {criticalCount} Amendment Required
                    </span>
                  )}
                  {reviewCount > 0 && (
                    <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                      {reviewCount} Review Needed
                    </span>
                  )}
                  {infoCount > 0 && (
                    <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                      {infoCount} Conforming
                    </span>
                  )}
                </div>

                <button
                  onClick={async () => {
                    if (!contractData || !exportDraftData || !lcDetails) return;
                    setIsProcessing(true);
                    setProcessStatus('Re-running discrepancy reconciliation...');
                    const res = await fetch('/api/reconcile-lc', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contractData, exportDraftData, lcDetails })
                    });
                    const j = await res.json();
                    if (j.data) onSaveDiscrepancies(j.data);
                    setIsProcessing(false);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto"
                >
                  <RefreshCw className="w-3 h-3" /> Re-Audit Discrepancies
                </button>
              </div>

              {discrepancies.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No discrepancies detected. LC parameters match the sales contract and export drafts perfectly.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {discrepancies.map((disc) => (
                    <div
                      key={disc.id}
                      className={`p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                        disc.severity === 'amendment_required'
                          ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs'
                          : disc.severity === 'review'
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
                          : 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs">{disc.title}</span>
                          {getSeverityBadge(disc.severity)}
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed">{disc.explanation}</p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1.5">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-1.5 bg-white/80 rounded border border-slate-200/80">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Contract / Draft:</span>
                            <span className="font-bold text-slate-800 text-[11px]">{disc.contractValue}</span>
                          </div>
                          <div className="p-1.5 bg-white/80 rounded border border-slate-200/80">
                            <span className="text-[10px] text-slate-500 font-semibold block uppercase">LC (MT700):</span>
                            <span className="font-bold text-slate-800 text-[11px]">{disc.lcValue}</span>
                          </div>
                        </div>

                        <div className="p-1.5 bg-white rounded border border-slate-200 text-[11px] flex items-start gap-1.5 text-slate-800">
                          <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                          <span><strong>Action:</strong> {disc.suggestedAction}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. STRUCTURED LC SUMMARY PANEL */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Documentary Credit No:</span>
                  <span className="text-xs font-mono font-bold text-blue-800 bg-blue-100/80 px-2.5 py-0.5 rounded border border-blue-200">
                    <InlineEditable value={lcDetails.lcNumber} onSave={v => handleLCFieldUpdate('lcNumber', v)} />
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    • Issued:
                    <InlineEditable value={lcDetails.issueDate} onSave={v => handleLCFieldUpdate('issueDate', v)} />
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <span className="flex items-center gap-1">
                    Advising Ref:
                    <InlineEditable value={lcDetails.advisingBankRef || '—'} onSave={v => handleLCFieldUpdate('advisingBankRef', v)} />
                  </span>
                  <span className="text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold">
                    <InlineEditable value={lcDetails.applicableRules || 'UCP LATEST VERSION'} onSave={v => handleLCFieldUpdate('applicableRules', v)} />
                  </span>
                </div>
              </div>

              {/* Grid of Swift Parameters */}
              <div className="p-4 space-y-4">
                {/* Applicant (:50) and Beneficiary (:59) Full Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-teal-50/70 rounded-lg border border-teal-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-teal-800 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-teal-600" />
                        Field :50: Applicant (Buyer)
                      </span>
                      <span className="text-[10px] bg-white px-1.5 py-0.2 rounded text-teal-700 font-semibold border border-teal-200">
                        <InlineEditable value={lcDetails.applicant?.country || 'Foreign Buyer'} onSave={v => handleLCFieldUpdate('applicant.country', v)} />
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-xs">
                      <InlineEditable value={lcDetails.applicant?.name || '—'} onSave={v => handleLCFieldUpdate('applicant.name', v)} />
                    </p>
                    <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                      <InlineEditable value={lcDetails.applicant?.address || 'No address specified'} multiline onSave={v => handleLCFieldUpdate('applicant.address', v)} />
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-blue-800 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-600" />
                        Field :59: Beneficiary (Exporter)
                      </span>
                      <span className="text-[10px] bg-white px-1.5 py-0.2 rounded text-blue-700 font-semibold border border-blue-200">
                        Exporter
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-xs">
                      <InlineEditable value={lcDetails.beneficiary?.name || 'Lahoti Overseas Limited'} onSave={v => handleLCFieldUpdate('beneficiary.name', v)} />
                    </p>
                    <p className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                      <InlineEditable value={lcDetails.beneficiary?.address || '307 Arun Chambers, Tardeo Road, Mumbai Central, Mumbai 400034, India'} multiline onSave={v => handleLCFieldUpdate('beneficiary.address', v)} />
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Issuing Bank</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      <InlineEditable value={lcDetails.issuingBank?.name || '—'} onSave={v => handleLCFieldUpdate('issuingBank.name', v)} />
                    </span>
                    <span className="text-[11px] text-slate-500 block flex items-center gap-1">
                      <InlineEditable value={lcDetails.issuingBank?.city || ''} onSave={v => handleLCFieldUpdate('issuingBank.city', v)} placeholder="City" />,
                      <InlineEditable value={lcDetails.issuingBank?.country || ''} onSave={v => handleLCFieldUpdate('issuingBank.country', v)} placeholder="Country" />
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">LC Amount & Tolerance</span>
                    <span className="font-bold text-blue-900 text-sm flex items-center gap-1">
                      <InlineEditable value={lcDetails.currency || 'USD'} onSave={v => handleLCFieldUpdate('currency', v)} />
                      <InlineEditable type="number" value={lcDetails.amount} onSave={v => handleLCFieldUpdate('amount', parseFloat(v) || 0)} />
                    </span>
                    <span className="text-[11px] text-slate-500 block flex items-center gap-1">
                      Tol: +<InlineEditable type="number" value={lcDetails.tolerancePercentage?.positive || 0} onSave={v => handleLCFieldUpdate('tolerancePercentage.positive', parseFloat(v) || 0)} />% /
                      -<InlineEditable type="number" value={lcDetails.tolerancePercentage?.negative || 0} onSave={v => handleLCFieldUpdate('tolerancePercentage.negative', parseFloat(v) || 0)} />%
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Tenor & Negotiation</span>
                    <span className="font-semibold text-slate-800 block">
                      <InlineEditable value={lcDetails.tenor || 'At Sight'} onSave={v => handleLCFieldUpdate('tenor', v)} />
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      <InlineEditable value={lcDetails.availableBy || 'BY NEGOTIATION'} onSave={v => handleLCFieldUpdate('availableBy', v)} />
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Key Cutoff Dates</span>
                    <div className="flex justify-between items-center text-[11px] mt-0.5">
                      <span className="text-slate-500">Latest Ship:</span>
                      <span className="font-semibold text-slate-800">
                        <InlineEditable value={lcDetails.latestShipmentDate || '—'} onSave={v => handleLCFieldUpdate('latestShipmentDate', v)} />
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Expiry Date:</span>
                      <span className="font-semibold text-rose-700 flex items-center gap-1">
                        <InlineEditable value={lcDetails.expiryDate || '—'} onSave={v => handleLCFieldUpdate('expiryDate', v)} />
                        (<InlineEditable value={lcDetails.expiryPlace || 'India'} onSave={v => handleLCFieldUpdate('expiryPlace', v)} />)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Goods Description Verbatim & Ports */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      Field 45A: Verbatim Goods Description (Character-for-Character)
                    </span>
                    <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                      Contract Ref:
                      <InlineEditable value={lcDetails.contractReference || '—'} onSave={v => handleLCFieldUpdate('contractReference', v)} />
                    </span>
                  </div>
                  <div className="font-mono text-slate-800 bg-white p-2.5 rounded border border-slate-200 leading-relaxed text-[11px] whitespace-pre-wrap">
                    <InlineEditable value={lcDetails.goodsDescriptionVerbatim} multiline onSave={v => handleLCFieldUpdate('goodsDescriptionVerbatim', v)} />
                  </div>
                  {lcProducts.length > 1 && (
                    <div className="text-[11px] bg-amber-50 border border-amber-200 rounded p-2 space-y-0.5">
                      <div className="font-bold text-amber-900">This LC covers {lcProducts.length} products. Each shipment's documents show only the product(s) it carries.</div>
                      {lcProducts.map((p, i) => (
                        <div key={i} className="text-amber-900">
                          {i + 1}. {p.description.split('\n')[0]} — {p.quantity.toLocaleString('en-US')} {p.uom} @ {p.unitPrice}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1 text-slate-600">
                    <div><strong>Port of Loading:</strong> <InlineEditable value={lcDetails.portOfLoading || 'Any Port in India'} onSave={v => handleLCFieldUpdate('portOfLoading', v)} /></div>
                    <div><strong>Port of Discharge:</strong> <InlineEditable value={lcDetails.portOfDischarge || '—'} onSave={v => handleLCFieldUpdate('portOfDischarge', v)} /></div>
                    <div><strong>Partial Shipment:</strong> <InlineEditable value={lcDetails.partialShipment || 'NOT ALLOWED'} onSave={v => handleLCFieldUpdate('partialShipment', v)} /></div>
                    <div><strong>Transhipment:</strong> <InlineEditable value={lcDetails.transhipment || 'NOT ALLOWED'} onSave={v => handleLCFieldUpdate('transhipment', v)} /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. LC CLAUSE INTELLIGENCE TABLE (UNDER LC SUMMARY) */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>LC Clause Intelligence (Fields 46A & 47A)</span>
                    <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {allClauses.length} Clauses
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Classified verbatim banking clauses with document mappings and auto-appliable flags for Stage 4 generation
                  </p>
                </div>

                {/* Secondary Document target filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Target Doc:</span>
                  <select
                    value={docFilter}
                    onChange={(e) => setDocFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-medium text-slate-700 shadow-2xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Documents ({allClauses.length})</option>
                    <option value="invoice">Commercial Invoice</option>
                    <option value="packing_list">Packing List</option>
                    <option value="bill_of_lading">Bill of Lading</option>
                    <option value="certificate_of_origin">Certificate of Origin</option>
                    <option value="beneficiary_certificate">Beneficiary Certificate</option>
                    <option value="bill_of_exchange">Bill of Exchange</option>
                  </select>
                </div>
              </div>

              {/* Category Filter Chips Bar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => { setClauseCategoryFilter('all'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'all' && autoAppliableFilter === null
                      ? 'bg-slate-900 text-white shadow-xs font-semibold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({allClauses.length})
                </button>

                <button
                  onClick={() => { setClauseCategoryFilter('document_requirement'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'document_requirement'
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100/70'
                  }`}
                >
                  Document Requirements
                </button>

                <button
                  onClick={() => { setClauseCategoryFilter('declaration'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'declaration'
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100/70'
                  }`}
                >
                  Declarations / Quotes
                </button>

                <button
                  onClick={() => { setClauseCategoryFilter('shipping_rule'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'shipping_rule'
                      ? 'bg-sky-600 text-white shadow-xs font-semibold'
                      : 'bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100/70'
                  }`}
                >
                  Shipping & Logistics
                </button>

                <button
                  onClick={() => { setClauseCategoryFilter('banking_condition'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'banking_condition'
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
                  }`}
                >
                  Banking Conditions
                </button>

                <button
                  onClick={() => { setClauseCategoryFilter('special_instruction'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'special_instruction'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'bg-purple-50 border border-purple-200 text-purple-800 hover:bg-purple-100/70'
                  }`}
                >
                  Special Instructions
                </button>

                <button
                  onClick={() => { setClauseCategoryFilter('discrepancy_rule'); setAutoAppliableFilter(null); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    clauseCategoryFilter === 'discrepancy_rule'
                      ? 'bg-amber-600 text-white shadow-xs font-semibold'
                      : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100/70'
                  }`}
                >
                  Discrepancy Rules
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>

                <button
                  onClick={() => {
                    setAutoAppliableFilter(autoAppliableFilter === true ? null : true);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    autoAppliableFilter === true
                      ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100/70'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Appliable Only
                </button>
              </div>

              {/* Clauses Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-16 text-center">Clause</th>
                      <th className="p-3 w-36">Category</th>
                      <th className="p-3 min-w-[340px]">Verbatim Text (Character-for-Character)</th>
                      <th className="p-3 min-w-[220px]">Instruction Summary</th>
                      <th className="p-3 w-36">Applies To</th>
                      <th className="p-3 w-28 text-center">Execution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClauses.map((clause) => {
                      const categoryColors: Record<string, string> = {
                        document_requirement: 'bg-blue-50 text-blue-800 border-blue-200',
                        declaration: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                        shipping_rule: 'bg-sky-50 text-sky-800 border-sky-200',
                        banking_condition: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        special_instruction: 'bg-purple-50 text-purple-800 border-purple-200',
                        discrepancy_rule: 'bg-amber-50 text-amber-800 border-amber-200'
                      };
                      const catClass = categoryColors[clause.category || ''] || 'bg-slate-50 text-slate-800 border-slate-200';
                      const formattedCat = (clause.category || (clause.field === '46A' ? 'document_requirement' : 'banking_condition')).replace('_', ' ');

                      return (
                        <tr key={clause.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center align-top">
                            <span className="font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono text-[11px]">
                              {clause.id}
                            </span>
                          </td>

                          <td className="p-3 align-top">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded border block text-center uppercase tracking-wide capitalize ${catClass}`}>
                              {formattedCat}
                            </span>
                          </td>

                          <td className="p-3 align-top">
                            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 font-mono text-slate-800 text-[11px] leading-relaxed whitespace-pre-wrap">
                              <InlineEditable
                                value={clause.verbatimText}
                                multiline
                                onSave={v => handleClauseUpdate(clause.id, 'verbatimText', v)}
                              />
                            </div>
                          </td>

                          <td className="p-3 align-top text-slate-700">
                            <div className="font-medium text-slate-900 leading-snug">
                              <InlineEditable
                                value={clause.instructionSummary || clause.plainEnglishSummary}
                                multiline
                                onSave={v => handleClauseUpdate(clause.id, 'instructionSummary', v)}
                              />
                            </div>
                            {clause.targetField && (
                              <p className="text-[10px] text-blue-800 bg-blue-50/90 p-1.5 rounded border border-blue-200 mt-1.5 font-mono">
                                <strong>Target:</strong> {clause.targetField}
                              </p>
                            )}
                          </td>

                          <td className="p-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {(clause.appliesToDocument || clause.affectedDocuments || []).map((doc, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 capitalize"
                                >
                                  {doc.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="p-3 align-top text-center">
                            {clause.isAutoAppliable || clause.type === 'bake_in_instruction' ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Auto-Bake
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                                Audit Rule
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Amendment History List */}
            {amendments.length > 0 && (
              <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-purple-950">
                    <FileCode2 className="w-4 h-4 text-purple-700" />
                    Applied SWIFT MT707 Amendments ({amendments.length})
                  </div>
                  <span className="text-[11px] text-purple-700 font-medium">Audit trail synchronized</span>
                </div>

                <div className="space-y-2">
                  {amendments.map((amd) => (
                    <div key={amd.id} className="p-3 bg-white rounded-lg border border-purple-200 text-xs space-y-2 shadow-2xs">
                      <div className="flex justify-between font-bold text-purple-900">
                        <span>Amendment #{amd.amendmentNo} (Dated {amd.amendmentDate})</span>
                        <span className="text-[11px] font-normal text-slate-500">Applied {amd.appliedAt.slice(0, 10)}</span>
                      </div>
                      <p className="text-slate-700 text-[11px]">{amd.narrative}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                        {amd.changes.map((ch, ci) => (
                          <div key={ci} className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[11px]">
                            <span className="font-bold text-slate-800 block">{ch.field}</span>
                            <span className="text-rose-700 line-through mr-1">{ch.oldValue}</span>
                            <span className="text-emerald-700 font-semibold">{ch.newValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Nav Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                id="back-to-stage-2-btn"
                onClick={onBackToStage2}
                className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Contract
              </button>

              <button
                id="proceed-to-stage-4-btn"
                onClick={onProceedToStage4}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-colors"
              >
                Next: Upload Pre-Shipment Invoice (Stage 3)
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Amendment Upload / Sample Modal */}
      {showAmendmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-purple-700" />
                <h3 className="text-sm font-bold text-slate-900">Apply SWIFT MT707 Amendment</h3>
              </div>
              <button
                onClick={() => setShowAmendmentModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Upload a scanned MT707 bank amendment PDF, or load the pre-configured MT707 sample to patch presentation days and extend expiry dates.
            </p>

            <div className="space-y-3 pt-2">
              <label className="cursor-pointer w-full p-4 border-2 border-dashed border-purple-300 hover:border-purple-500 rounded-xl bg-purple-50/50 flex flex-col items-center justify-center gap-1.5 text-purple-900 transition-colors">
                <Upload className="w-6 h-6 text-purple-600" />
                <span className="text-xs font-bold">Upload MT707 PDF / Image</span>
                <span className="text-[10px] text-purple-700">Multimodal Gemini Vision Extraction</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleAmendmentUpload}
                  className="hidden"
                />
              </label>

              <div className="text-center text-xs text-slate-400 font-medium">OR</div>

              <button
                onClick={() => {
                  const sampleAmd: LCAmendment = {
                    id: `AMD-${Date.now()}`,
                    amendmentNo: '001',
                    amendmentDate: '2026-03-25',
                    narrative: 'SWIFT MT707 Amendment to Documentary Credit: Presentation period extended to 21 days; Expiry date extended to 15 May 2026.',
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
                    patchedClauses: [
                      {
                        id: '46A.1',
                        field: '46A',
                        clauseNumber: 1,
                        clauseMarker: '1.',
                        verbatimText: "Signed commercial invoice in triplicate, including seller's declaration that the invoices and shipped goods are in accordance with sales contract S/0467/25-26 dd. 24.02.2026. (Amended)",
                        plainEnglishSummary: "Provide 3 signed commercial invoices with exact seller's declaration citing sales contract S/0467/25-26 dated 24.02.2026.",
                        type: 'bake_in_instruction',
                        affectedDocuments: ['invoice'],
                        targetField: 'invoice.declarationText'
                      }
                    ],
                    appliedAt: new Date().toISOString()
                  };
                  setPendingAmendment(sampleAmd);
                  setShowDiffModal(true);
                  setShowAmendmentModal(false);
                }}
                className="w-full p-3 bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-2xs"
              >
                <Sparkles className="w-4 h-4 text-purple-600" />
                Load Sample MT707 Amendment #001 (Diff & Extend Expiry / Presentation)
              </button>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAmendmentModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Amendment Diff & Verification Modal */}
      {pendingAmendment && (
        <AmendmentDiffModal
          isOpen={showDiffModal}
          onClose={() => {
            setShowDiffModal(false);
            setPendingAmendment(null);
          }}
          amendment={pendingAmendment}
          existingClauses={allClauses}
          onConfirmApply={(amd) => {
            onAddAmendment(amd);
            setShowDiffModal(false);
            setPendingAmendment(null);
          }}
        />
      )}
    </div>
  );
};
