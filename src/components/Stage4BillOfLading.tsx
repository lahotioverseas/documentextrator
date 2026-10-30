import React, { useState } from 'react';
import {
  BillOfLadingFinal,
  LCDetails,
  ExportData,
  ShipmentTransportDetails
} from '../types';
import { sampleBankProfiles } from '../data/samplePresets';
import { BLDescriptionExtras } from './BLDescriptionExtras';
import {
  generateBillOfLadingPDF,
  generateBillOfLadingDOCX,
  downloadFileBlob
} from '../lib/exportGenerators';
import {
  Download,
  ArrowLeft,
  ArrowRight,
  FileText
} from 'lucide-react';

interface Stage4BillOfLadingProps {
  billOfLading: BillOfLadingFinal;
  lcDetails: LCDetails;
  exportData: ExportData;
  shipmentDetails: ShipmentTransportDetails | null;
  onUpdateShipmentDetails: (details: ShipmentTransportDetails) => void;
  onUpdateBL: (bl: BillOfLadingFinal) => void;
  onBackToStage3: () => void;
  onProceedToStage5: () => void;
}

const EditableField = ({ value, onChange, multiline = false, className = '' }: { value: string, onChange: (v: string) => void, multiline?: boolean, className?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);
  
  if (isEditing) {
    if (multiline) {
      return (
        <textarea 
          autoFocus 
          value={tempVal} 
          onChange={e => setTempVal(e.target.value)} 
          onBlur={() => { onChange(tempVal); setIsEditing(false); }} 
          className={`w-full p-1 border-2 border-blue-500 bg-white shadow-inner rounded outline-none resize-none text-slate-900 ${className}`} 
        />
      );
    }
    return (
      <input 
        autoFocus 
        type="text" 
        value={tempVal} 
        onChange={e => setTempVal(e.target.value)} 
        onBlur={() => { onChange(tempVal); setIsEditing(false); }} 
        className={`w-full p-1 border-2 border-blue-500 bg-white shadow-inner rounded outline-none text-slate-900 ${className}`} 
      />
    );
  }
  
  return (
    <span 
      onDoubleClick={() => { setTempVal(value); setIsEditing(true); }} 
      className={`cursor-pointer hover:bg-yellow-100 hover:ring-1 hover:ring-yellow-400 rounded px-1 -mx-1 transition-colors whitespace-pre-line ${className}`}
      title="Double click to edit"
    >
      {value || (
        <span className="text-slate-400 italic">Double click to add</span>
      )}
    </span>
  );
};

const EMPTY_SHIPMENT: ShipmentTransportDetails = { transportDocNo: '', transportDocDate: '' };

const SHIPMENT_FIELDS: Array<{ key: keyof ShipmentTransportDetails; label: string; placeholder?: string }> = [
  { key: 'transportDocNo', label: 'LR / B/L No.', placeholder: '26554' },
  { key: 'transportDocDate', label: 'LR / B/L Date (= shipment date)', placeholder: 'DD/MM/YYYY' },
  { key: 'vehicleOrVessel', label: 'Truck No. / Vessel & Voyage' },
  { key: 'containerSealNo', label: 'Container / Seal No.' },
  { key: 'shippingBillNo', label: 'Shipping Bill No.' },
  { key: 'shippingBillDate', label: 'Shipping Bill Date' },
  { key: 'customsEntryNo', label: 'B.C.P. Entry No. (land port)' },
  { key: 'customsEntryDate', label: 'B.C.P. Entry Date' },
  { key: 'documentsDate', label: 'Date on certificates', placeholder: 'DD.MM.YYYY' }
];

export const Stage4BillOfLading: React.FC<Stage4BillOfLadingProps> = ({
  billOfLading,
  shipmentDetails,
  onUpdateShipmentDetails,
  onUpdateBL,
  onBackToStage3,
  onProceedToStage5
}) => {
  const [bl, setBl] = useState<BillOfLadingFinal>(billOfLading);

  const [ship, setShip] = useState<ShipmentTransportDetails>(shipmentDetails || EMPTY_SHIPMENT);
  const commitShip = (patch: Partial<ShipmentTransportDetails>) => {
    const next = { ...ship, ...patch };
    setShip(next);
    onUpdateShipmentDetails(next);
  };

  const handleChange = (field: keyof BillOfLadingFinal, value: any) => {
    const updated = { ...bl, [field]: value };
    setBl(updated);
    onUpdateBL(updated);
  };

  const handleDownloadPDF = () => {
    const pdf = generateBillOfLadingPDF(bl);
    pdf.save(`BL_Instruction_${bl.invoiceNo || 'INV'}.pdf`);
  };

  const handleDownloadDOCX = async () => {
    try {
      const blob = await generateBillOfLadingDOCX(bl);
      downloadFileBlob(blob, `BL_Instruction_${bl.invoiceNo || 'INV'}.docx`);
    } catch (err) {
      console.error('Failed to generate DOCX', err);
      alert('Failed to generate DOCX document.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              Stage 4 of 5
            </span>
            <span className="text-xs font-medium text-slate-500">
              B/L instruction to transporter, then LR / B/L details
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            B/L Instruction & LR Details
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Send this instruction to the transporter / shipping line. Once the LR (truck receipt) or B/L is issued, enter its number and date below. They flow into the invoice, packing list, bill of exchange and certificates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            onClick={handleDownloadDOCX}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Download DOCX
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-1">LR / B/L issued by carrier</h3>
        <p className="text-xs text-slate-500 mb-4">Leave blank until the transporter issues it.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SHIPMENT_FIELDS.map(f => (
            <label key={f.key} className="text-xs">
              <span className="block text-slate-500 mb-0.5">{f.label}</span>
              <input
                defaultValue={String(ship[f.key] || '')}
                placeholder={f.placeholder}
                onBlur={e => e.target.value.trim() !== (ship[f.key] || '') && commitShip({ [f.key]: e.target.value.trim() })}
                className="w-full px-2 py-1.5 border border-slate-300 rounded"
              />
            </label>
          ))}
          <label className="text-xs">
            <span className="block text-slate-500 mb-0.5">Negotiating bank (Bill of Exchange "Pay to")</span>
            <select
              value={ship.negotiatingBankId || sampleBankProfiles[0].id}
              onChange={e => commitShip({ negotiatingBankId: e.target.value })}
              className="w-full px-2 py-1.5 border border-slate-300 rounded"
            >
              {sampleBankProfiles.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="bg-slate-200 p-4 sm:p-8 rounded-xl shadow-inner flex justify-center overflow-x-auto">
        <div className="bg-white w-[210mm] min-h-[297mm] p-10 shadow-2xl rounded-sm border border-slate-300 text-[11px] font-sans text-slate-900 leading-tight flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900"><EditableField value={bl.exporter?.name || ''} onChange={v => handleChange('exporter', { ...(bl.exporter || {}), name: v })} /></h3>
                <div className="text-[9px] text-slate-600 mt-0.5 whitespace-pre-line"><EditableField value={bl.exporter?.address || ''} onChange={v => handleChange('exporter', { ...(bl.exporter || {}), address: v })} multiline /></div>
              </div>
              <div className="text-right">
                <h4 className="text-sm font-bold uppercase text-blue-900 tracking-wider">B/L INSTRUCTION / DRAFT</h4>
                <p className="text-xs font-bold text-slate-800 mt-1">Invoice No: <EditableField value={bl.invoiceNo || ''} onChange={v => handleChange('invoiceNo', v)} /></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border border-slate-400 p-3 mb-3 bg-slate-50/50 rounded-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Exporter</span>
                <div className="font-bold text-slate-900 mt-0.5 space-y-1">
                  <EditableField
                    value={bl.exporter?.name || ''}
                    onChange={v => handleChange('exporter', { ...(bl.exporter || {}), name: v })}
                  />
                  <EditableField
                    value={bl.exporter?.address || ''}
                    onChange={v => handleChange('exporter', { ...(bl.exporter || {}), address: v })}
                    multiline
                  />
                </div>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">L/C No. & Date</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  L/C NO. <EditableField value={bl.lcNumber || ''} onChange={v => handleChange('lcNumber', v)} />
                  {' '}DT. <EditableField value={bl.lcDate || ''} onChange={v => handleChange('lcDate', v)} />
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border border-slate-400 p-3 mb-3 bg-slate-50/50 rounded-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Consignee</span>
                <div className="font-bold text-slate-900 mt-0.5">
                  <EditableField value={bl.consignee || ''} onChange={v => handleChange('consignee', v)} multiline />
                </div>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Buyer (If other than consignee)</span>
                <div className="font-medium text-slate-800 mt-0.5">
                  <EditableField value={bl.buyerIfOtherThanConsignee || ''} onChange={v => handleChange('buyerIfOtherThanConsignee', v)} multiline />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border border-slate-400 p-3 mb-3 bg-slate-50/50 rounded-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Notify Party</span>
                <div className="font-medium text-slate-800 mt-0.5">
                  <EditableField value={bl.notifyParty1 || ''} onChange={v => handleChange('notifyParty1', v)} multiline />
                  {bl.notifyParty1VatBin && !bl.notifyParty1?.toUpperCase().includes('BIN') && !bl.notifyParty1?.toUpperCase().includes('VAT') && (
                    <div className="text-[10px] font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                      <span>BIN NO.</span>
                      <EditableField value={bl.notifyParty1VatBin} onChange={v => handleChange('notifyParty1VatBin', v)} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Notify Party 2</span>
                <div className="font-medium text-slate-800 mt-0.5">
                  <EditableField value={bl.notifyParty2 || ''} onChange={v => handleChange('notifyParty2', v)} multiline />
                  {bl.notifyParty2VatBin && !bl.notifyParty2?.toUpperCase().includes('BIN') && !bl.notifyParty2?.toUpperCase().includes('VAT') && (
                    <div className="text-[10px] font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                      <span>BIN NO.</span>
                      <EditableField value={bl.notifyParty2VatBin} onChange={v => handleChange('notifyParty2VatBin', v)} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 border border-slate-400 p-3 mb-3 bg-slate-50/50 rounded-xs text-[10px]">
              <div>
                <span className="font-bold text-slate-500 uppercase block">Vessel/Flight No.</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  <EditableField value={bl.vesselFlightNo || ''} onChange={v => handleChange('vesselFlightNo', v)} />
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase block">Port of Loading</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  <EditableField value={bl.portOfLoading || ''} onChange={v => handleChange('portOfLoading', v)} />
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase block">Port of Discharge</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  <EditableField value={bl.portOfDischarge || ''} onChange={v => handleChange('portOfDischarge', v)} />
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase block">Final Destination</span>
                <div className="font-semibold text-slate-900 mt-0.5">
                  <EditableField value={bl.finalDestination || ''} onChange={v => handleChange('finalDestination', v)} />
                </div>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-400 mb-4 text-[10px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 text-left">
                  <th className="p-2 border-r border-slate-400 w-1/4">Marks & Nos. / Container No</th>
                  <th className="p-2 border-r border-slate-400 w-1/4">No. & Kind of Pkg</th>
                  <th className="p-2 w-1/2">Description Of Goods</th>
                </tr>
              </thead>
              <tbody>
                <tr className="align-top">
                  <td className="p-2 border-r border-slate-400 font-mono">
                    <EditableField value={bl.marksAndNos} onChange={v => handleChange('marksAndNos', v)} multiline />
                    {!/GROSS\s*WT/i.test(bl.marksAndNos || '') && <div className="mt-4 space-y-2 text-slate-800 font-mono">
                      <div>
                        <span className="font-bold block text-[9px] uppercase text-slate-500">Total Gross Wt:</span>
                        <div className="flex items-center gap-1">
                          <EditableField value={bl.totalGrossWtKg != null ? String(bl.totalGrossWtKg) : ''} onChange={v => handleChange('totalGrossWtKg', parseFloat(v) || 0)} /> KGS
                        </div>
                      </div>
                      <div>
                        <span className="font-bold block text-[9px] uppercase text-slate-500">Total Net Wt:</span>
                        <div className="flex items-center gap-1">
                          <EditableField value={bl.totalNetWtKg != null ? String(bl.totalNetWtKg) : ''} onChange={v => handleChange('totalNetWtKg', parseFloat(v) || 0)} /> KGS
                        </div>
                      </div>
                      <div>
                        <span className="font-bold block text-[9px] uppercase text-slate-500">Container No/Seal No:</span>
                        <EditableField value={bl.containerSealNos || ''} onChange={v => handleChange('containerSealNos', v)} multiline />
                      </div>
                    </div>}
                  </td>
                  <td className="p-2 border-r border-slate-400 font-semibold">
                    <EditableField value={bl.packagesCountAndKind || ''} onChange={v => handleChange('packagesCountAndKind', v)} multiline />
                  </td>
                  <td className="p-2 font-medium">
                    <EditableField value={bl.goodsDescription || ''} onChange={v => handleChange('goodsDescription', v)} multiline />
                    <div className="mt-3">
                      <BLDescriptionExtras bl={bl} onChange={handleChange} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

          </div>

          <div className="border-t border-slate-300 pt-4 mt-6 flex justify-between items-center text-[10px] text-slate-500">
            <span>Lahoti Overseas Limited - B/L Instruction & Integration Module</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex items-center justify-between">
        <button
          onClick={onBackToStage3}
          className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pre-Shipment Invoice
        </button>

        <button
          onClick={onProceedToStage5}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
        >
          <span>Proceed to Final Document Set (Stage 5)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
