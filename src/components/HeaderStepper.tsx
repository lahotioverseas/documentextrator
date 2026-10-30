import React from 'react';
import { WorkflowState } from '../types';
import { FileText, FileSpreadsheet, ShieldAlert, CheckCircle2, RefreshCw, Ship } from 'lucide-react';
import lahotiOverseasLogo from '../image/logo';

interface HeaderStepperProps {
  workflow: WorkflowState;
  onSelectStage: (stage: 1 | 2 | 3 | 4 | 5) => void;
  onReset: () => void;
  onLoadPreset?: (preset: 'weber' | 'sanjana') => void;
}

export const HeaderStepper: React.FC<HeaderStepperProps> = ({
  workflow,
  onSelectStage,
  onReset,
}) => {
  const steps = [
    {
      num: 1 as const,
      title: 'Contract',
      subtitle: 'Order Specs',
      icon: FileText,
      hasData: Boolean(workflow.contractData)
    },
    {
      num: 2 as const,
      title: 'LC',
      subtitle: 'MT700 & Balance',
      icon: ShieldAlert,
      hasData: Boolean(workflow.lcDetails)
    },
    {
      num: 3 as const,
      title: 'Pre-Shipment',
      subtitle: 'Upload Invoice',
      icon: FileSpreadsheet,
      hasData: Boolean(workflow.preShipmentData)
    },
    {
      num: 4 as const,
      title: 'B/L / LR',
      subtitle: 'Instruction & LR No.',
      icon: Ship,
      hasData: Boolean(workflow.billOfLading)
    },
    {
      num: 5 as const,
      title: 'Final Set',
      subtitle: '6 Final Docs & Rules',
      icon: CheckCircle2,
      hasData: Boolean(workflow.finalDocuments)
    }
  ];

  return (
    <header className="sticky top-0 z-30 shadow-md">
      {/* Deep Slate/Navy Top Bar matching Professional Polish */}
      <div className="bg-[#0F172A] text-white px-4 sm:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg shadow-sm flex items-center justify-center h-10 w-10 shrink-0 border border-slate-700/50">
            <img
              src={lahotiOverseasLogo}
              alt="Lahoti Overseas Logo"
              className="h-8 w-8 object-contain"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight">
              Lahoti Overseas <span className="font-normal text-slate-300">Doc Assistant</span>
            </h1>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Prominent Upload New / Reset Action Button */}
          <button
            id="top-upload-new-btn"
            onClick={onReset}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950/30 cursor-pointer border border-emerald-400/40"
            title="Clear workflow and upload a new contract or document from the beginning"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Upload New / Reset</span>
          </button>
        </div>
      </div>

      {/* Stepper Navigation bar matching the Professional Polish mockup */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3">
        <div className="max-w-4xl mx-auto relative flex items-center justify-between">
          {/* Connected track line */}
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>

          {steps.map((step, idx) => {
            const isActive = workflow.currentStage === step.num;
            const isCompleted = step.hasData && !isActive;
            const isAccessible = step.hasData || (idx > 0 && steps[idx - 1].hasData) || step.num === 1;

            return (
              <button
                key={step.num}
                id={`stepper-btn-stage-${step.num}`}
                onClick={() => isAccessible && onSelectStage(step.num)}
                disabled={!isAccessible}
                className={`relative z-10 flex flex-col items-center gap-1.5 bg-white px-2 sm:px-3 focus:outline-hidden transition-all ${
                  !isAccessible ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                    isActive
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-105'
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                </div>
                <div className="text-center">
                  <span
                    className={`text-xs block leading-tight font-semibold ${
                      isActive
                        ? 'font-bold text-blue-700'
                        : isCompleted
                        ? 'text-emerald-600'
                        : 'text-slate-600'
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block">
                    {step.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};

