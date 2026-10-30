import React, { useState } from 'react';
import { SourceDocument, LCAmendment, LCDetails } from '../types';
import { FileText, ShieldAlert, FileSpreadsheet, Plus, Upload, Eye, Clock, CheckCircle, FileCode2, ChevronDown, ChevronRight, X } from 'lucide-react';

interface SourceDocsSidebarProps {
  documents: SourceDocument[];
  amendments: LCAmendment[];
  lcDetails: LCDetails | null;
  onUploadAmendmentClick?: () => void;
  onUploadNewDocClick: () => void;
}

export const SourceDocsSidebar: React.FC<SourceDocsSidebarProps> = ({
  documents,
  amendments,
  lcDetails,
  onUploadNewDocClick
}) => {
  const [selectedDoc, setSelectedDoc] = useState<SourceDocument | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getDocTypeLabel = (type: SourceDocument['type']) => {
    switch (type) {
      case 'contract':
        return 'Sales Contract';
      case 'lc':
        return 'Active: LC Receipt';
      case 'amendment':
        return 'Amendment MT707';
      case 'packing_draft':
        return 'Pre-Shipment Draft';
      case 'preshipment':
        return 'Pre-Shipment Invoice';
    }
  };

  return (
    <>
      <aside className="w-full lg:w-64 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Source Documents
            </h2>
            <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">
              {documents.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              id="sidebar-add-doc-btn"
              onClick={onUploadNewDocClick}
              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Upload New Document"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="lg:hidden p-1 text-slate-500 hover:text-slate-800"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Document list */}
        <div className={`space-y-2 overflow-y-auto max-h-[400px] lg:max-h-[calc(100vh-220px)] ${isCollapsed ? 'hidden lg:block' : 'block'}`}>
          {documents.length === 0 ? (
            <div className="text-center py-6 px-3 bg-white rounded-lg border border-dashed border-slate-300">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-600">No documents loaded</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Upload a Contract or MT700 LC.</p>
            </div>
          ) : (
            documents.map((doc) => {
              const isLC = doc.type === 'lc';
              return (
                <div
                  key={doc.id}
                  id={`source-doc-item-${doc.id}`}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-3 rounded-lg border shadow-xs flex items-center gap-3 transition-all cursor-pointer ${
                    isLC
                      ? 'bg-blue-50/80 border-blue-200 hover:border-blue-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="text-blue-600 shrink-0">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 012-2h4.586A1 1 0 0111.293 2.293l4.414 4.414a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>
                    </svg>
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isLC ? 'text-blue-900' : 'text-slate-800'}`} title={doc.name}>
                      {doc.name}
                    </p>
                    <p className={`text-[10px] uppercase tracking-wider ${isLC ? 'text-blue-500 font-semibold' : 'text-slate-400'}`}>
                      {getDocTypeLabel(doc.type)}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {/* Amendment section if LC active */}
          {amendments.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                MT707 Amendments ({amendments.length})
              </span>
              {amendments.map((amd) => (
                <div
                  key={amd.id}
                  className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg text-xs"
                >
                  <div className="flex items-center justify-between font-bold text-purple-900 text-[11px]">
                    <span>Amendment #{amd.amendmentNo}</span>
                    <span className="text-[10px] font-normal text-purple-600">{amd.amendmentDate}</span>
                  </div>
                  <p className="text-[10px] text-purple-800 line-clamp-2 mt-0.5">{amd.narrative}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Doc Preview Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="text-blue-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 012-2h4.586A1 1 0 0111.293 2.293l4.414 4.414a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 truncate">{selectedDoc.name}</h3>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Document Type</span>
                  <span className="font-semibold text-slate-800 capitalize">{selectedDoc.type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">File Size</span>
                  <span className="font-semibold text-slate-800">{selectedDoc.size}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Uploaded At</span>
                  <span className="font-semibold text-slate-800">{selectedDoc.uploadedAt}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Pages Scanned</span>
                  <span className="font-semibold text-slate-800">{selectedDoc.pageCount || 1} pages</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic mt-2">
                Audit Status: Extracted verbatim into trade finance data model via Gemini Vision.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

