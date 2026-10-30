import type { Metadata } from 'next';
import './globals.css';

const description = '4-stage trade finance export documentation assistant for Indian textile exporters with Gemini AI vision extraction, SWIFT MT700/MT707 clause intelligence, reconciliation, and automated export document generation.';

export const metadata: Metadata = {
  title: 'Export Documentation Assistant',
  description,
  openGraph: { title: 'Export Documentation Assistant', description, type: 'website' },
  twitter: { card: 'summary_large_image' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
