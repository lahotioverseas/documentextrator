import React from 'react';
import { BillOfLadingFinal } from '../types';
import { InlineEditable } from './InlineEditable';

interface BLDescriptionExtrasProps {
  bl: BillOfLadingFinal;
  invoiceNoFallback?: string;
  onChange: (field: keyof BillOfLadingFinal, value: any) => void;
}

/**
 * Everything printed under the goods description on the B/L instruction, in print order:
 * the LC reference block (L/C no., H.S. code / TIN / IRC / BIN, "opened under bond", cover note,
 * export LC/SC, VAT BINs) and the carrier instructions (invoice no., freight, agent, S.B., checks).
 * Shared by the Step 4 B/L screen and the final document set so both look the same.
 */
export const BLDescriptionExtras: React.FC<BLDescriptionExtrasProps> = ({ bl, invoiceNoFallback, onChange }) => {
  const desc = (bl.goodsDescription || '').toUpperCase();
  const field = (key: keyof BillOfLadingFinal, placeholder = '—') => (
    <InlineEditable value={(bl[key] as string) || ''} placeholder={placeholder} onSave={v => onChange(key, v.trim())} className="font-bold" />
  );

  return (
    <div className="space-y-3 text-[11px] text-slate-900 font-medium">
      <div className="space-y-0.5">
        {bl.lcNumber && !desc.includes('LETTER OF CREDIT NUMBER') && (
          <div className="flex items-center gap-1 flex-wrap">
            <span>LETTER OF CREDIT NUMBER</span>{field('lcNumber')}<span>DATE</span>{field('lcDate')}
          </div>
        )}
        <div className="flex items-center gap-1 flex-wrap">
          <span>H.S.CODE NO.</span>{field('hsCodeNo')}<span>, TIN NO.</span>{field('tinNo')}<span>,</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span>IRC NO.</span>{field('ircNo')}<span>, BIN NO.</span>{field('binNo')}<span>.</span>
        </div>
        <label className={`flex items-center gap-1.5 cursor-pointer ${bl.underBond ? '' : 'text-slate-400'}`}>
          <input type="checkbox" checked={!!bl.underBond} onChange={e => onChange('underBond', e.target.checked)} />
          <span>THIS L/C IS OPENED UNDER BOND.</span>
          {!bl.underBond && <span className="italic">(not in this LC — not printed)</span>}
        </label>
        {bl.insuranceCoverNote && (
          <div className="flex items-center gap-1 flex-wrap"><span>INSURANCE COVER NOTE NO.</span>{field('insuranceCoverNote')}</div>
        )}
        {bl.exportLcSclNo && (
          <div className="flex items-center gap-1 flex-wrap"><span>EXPORT LC/S/C NO.</span>{field('exportLcSclNo')}</div>
        )}
        {bl.vatApplicant && (
          <div className="flex items-center gap-1 flex-wrap"><span>VAT REG. NO. (BIN) OF L/C APPLICANT:</span>{field('vatApplicant')}</div>
        )}
        {bl.vatIssuingBank && (
          <div className="flex items-center gap-1 flex-wrap"><span>VAT REG. NO. (BIN) OF L/C ISSUING BANK:</span>{field('vatIssuingBank')}</div>
        )}
        <p className="text-[10px] text-slate-400 italic">Blank codes are not printed. They come from the LC (46A / 47A); double-click to edit.</p>
      </div>

      <div className="space-y-1 font-semibold border-t border-slate-200 pt-2">
        <div className="flex items-center gap-1"><span>COMMERCIAL INVOICE NO.</span>
          <InlineEditable value={bl.invoiceNo || invoiceNoFallback || ''} onSave={v => onChange('invoiceNo', v)} />
        </div>
        <div className="flex items-center gap-1"><span>FREIGHT:</span>{field('freightStatus')}</div>
        <div className="flex items-center gap-1"><span>BL:</span>{field('agentDetailsAtDestination')}</div>
        <div className="flex items-center gap-1 flex-wrap">
          <span>S.B. NO.</span>{field('shippingBillNo', '_____')}<span>DATE</span>{field('shippingBillDate', '_____')}
        </div>
        <div className="flex items-center gap-1"><span>BL:</span>{field('freeDetentionClause', 'Double-click to add (sea shipments)')}</div>
        <div className="flex items-center gap-1"><span>BL:</span>{field('blWeightCheckClause')}</div>
      </div>
    </div>
  );
};
