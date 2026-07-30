'use client';

/**
 * Production sticker sheet.
 *
 * Barcodes are pre-generated when a batch starts specifically so a label can be
 * attached to each piece before it exists. Until now nothing printed them, so
 * the codes existed only on screen and the floor had no way to tell one piece
 * from another.
 *
 * Codes are rendered as QR plus a large human-readable string. Every scanner in
 * the flow reads what it is given; if yours are 1D laser units rather than 2D
 * imagers, add `jsbarcode` and swap <UnitCode> for a Code128 render — that is
 * the only component that would change.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from 'react-query';
import QRCode from 'qrcode';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import * as api from 'src/services';

// Label geometry in millimetres. Defaults suit a common 3-across A4 sheet;
// override per printer with ?across=&w=&h= rather than editing this file.
const DEFAULTS = { across: 3, width: 63.5, height: 38.1, gap: 2.5 };

const PRINT_CSS = (grid) => `
  @media print {
    @page { size: A4 portrait; margin: 8mm 6mm; }
    .no-print { display: none !important; }
    .sheet { gap: ${grid.gap}mm; }
    .label { break-inside: avoid; page-break-inside: avoid; }
  }
  .sheet {
    display: grid;
    grid-template-columns: repeat(${grid.across}, ${grid.width}mm);
    gap: ${grid.gap}mm;
    justify-content: center;
  }
  .label {
    width: ${grid.width}mm;
    height: ${grid.height}mm;
    border: 0.2mm dashed #cbd5e1;
    padding: 2mm;
    display: flex;
    gap: 2mm;
    align-items: center;
    overflow: hidden;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
`;

function UnitCode({ value, size }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { margin: 0, width: 256, errorCorrectionLevel: 'M' })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value]);

  if (!src) return <div style={{ width: size, height: size, background: '#f1f5f9' }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={value} style={{ width: size, height: size, display: 'block' }} />;
}

function Label({ unit, grid }) {
  const codeSize = `${Math.min(grid.height - 6, 24)}mm`;
  const attrs = (unit.variation?.attributes || [])
    .map((a) => a.valueName || a.value)
    .filter(Boolean)
    .join(' / ');

  return (
    <div className="label">
      <UnitCode value={unit.barcode} size={codeSize} />
      <div style={{ minWidth: 0, flex: 1, lineHeight: 1.25 }}>
        <div style={{ fontSize: '2.6mm', fontWeight: 800, letterSpacing: '0.02em', wordBreak: 'break-all' }}>
          {unit.barcode}
        </div>
        <div style={{ fontSize: '2.2mm', fontWeight: 600, marginTop: '0.8mm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {unit.product?.name || 'Product'}
        </div>
        {attrs ? (
          <div style={{ fontSize: '2mm', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {attrs}
          </div>
        ) : null}
        {/* What the floor most needs: which order this specific piece is for,
            and any customisation that makes it different from its neighbours. */}
        {unit.orderItem?.orderNo ? (
          <div style={{ fontSize: '2.1mm', fontWeight: 700, marginTop: '0.6mm', color: '#b45309' }}>
            Order {unit.orderItem.orderNo}
          </div>
        ) : (
          <div style={{ fontSize: '2mm', marginTop: '0.6mm', color: '#0f766e', fontWeight: 600 }}>
            Stock
          </div>
        )}
        {unit.orderItem?.customizeDetails ? (
          <div style={{ fontSize: '1.9mm', color: '#334155', overflow: 'hidden', maxHeight: '5mm' }}>
            {unit.orderItem.customizeDetails}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ProductionStickerSheet() {
  const { id } = useParams();
  const search = useSearchParams();
  const printed = useRef(false);

  const grid = useMemo(
    () => ({
      across: Number(search.get('across')) || DEFAULTS.across,
      width: Number(search.get('w')) || DEFAULTS.width,
      height: Number(search.get('h')) || DEFAULTS.height,
      gap: Number(search.get('gap')) || DEFAULTS.gap,
    }),
    [search],
  );

  const { data, isLoading, isError } = useQuery(
    ['production-batch-units', id],
    () => api.getProductionBatchUnits(id),
    { enabled: Boolean(id) },
  );

  // Voided pieces have been replaced; printing them would put a dead code on a
  // real garment.
  const units = (data?.data || []).filter((unit) => unit.status !== 'VOID');

  useEffect(() => {
    if (!printed.current && units.length && search.get('auto') === '1') {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [units.length, search]);

  return (
    <div style={{ padding: '6mm 4mm', background: '#fff' }}>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS(grid) }} />

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => window.history.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <FiArrowLeft /> Back
        </button>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {units.length} sticker{units.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={() => window.print()}
          disabled={!units.length}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
            padding: '8px 14px', borderRadius: 8, background: '#0f172a', color: '#fff',
            fontSize: 13, fontWeight: 600, opacity: units.length ? 1 : 0.5,
          }}
        >
          <FiPrinter /> Print
        </button>
      </div>

      {isLoading ? <p style={{ fontSize: 13 }}>Loading pieces…</p> : null}
      {isError ? <p style={{ fontSize: 13, color: '#b91c1c' }}>Could not load this batch.</p> : null}
      {!isLoading && !isError && !units.length ? (
        <p className="no-print" style={{ fontSize: 13 }}>
          This batch has no printable pieces yet. Start the batch to generate its barcodes.
        </p>
      ) : null}

      <div className="sheet">
        {units.map((unit) => (
          <Label key={unit.barcode} unit={unit} grid={grid} />
        ))}
      </div>
    </div>
  );
}
