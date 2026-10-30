'use client';
// The workflow runs entirely in the browser (localStorage, PDF.js, jsPDF, docx), so it is not server-rendered.
import dynamic from 'next/dynamic';

const ExportAssistantApp = dynamic(() => import('./ExportAssistantApp'), { ssr: false });

export function ClientApp() {
  return <ExportAssistantApp />;
}
