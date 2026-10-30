import React, { useEffect, useState } from 'react';
import { LCDetails, LCLedgerEntry, LCShipmentRecord } from '../types';
import {
  checkShipmentAgainstLC,
  computeLCUtilization,
  deleteLedgerShipment,
  fetchLedgerEntry,
  recordLedgerShipment
} from '../lib/lcLedger';
import { BookOpen, Search, AlertTriangle, XCircle, CheckCircle2, Trash2 } from 'lucide-react';

interface LCLedgerPanelProps {
  lcDetails: LCDetails | null;
  ledgerEntry: LCLedgerEntry | null;
  onLedgerChange: (entry: LCLedgerEntry | null) => void;
  /** Called when an LC is looked up by number and found in the ledger. */
  onLoadEntry?: (entry: LCLedgerEntry) => void;
  /** The invoice being prepared now; checked against the LC balance. */
  currentShipment?: Omit<LCShipmentRecord, 'updatedAt'> | null;
}

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });

export const LCLedgerPanel: React.FC<LCLedgerPanelProps> = ({
  lcDetails,
  ledgerEntry,
  onLedgerChange,
  onLoadEntry,
  currentShipment
}) => {
  const [lookupNo, setLookupNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Refresh from the server whenever the active LC changes
  useEffect(() => {
    if (!lcDetails?.lcNumber) return;
    let cancelled = false;
    fetchLedgerEntry(lcDetails.lcNumber)
      .then(entry => { if (!cancelled) onLedgerChange(entry); })
      .catch(err => { if (!cancelled) setMessage(err.message); });
    return () => { cancelled = true; };
  }, [lcDetails?.lcNumber]);

  const handleLookup = async () => {
    if (!lookupNo.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const entry = await fetchLedgerEntry(lookupNo);
      if (!entry) {
        setMessage(`LC ${lookupNo} is not in the ledger yet — upload the LC (MT700) to register it.`);
      } else {
        onLedgerChange(entry);
        onLoadEntry?.(entry);
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const lc = ledgerEntry?.lcDetails || lcDetails;
  const shipments = ledgerEntry?.shipments || [];
  const util = lc ? computeLCUtilization(lc, shipments) : null;
  const check = lc && currentShipment && currentShipment.invoiceNo
    ? checkShipmentAgainstLC(lc, shipments, {
        invoiceNo: currentShipment.invoiceNo,
        quantity: currentShipment.quantity,
        amount: currentShipment.amount,
        shipmentDate: currentShipment.transportDocDate,
        items: currentShipment.items
      })
    : null;
  const alreadyRecorded = !!currentShipment && shipments.some(s => s.invoiceNo === currentShipment.invoiceNo);

  const handleRecord = async () => {
    if (!lc || !currentShipment) return;
    if (check?.errors.length && !window.confirm(`This invoice fails the LC check:\n\n${check.errors.join('\n')}\n\nRecord it anyway?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const entry = await recordLedgerShipment(lc.lcNumber, { ...currentShipment, updatedAt: new Date().toISOString() });
      onLedgerChange(entry);
      setMessage(`Invoice ${currentShipment.invoiceNo} recorded against LC ${lc.lcNumber}.`);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (invoiceNo: string) => {
    if (!lc || !window.confirm(`Remove invoice ${invoiceNo} from LC ${lc.lcNumber}?`)) return;
    try {
      onLedgerChange(await deleteLedgerShipment(lc.lcNumber, invoiceNo));
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">LC Ledger {lc ? `— ${lc.lcNumber}` : ''}</h3>
            <p className="text-xs text-slate-500">Every invoice shipped under an LC draws down its quantity and value.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={lookupNo}
            onChange={e => setLookupNo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="Enter LC No. to check balance"
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-56"
          />
          <button
            onClick={handleLookup}
            disabled={busy}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" /> Find
          </button>
        </div>
      </div>

      {lc && util && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500">LC value (±{lc.tolerancePercentage?.positive || 0}%)</div>
            <div className="font-bold text-slate-900">{util.currency} {money(util.lcAmount)}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500">LC quantity</div>
            <div className="font-bold text-slate-900">{util.lcQuantity != null ? `${qtyFmt(util.lcQuantity)} ${util.quantityUom}` : 'not stated'}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Shipped ({util.shipmentCount} invoice{util.shipmentCount === 1 ? '' : 's'})</div>
            <div className="font-bold text-slate-900">{util.currency} {money(util.shippedAmount)}</div>
            <div className="text-slate-600">{qtyFmt(util.shippedQuantity)} {util.quantityUom}</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-emerald-700">Balance available</div>
            <div className="font-bold text-emerald-900">{util.currency} {money(util.balanceAmount)}</div>
            <div className="text-emerald-800">
              {util.balanceQuantity != null ? `${qtyFmt(util.balanceQuantity)} ${util.quantityUom}` : ''}
              {util.balanceQuantityWithTolerance != null && (
                <span className="text-emerald-600"> (max {qtyFmt(util.balanceQuantityWithTolerance)} with tolerance)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {util && util.items.length > 1 && (
        <table className="w-full text-xs border border-slate-200">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2">Product (45A)</th>
              <th className="text-right p-2">Rate</th>
              <th className="text-right p-2">LC quantity</th>
              <th className="text-right p-2">Shipped</th>
              <th className="text-right p-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {util.items.map(it => (
              <tr key={it.index} className="border-t border-slate-100">
                <td className="p-2 font-semibold">{it.label}</td>
                <td className="p-2 text-right">{it.unitPrice.toFixed(3)} / {it.uom}</td>
                <td className="p-2 text-right">{qtyFmt(it.lcQuantity)} {it.uom}</td>
                <td className="p-2 text-right">{qtyFmt(it.shippedQuantity)} {it.uom}</td>
                <td className="p-2 text-right font-bold text-emerald-800">{qtyFmt(it.balanceQuantity)} {it.uom}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {shipments.length > 0 && (
        <table className="w-full text-xs border border-slate-200">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-2">Invoice</th>
              <th className="text-left p-2">LR / B/L</th>
              <th className="text-right p-2">Quantity</th>
              <th className="text-right p-2">Value</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(s => (
              <tr key={s.invoiceNo} className="border-t border-slate-100">
                <td className="p-2 font-semibold">{s.invoiceNo} <span className="text-slate-400">{s.invoiceDate}</span></td>
                <td className="p-2">{s.transportDocNo ? `${s.transportDocNo} DT. ${s.transportDocDate || ''}` : '—'}</td>
                <td className="p-2 text-right">{qtyFmt(s.quantity)} {s.quantityUom}</td>
                <td className="p-2 text-right">{money(s.amount)}</td>
                <td className="p-2 text-right">
                  <button onClick={() => handleDelete(s.invoiceNo)} className="text-slate-400 hover:text-red-600 cursor-pointer" title="Remove from ledger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {check && currentShipment && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">
            This invoice: {currentShipment.invoiceNo} — {qtyFmt(currentShipment.quantity)} {currentShipment.quantityUom}, {util?.currency} {money(currentShipment.amount)}
            {alreadyRecorded && <span className="ml-2 text-emerald-700">(already in ledger)</span>}
          </div>
          {check.errors.map(e => (
            <div key={e} className="flex gap-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800"><XCircle className="w-4 h-4 shrink-0" />{e}</div>
          ))}
          {check.warnings.map(w => (
            <div key={w} className="flex gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800"><AlertTriangle className="w-4 h-4 shrink-0" />{w}</div>
          ))}
          {!check.errors.length && !check.warnings.length && (
            <div className="flex gap-2 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800"><CheckCircle2 className="w-4 h-4" />Within LC balance and dates.</div>
          )}
          <button
            onClick={handleRecord}
            disabled={busy || !ledgerEntry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            title={!ledgerEntry ? 'Upload or find the LC first' : ''}
          >
            {alreadyRecorded ? 'Update this invoice in LC ledger' : 'Record this invoice in LC ledger'}
          </button>
        </div>
      )}

      {message && <div className="text-xs text-slate-600">{message}</div>}
    </section>
  );
};
