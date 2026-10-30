import React, { useState, useEffect } from 'react';
import {
  WorkflowState,
  SaleContractData,
  ExportData,
  LCDetails,
  Discrepancy,
  LCAmendment,
  FinalDocumentSet,
  ComplianceChecklist,
  SourceDocument,
  BillOfLadingFinal,
  PreShipmentInvoiceData,
  ShipmentTransportDetails,
  LCLedgerEntry
} from '../types';
import { HeaderStepper } from './HeaderStepper';
import { SourceDocsSidebar } from './SourceDocsSidebar';
import { Stage1Contract } from './Stage1Contract';
import { Stage2PreShipment } from './Stage2PreShipment';
import { Stage3LCIntelligence } from './Stage3LCIntelligence';
import { Stage4BillOfLading } from './Stage4BillOfLading';
import { Stage5FinalDocuments } from './Stage5FinalDocuments';
import { LCLedgerPanel } from './LCLedgerPanel';
import { PreShipmentUpload } from './PreShipmentUpload';
import {
  sampleContractWeber,
  sampleContractSanjana,
  sampleExportDraftWeber,
  sampleExportDraftSanjana,
  sampleLCWeber,
  sampleDiscrepanciesWeber,
  sampleAmendment01,
  sampleFinalDocsWeber,
  sampleComplianceChecklistWeber
} from '../data/samplePresets';
import {
  exportDataFromPreShipment,
  generateFinalDocumentSet,
  generateComplianceChecklist,
  shippedLcItems
} from '../lib/documentGenerators';
import { saveLedgerLC } from '../lib/lcLedger';

const LOCAL_STORAGE_KEY = 'export_lahoti_workflow_state_v2';
const STATE_VERSION = 4;

const EMPTY_WORKFLOW: WorkflowState = {
  currentStage: 1,
  sourceDocuments: [],
  contractData: null,
  exportDraftData: null,
  preShipmentData: null,
  shipmentDetails: null,
  lcDetails: null,
  billOfLading: null,
  amendments: [],
  discrepancies: [],
  finalDocuments: null,
  complianceChecklist: null
};

export function App() {
  const [workflow, setWorkflow] = useState<WorkflowState>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.__v === STATE_VERSION) {
          const { __v, ...rest } = parsed;
          return rest as WorkflowState;
        } else {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.error('Failed to load workflow state from localStorage:', e);
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (_) {}
    }
    return EMPTY_WORKFLOW;
  });

  const [ledgerEntry, setLedgerEntry] = useState<LCLedgerEntry | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...workflow, __v: STATE_VERSION }));
    } catch (e) {
      console.error('Failed to persist workflow state:', e);
    }
  }, [workflow]);

  // Stage 1 Handlers
  const handleSaveContract = (
    data: SaleContractData,
    docMetadata?: { name: string; size: string; pageCount: number }
  ) => {
    let updatedDocs = [...workflow.sourceDocuments];
    if (docMetadata) {
      const newDoc: SourceDocument = {
        id: `doc-${Date.now()}`,
        name: docMetadata.name,
        type: 'contract',
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        size: docMetadata.size,
        pageCount: docMetadata.pageCount
      };
      updatedDocs = [newDoc, ...updatedDocs.filter(d => d.type !== 'contract')];
    }

    // A newly uploaded contract starts a fresh file; edits to the current contract keep the rest
    setWorkflow(prev => ({
      ...prev,
      contractData: data,
      exportDraftData: docMetadata ? null : prev.exportDraftData,
      preShipmentData: docMetadata ? null : prev.preShipmentData,
      shipmentDetails: docMetadata ? null : prev.shipmentDetails,
      lcDetails: docMetadata ? null : prev.lcDetails,
      billOfLading: docMetadata ? null : prev.billOfLading,
      amendments: docMetadata ? [] : prev.amendments,
      discrepancies: docMetadata ? [] : prev.discrepancies,
      finalDocuments: docMetadata ? null : prev.finalDocuments,
      complianceChecklist: docMetadata ? null : prev.complianceChecklist,
      sourceDocuments: updatedDocs
    }));
  };

  const handleProceedToStage2 = () => {
    if (!workflow.contractData) return;
    setWorkflow(prev => ({ ...prev, currentStage: 2 }));
  };

  // Rebuilds the final document set from the current pre-shipment draft, LC and LR details,
  // keeping any manual edits to the B/L instruction.
  const rebuildDocs = (
    prev: WorkflowState,
    patch: Partial<WorkflowState>
  ): Partial<WorkflowState> => {
    const next = { ...prev, ...patch };
    if (!next.exportDraftData || !next.lcDetails) return patch;
    const docs = generateFinalDocumentSet(next.exportDraftData, next.lcDetails, next.amendments, undefined, next.shipmentDetails);
    const bl = next.billOfLading && !patch.lcDetails && !patch.exportDraftData
      ? {
          ...next.billOfLading,
          shippingBillNo: next.shipmentDetails?.shippingBillNo || next.billOfLading.shippingBillNo,
          shippingBillDate: next.shipmentDetails?.shippingBillDate || next.billOfLading.shippingBillDate,
          containerSealNos: next.shipmentDetails?.containerSealNo || next.billOfLading.containerSealNos
        }
      : docs.billOfLading;
    docs.billOfLading = bl;
    return {
      ...patch,
      finalDocuments: docs,
      billOfLading: bl,
      complianceChecklist: generateComplianceChecklist(next.lcDetails, next.shipmentDetails?.transportDocDate)
    };
  };

  // Stage 2 Handlers (LC)
  const handleSaveLCDetails = (
    lc: LCDetails,
    docMetadata?: { name: string; size: string; pageCount: number }
  ) => {
    setWorkflow(prev => {
      let updatedDocs = [...prev.sourceDocuments];
      if (docMetadata) {
        const newDoc: SourceDocument = {
          id: `doc-lc-${Date.now()}`,
          name: docMetadata.name,
          type: 'lc',
          uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          size: docMetadata.size,
          pageCount: docMetadata.pageCount
        };
        updatedDocs = [...updatedDocs.filter(d => d.type !== 'lc'), newDoc];
      }
      // Re-derive the draft so the LC rate / ports flow into it
      const draft = prev.preShipmentData
        ? exportDataFromPreShipment(prev.preShipmentData, lc, prev.contractData)
        : prev.exportDraftData;
      return {
        ...prev,
        sourceDocuments: updatedDocs,
        ...rebuildDocs(prev, { lcDetails: lc, exportDraftData: draft })
      };
    });
    // Register / refresh the LC in the ledger (keeps earlier shipments)
    saveLedgerLC(lc, workflow.contractData)
      .then(entry => setLedgerEntry(entry))
      .catch(err => console.warn('LC ledger save failed:', err));
  };

  // LC found in the ledger by number: reuse it instead of re-uploading
  const handleLoadLedgerEntry = (entry: LCLedgerEntry) => {
    setWorkflow(prev => ({
      ...prev,
      contractData: prev.contractData || (entry.contractData as SaleContractData) || null,
      ...rebuildDocs(prev, { lcDetails: entry.lcDetails })
    }));
  };

  const handleSaveDiscrepancies = (discrepancies: Discrepancy[]) => {
    setWorkflow(prev => ({
      ...prev,
      discrepancies
    }));
  };

  const handleAddAmendment = (amendment: LCAmendment) => {
    setWorkflow(prev => {
      const amendments = [...prev.amendments, amendment];
      let lc = prev.lcDetails;
      if (lc) {
        amendment.changes.forEach(ch => {
          const f = ch.field.toLowerCase();
          if (f.includes('expiry')) lc = { ...lc!, expiryDate: ch.newValue };
          if (f.includes('latest') || f.includes('44c')) lc = { ...lc!, latestShipmentDate: ch.newValue };
          if (f.includes('presentation')) {
            const match = ch.newValue.match(/\d+/);
            if (match) lc = { ...lc!, presentationPeriodDays: parseInt(match[0], 10) };
          }
          if (f.includes('amount') || f.includes('32b')) {
            const amt = parseFloat(ch.newValue.replace(/[^\d.]/g, ''));
            if (!isNaN(amt) && amt > 0) lc = { ...lc!, amount: amt };
          }
        });
        saveLedgerLC(lc, prev.contractData).then(setLedgerEntry).catch(err => console.warn('LC ledger save failed:', err));
      }
      const newDoc: SourceDocument = {
        id: `doc-amd-${Date.now()}`,
        name: `MT707_Amendment_${amendment.amendmentNo}.pdf`,
        type: 'amendment',
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        size: '',
        pageCount: 1
      };
      return {
        ...prev,
        sourceDocuments: [...prev.sourceDocuments, newDoc],
        ...rebuildDocs(prev, { amendments, lcDetails: lc })
      };
    });
  };

  // Stage 3 Handlers (pre-shipment invoice = one shipment)
  const handlePreShipmentExtracted = (
    pre: PreShipmentInvoiceData,
    docMetadata?: { name: string; size: string; pageCount: number }
  ) => {
    setWorkflow(prev => {
      const draft = exportDataFromPreShipment(pre, prev.lcDetails, prev.contractData);
      const newDoc: SourceDocument | null = docMetadata ? {
        id: `doc-pre-${Date.now()}`,
        name: docMetadata.name,
        type: 'preshipment',
        uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        size: docMetadata.size,
        pageCount: docMetadata.pageCount
      } : null;
      // A new invoice is a new shipment: its LR details start empty
      const isNewInvoice = prev.preShipmentData?.invoiceNo !== pre.invoiceNo;
      return {
        ...prev,
        sourceDocuments: newDoc ? [...prev.sourceDocuments.filter(d => d.type !== 'preshipment'), newDoc] : prev.sourceDocuments,
        preShipmentData: pre,
        ...rebuildDocs(prev, {
          exportDraftData: draft,
          shipmentDetails: isNewInvoice ? null : prev.shipmentDetails,
          billOfLading: null
        })
      };
    });
  };

  const handleSaveExportData = (data: ExportData) => {
    setWorkflow(prev => ({ ...prev, ...rebuildDocs(prev, { exportDraftData: data }) }));
  };

  const handleProceedToStage4 = () => {
    if (!workflow.exportDraftData || !workflow.lcDetails) {
      alert('Upload the LC (stage 2) and the pre-shipment invoice (stage 3) first.');
      return;
    }
    setWorkflow(prev => ({
      ...prev,
      currentStage: 4,
      ...rebuildDocs(prev, { exportDraftData: prev.exportDraftData, billOfLading: null })
    }));
  };

  // Stage 4 Handlers (B/L instruction + LR / B/L details once issued)
  const handleUpdateBL = (bl: BillOfLadingFinal) => {
    setWorkflow(prev => ({
      ...prev,
      billOfLading: bl,
      finalDocuments: prev.finalDocuments ? { ...prev.finalDocuments, billOfLading: bl } : prev.finalDocuments
    }));
  };

  const handleUpdateShipmentDetails = (details: ShipmentTransportDetails) => {
    setWorkflow(prev => ({ ...prev, ...rebuildDocs(prev, { shipmentDetails: details }) }));
  };

  const handleProceedToStage5 = () => {
    if (!workflow.finalDocuments) {
      alert('Please complete the B/L stage before proceeding to final documents.');
      return;
    }
    if (!workflow.shipmentDetails?.transportDocNo &&
      !window.confirm('LR / B/L number and date are not entered yet. Final documents will show blanks for them. Continue?')) {
      return;
    }
    setWorkflow(prev => ({ ...prev, currentStage: 5 }));
  };

  const handleUpdateFinalDocs = (docs: FinalDocumentSet) => {
    setWorkflow(prev => ({
      ...prev,
      finalDocuments: docs,
      billOfLading: docs.billOfLading
    }));
  };


  // Preset Loaders
  const handleLoadPreset = (preset: 'weber' | 'sanjana') => {
    if (preset === 'weber') {
      setWorkflow({
        currentStage: 1,
        sourceDocuments: [
          {
            id: 'doc-contract-01',
            name: 'Weber_Heusser_Sales_Order_S0467.pdf',
            type: 'contract',
            uploadedAt: '2026-02-12 10:30',
            size: '248.5 KB',
            pageCount: 2
          },
          {
            id: 'doc-lc-01',
            name: 'DBS_Bank_MT700_Advice_LBW26IA100122.pdf',
            type: 'lc',
            uploadedAt: '2026-02-15 14:15',
            size: '412.0 KB',
            pageCount: 4
          }
        ],
        contractData: sampleContractWeber,
        exportDraftData: sampleExportDraftWeber,
        lcDetails: sampleLCWeber,
        billOfLading: sampleFinalDocsWeber.billOfLading,
        amendments: [],
        discrepancies: sampleDiscrepanciesWeber,
        finalDocuments: sampleFinalDocsWeber,
        complianceChecklist: sampleComplianceChecklistWeber
      });
    } else {
      setWorkflow({
        currentStage: 1,
        sourceDocuments: [
          {
            id: 'doc-contract-sanjana',
            name: 'Sanjana_Fabrics_Contract_S0403.pdf',
            type: 'contract',
            uploadedAt: '2026-02-18 11:00',
            size: '184.2 KB',
            pageCount: 1
          }
        ],
        contractData: sampleContractSanjana,
        exportDraftData: sampleExportDraftSanjana,
        lcDetails: null,
        billOfLading: null,
        amendments: [],
        discrepancies: [],
        finalDocuments: null,
        complianceChecklist: null
      });
    }
  };

  const handleLoadPresetLC = () => {
    const finalDocs = generateFinalDocumentSet(
      workflow.exportDraftData || sampleExportDraftWeber,
      sampleLCWeber,
      []
    );
    const compliance = generateComplianceChecklist(sampleLCWeber, '2026-03-05');

    const lcDoc: SourceDocument = {
      id: 'doc-lc-01',
      name: 'DBS_Bank_MT700_Advice_LBW26IA100122.pdf',
      type: 'lc',
      uploadedAt: '2026-02-15 14:15',
      size: '412.0 KB',
      pageCount: 4
    };

    setWorkflow(prev => ({
      ...prev,
      lcDetails: sampleLCWeber,
      billOfLading: finalDocs.billOfLading,
      discrepancies: sampleDiscrepanciesWeber,
      finalDocuments: finalDocs,
      complianceChecklist: compliance,
      sourceDocuments: [...prev.sourceDocuments.filter(d => d.type !== 'lc'), lcDoc]
    }));
  };

  const handleLoadSampleAmendment = () => {
    handleAddAmendment(sampleAmendment01);
  };

  const draftForLedger = workflow.exportDraftData;
  const currentShipment = draftForLedger && draftForLedger.invoiceNo && workflow.preShipmentData ? {
    invoiceNo: draftForLedger.invoiceNo,
    invoiceDate: draftForLedger.invoiceDate,
    quantity: Number(draftForLedger.totalQuantity) || 0,
    quantityUom: workflow.lcDetails?.goodsQuantityUom || draftForLedger.lineItems[0]?.uom || '',
    amount: Number(draftForLedger.totalAmount) || 0,
    freightAmount: draftForLedger.freightAmount,
    transportDocNo: workflow.shipmentDetails?.transportDocNo,
    transportDocDate: workflow.shipmentDetails?.transportDocDate,
    items: workflow.lcDetails
      ? shippedLcItems(workflow.lcDetails, draftForLedger).map(s => ({ lcItemIndex: s.lcIndex, quantity: s.quantity, amount: s.amount }))
      : [],
    status: (workflow.shipmentDetails?.transportDocNo ? 'shipped' : 'draft') as 'shipped' | 'draft'
  } : null;

  const handleReset = () => {
    setLedgerEntry(null);
    setWorkflow(EMPTY_WORKFLOW);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 antialiased font-sans">
      {/* Top Header Stepper */}
      <HeaderStepper
        workflow={workflow}
        onSelectStage={(stage) => setWorkflow(prev => ({ ...prev, currentStage: stage }))}
        onReset={handleReset}
        onLoadPreset={handleLoadPreset}
      />

      {/* Main Layout Area with running source docs sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 max-w-7xl">
        {/* Source Documents Running Sidebar */}
        <SourceDocsSidebar
          documents={workflow.sourceDocuments}
          amendments={workflow.amendments}
          lcDetails={workflow.lcDetails}
          onUploadNewDocClick={() => {
            setWorkflow(prev => ({ ...prev, currentStage: 1 }));
          }}
        />

        {/* Dynamic Stage View Component */}
        <main className="flex-1 min-w-0">
          {workflow.currentStage === 1 && (
            <Stage1Contract
              contractData={workflow.contractData}
              onSaveContract={handleSaveContract}
              onProceedToStage2={handleProceedToStage2}
              onLoadPreset={handleLoadPreset}
            />
          )}

          {workflow.currentStage >= 2 && (
            <LCLedgerPanel
              lcDetails={workflow.lcDetails}
              ledgerEntry={ledgerEntry}
              onLedgerChange={setLedgerEntry}
              onLoadEntry={handleLoadLedgerEntry}
              currentShipment={currentShipment}
            />
          )}

          {workflow.currentStage === 2 && (
            <Stage3LCIntelligence
              contractData={workflow.contractData}
              exportDraftData={workflow.exportDraftData}
              lcDetails={workflow.lcDetails}
              discrepancies={workflow.discrepancies}
              amendments={workflow.amendments}
              onSaveLCDetails={handleSaveLCDetails}
              onSaveDiscrepancies={handleSaveDiscrepancies}
              onAddAmendment={handleAddAmendment}
              onProceedToStage4={() => setWorkflow(prev => ({ ...prev, currentStage: 3 }))}
              onBackToStage2={() => setWorkflow(prev => ({ ...prev, currentStage: 1 }))}
              onLoadPresetLC={handleLoadPresetLC}
              onLoadSampleAmendment={handleLoadSampleAmendment}
            />
          )}

          {workflow.currentStage === 3 && (
            <>
              <PreShipmentUpload
                preShipment={workflow.preShipmentData || null}
                onExtracted={handlePreShipmentExtracted}
              />
              {workflow.exportDraftData && (
                <Stage2PreShipment
                  key={workflow.exportDraftData.invoiceNo}
                  exportData={workflow.exportDraftData}
                  onSaveExportData={handleSaveExportData}
                  onProceedToStage3={handleProceedToStage4}
                  onBackToStage1={() => setWorkflow(prev => ({ ...prev, currentStage: 2 }))}
                />
              )}
            </>
          )}

          {workflow.currentStage === 4 && workflow.billOfLading && workflow.lcDetails && workflow.exportDraftData && (
            <Stage4BillOfLading
              key={`${workflow.exportDraftData.invoiceNo}-${workflow.shipmentDetails?.transportDocNo || ''}`}
              billOfLading={workflow.billOfLading}
              lcDetails={workflow.lcDetails}
              exportData={workflow.exportDraftData}
              shipmentDetails={workflow.shipmentDetails || null}
              onUpdateShipmentDetails={handleUpdateShipmentDetails}
              onUpdateBL={handleUpdateBL}
              onProceedToStage5={handleProceedToStage5}
              onBackToStage3={() => setWorkflow(prev => ({ ...prev, currentStage: 3 }))}
            />
          )}

          {workflow.currentStage === 5 && workflow.finalDocuments && workflow.complianceChecklist && workflow.lcDetails && (
            <Stage5FinalDocuments
              finalDocuments={workflow.finalDocuments}
              compliance={workflow.complianceChecklist}
              lcDetails={workflow.lcDetails}
              onUpdateFinalDocs={handleUpdateFinalDocs}
              onBackToStage4={() => setWorkflow(prev => ({ ...prev, currentStage: 4 }))}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
