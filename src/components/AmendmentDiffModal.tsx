import React, { useState } from 'react';
import { LCAmendment, LCClause } from '../types';
import { AmendmentDiffAudit, computeTextDiffChunks, diffClauses } from '../lib/clauseDiffEngine';
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Edit3,
  Check,
  X,
  FileText,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';

interface AmendmentDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  amendment: LCAmendment;
  existingClauses: LCClause[];
  onConfirmApply: (amendment: LCAmendment) => void;
}

export const AmendmentDiffModal: React.FC<AmendmentDiffModalProps> = ({
  isOpen,
  onClose,
  amendment,
  existingClauses,
  onConfirmApply
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'clauses' | 'headers'>('all');

  if (!isOpen) return null;

  const diffAudit: AmendmentDiffAudit = diffClauses(
    existingClauses,
    amendment,
    amendment.patchedClauses || []
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center">
              <FileCode2 className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">SWIFT MT707 Amendment #{diffAudit.amendmentNo} Audit</h3>
                <span className="px-2 py-0.5 bg-purple-400/20 border border-purple-300/30 rounded text-[11px] font-semibold text-purple-200">
                  Diff & Verification
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Detailed comparison against active LC terms before applying changes to live workflow.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-purple-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Narrative & High-Level Summary Stats */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5 shadow-2xs">
            <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 font-semibold">Narrative / Reason for Amendment:</strong>
              <p className="text-slate-600 mt-0.5 leading-relaxed">{diffAudit.narrative}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-medium block">Amendment Date</span>
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                {diffAudit.amendmentDate}
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
              <span className="text-[11px] text-emerald-700 font-medium block">Clauses Added</span>
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                {diffAudit.addedCount} new
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
              <span className="text-[11px] text-amber-700 font-medium block">Clauses Modified</span>
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1 mt-0.5">
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                {diffAudit.modifiedCount} updated
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-purple-200 bg-purple-50/30 shadow-2xs">
              <span className="text-[11px] text-purple-700 font-medium block">Total Field Patches</span>
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                {diffAudit.headerChanges.length} parameters
              </span>
            </div>
          </div>
        </div>

        {/* Content Body: Scrollable Diff Table */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Header Parameter Changes */}
          {diffAudit.headerChanges.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Commercial & Operational Parameter Changes ({diffAudit.headerChanges.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {diffAudit.headerChanges.map((ch, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                      <span className="text-purple-900 font-mono">{ch.field}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                        {ch.impact}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                      <div className="flex-1 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 line-through">
                        <span className="text-[10px] text-rose-500 font-sans block font-semibold">PREVIOUS</span>
                        {ch.oldValue}
                      </div>
                      <ArrowRight className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="flex-1 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-bold">
                        <span className="text-[10px] text-emerald-600 font-sans block font-semibold">AMENDED</span>
                        {ch.newValue}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clause-by-Clause Word Diff Highlighting */}
          {diffAudit.clauseDiffs.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                Field 46A / 47A Clause-by-Clause Exact Diff
              </h4>

              <div className="space-y-3">
                {diffAudit.clauseDiffs.map((clauseDiff) => {
                  const isModified = clauseDiff.status === 'modified';
                  const isAdded = clauseDiff.status === 'added';
                  const isUnchanged = clauseDiff.status === 'unchanged';

                  const textChunks = isModified && clauseDiff.oldText && clauseDiff.newText
                    ? computeTextDiffChunks(clauseDiff.oldText, clauseDiff.newText)
                    : null;

                  return (
                    <div
                      key={clauseDiff.id}
                      className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all shadow-2xs ${
                        isAdded
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : isModified
                          ? 'bg-amber-50/40 border-amber-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold font-mono text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Clause {clauseDiff.id}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : isModified
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {clauseDiff.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {clauseDiff.affectedDocuments.map((doc, dIdx) => (
                            <span key={dIdx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                              {doc.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-700 font-medium">{clauseDiff.diffSummary}</p>

                      {/* Visual word-by-word diff display */}
                      {isModified && textChunks ? (
                        <div className="space-y-2">
                          <div className="p-2.5 bg-white rounded-lg border border-amber-200 font-mono text-[11px] leading-relaxed">
                            <span className="text-[10px] font-sans font-bold text-amber-700 block mb-1">
                              INLINE DIFF HIGHLIGHT (RED = Removed, GREEN = Added):
                            </span>
                            {textChunks.map((chunk, cIdx) => {
                              if (chunk.type === 'added') {
                                return (
                                  <span key={cIdx} className="bg-emerald-200 text-emerald-950 font-bold px-1 rounded mx-0.5 border border-emerald-400">
                                    {chunk.text}
                                  </span>
                                );
                              }
                              if (chunk.type === 'removed') {
                                return (
                                  <span key={cIdx} className="bg-rose-100 text-rose-800 line-through px-1 rounded mx-0.5 border border-rose-300 opacity-70">
                                    {chunk.text}
                                  </span>
                                );
                              }
                              return <span key={cIdx}>{chunk.text}</span>;
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                          {clauseDiff.newText || clauseDiff.oldText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs"
          >
            Cancel & Review
          </button>

          <button
            onClick={() => {
              onConfirmApply(amendment);
              onClose();
            }}
            className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-600/20 flex items-center gap-2 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm & Apply Amendment #{diffAudit.amendmentNo} to Workflow
          </button>
        </div>
      </div>
    </div>
  );
};
