'use client';

import { FiArrowLeft, FiPrinter } from 'react-icons/fi';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import {
  LETTERHEAD_FOOTER_HEIGHT,
  LETTERHEAD_HEADER_HEIGHT,
  LetterheadFooter,
  LetterheadHeader,
  LetterheadSideMotif,
  LetterheadWatermark
} from 'src/components/print/LetterheadBranding';

const H_HDR = LETTERHEAD_HEADER_HEIGHT;
const H_FTR = LETTERHEAD_FOOTER_HEIGHT;

// @import must appear before @media rules inside the same <style> tag
const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

  @media print {
    @page { size: A4 portrait; margin: 0; }
    body {
      margin: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    .lh-print-sheet {
      display: block !important;
      position: relative;
      width: 210mm;
      height: 297mm;
      background: #fff;
      box-sizing: border-box;
    }
    .lh-print-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: ${H_HDR}px;
    }
    .lh-print-footer {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: ${H_FTR}px;
    }
  }
`;

export default function LetterheadPreviewPage() {
  const settings = useSiteSettings();
  const color = settings.primaryColor || '#b08a4a';
  const logo = settings.logo;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.close()}
              className="flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900"
            >
              <FiArrowLeft size={15} /> Close
            </button>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-700">Professional letterhead</span>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-gray-400 sm:block">A4 · branch directory QR included</p>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: color }}
            >
              <FiPrinter size={15} /> Print letterhead
            </button>
          </div>
        </div>
      </div>

      {/* Screen preview */}
      <div className="no-print min-h-screen bg-slate-100 py-8">
        <div
          className="relative mx-auto max-w-[794px] bg-white shadow-2xl"
          style={{ minHeight: '1123px', '--letterhead-accent': color }}
        >
          <div style={{ height: `${H_HDR}px` }}>
            <LetterheadHeader settings={settings} logo={logo} />
          </div>
          <LetterheadSideMotif />
          <LetterheadWatermark logo={logo} />

          <div
            style={{
              margin: '34px 46px',
              minHeight: '810px',
              border: '1px dashed #e1e1e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              textAlign: 'center',
              padding: '40px'
            }}
          >
            <div style={{ width: '34px', height: '2px', background: color, marginBottom: '18px' }} />
            <p style={{ margin: 0, color: '#555', fontSize: '13px', fontWeight: 650 }}>Document area</p>
            <p style={{ margin: '7px 0 0', maxWidth: '310px', fontSize: '11px', lineHeight: 1.55 }}>
              The clean centre area is reserved for invoices, official letters, quotations and company documents.
            </p>
          </div>

          <div style={{ position: 'absolute', right: 0, bottom: 0, left: 0, height: `${H_FTR}px` }}>
            <LetterheadFooter settings={settings} />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          The QR opens the live branches page, so showroom details stay current without reprinting addresses.
        </p>
      </div>

      {/* Print-only sheet */}
      <div className="lh-print-sheet" style={{ display: 'none', '--letterhead-accent': color }}>
        <div className="lh-print-header">
          <LetterheadHeader settings={settings} logo={logo} />
        </div>
        <LetterheadSideMotif />
        <LetterheadWatermark logo={logo} />
        <div className="lh-print-footer">
          <LetterheadFooter settings={settings} />
        </div>
      </div>
    </>
  );
}
