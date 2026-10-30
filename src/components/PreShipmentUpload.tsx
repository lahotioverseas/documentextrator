import React, { useState } from 'react';
import { PreShipmentInvoiceData } from '../types';
import { convertFileToVisionParts } from '../lib/pdfVisionHelper';
import { sanitizeExtractedData, detectFieldsNeedingManualEntry } from '../lib/antiHallucination';
import { Upload, Loader2, AlertTriangle, FileSpreadsheet } from 'lucide-react';

interface PreShipmentUploadProps {
  preShipment: PreShipmentInvoiceData | null;
  onExtracted: (pre: PreShipmentInvoiceData, docMetadata?: { name: string; size: string; pageCount: number }) => void;
}

type FieldDef = { key: keyof PreShipmentInvoiceData; label: string; numeric?: boolean; multiline?: boolean };

const FIELDS: FieldDef[] = [
  { key: 'invoiceNo', label: 'Invoice No.' },
  { key: 'invoiceDate', label: 'Invoice Date' },
  { key: 'packageCount', label: 'No. of Packages', numeric: true },
  { key: 'packageKind', label: 'Kind of Packages' },
  { key: 'goodsQuantity', label: 'Quantity (LC unit)', numeric: true },
  { key: 'goodsQuantityUom', label: 'Unit' },
  { key: 'totalAmount', label: 'Invoice Value', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'grossWeightKg', label: 'Gross Wt (KGS)', numeric: true },
  { key: 'netWeightKg', label: 'Net Wt (KGS)', numeric: true },
  { key: 'freightAmount', label: 'Freight', numeric: true },
  { key: 'exchangeRate', label: 'Exch. Rate (INR)', numeric: true },
  { key: 'marksAndNos', label: 'Marks & Nos.', multiline: true }
];

export const PreShipmentUpload: React.FC<PreShipmentUploadProps> = ({ preShipment, onExtracted }) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setStatus('Reading pre-shipment invoice pages...');
    try {
      const { pages, extractedText } = await convertFileToVisionParts(file);
      setStatus('Extracting shipment details...');
      const res = await fetch('/api/extract-preshipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageParts: pages.map(p => ({ mimeType: p.mimeType, data: p.data })), textContent: extractedText })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Pre-shipment extraction failed (${res.status})`);
      }
      const data: PreShipmentInvoiceData = sanitizeExtractedData(json.data);
      setMissing(detectFieldsNeedingManualEntry(data as any, [
        'invoiceNo', 'invoiceDate', 'packageCount', 'goodsQuantity', 'totalAmount', 'grossWeightKg', 'netWeightKg', 'marksAndNos'
      ]).map(m => m.label));
      onExtracted(data, { name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, pageCount: pages.length || 1 });
      setStatus('');
    } catch (err: any) {
      setError(err.message || 'Extraction failed');
    } finally {
      setBusy(false);
    }
  };

  const update = (f: FieldDef, raw: string) => {
    if (!preShipment) return;
    const value = f.numeric ? (raw === '' ? null : Number(raw)) : raw;
    onExtracted({ ...preShipment, [f.key]: value } as PreShipmentInvoiceData);
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 mb-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">Stage 3 of 5</span>
            <span className="text-xs font-medium text-slate-500">One pre-shipment invoice = one shipment under the LC</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" /> Pre-Shipment Invoice
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Packages, marks, quantity, weights, value and freight come from this invoice. Consignee, notify parties,
            goods description and LC references come from the LC.
          </p>
        </div>
        <label className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer ${busy ? 'bg-slate-300 text-slate-600' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {preShipment ? 'Upload another pre-shipment invoice' : 'Upload pre-shipment invoice (PDF / image)'}
          <input
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </label>
      </div>

      {status && <div className="text-xs text-blue-700">{status}</div>}
      {error && <div className="flex gap-2 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800"><AlertTriangle className="w-4 h-4" />{error}</div>}
      {missing.length > 0 && (
        <div className="flex gap-2 p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />Not found on the document — please fill in: {missing.join(', ')}
        </div>
      )}

      {preShipment && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FIELDS.map(f => (
            <label key={f.key} className={`text-xs ${f.multiline ? 'col-span-2 md:col-span-4' : ''}`}>
              <span className="block text-slate-500 mb-0.5">{f.label}</span>
              {f.multiline ? (
                <textarea
                  rows={5}
                  defaultValue={String(preShipment[f.key] ?? '')}
                  onBlur={e => update(f, e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              ) : (
                <input
                  type={f.numeric ? 'number' : 'text'}
                  step="any"
                  defaultValue={preShipment[f.key] == null ? '' : String(preShipment[f.key])}
                  onBlur={e => update(f, e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded"
                />
              )}
            </label>
          ))}
        </div>
      )}

      {preShipment && (preShipment.items?.length || 0) > 0 && (
        <table className="w-full text-xs border border-slate-200">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2">Product rows on this invoice</th>
              <th className="text-right p-2">Quantity</th>
              <th className="text-right p-2">Rate</th>
              <th className="text-right p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {preShipment.items!.map((it, i) => (
              <tr key={i} className="border-t border-slate-100 align-top">
                <td className="p-2 whitespace-pre-line">{it.description}</td>
                <td className="p-2 text-right">{Number(it.quantity).toLocaleString('en-US')} {it.uom}</td>
                <td className="p-2 text-right">{it.rate}</td>
                <td className="p-2 text-right">{Number(it.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};
