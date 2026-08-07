'use client';

/**
 * Production sticker sheet.
 *
 * Barcodes are pre-generated when a batch starts specifically so a label can be
 * attached to each piece before it exists. Until now nothing printed them, so
 * the codes existed only on screen and the floor had no way to tell one piece
 * from another.
 *
 * The stickers use the same PriceLabel as the retail sheet, so the two are the
 * same artwork and cannot drift apart — the order reference simply takes the
 * row a price would occupy.
 *
 * This page is the preview; the printed artefact is a PDF (see openLabelSheet).
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from 'react-query';
import { FiPrinter, FiArrowLeft } from 'react-icons/fi';
import * as api from 'src/services';
import PriceLabel, { LABEL_SHEET_CSS } from 'src/components/_admin/labels/PriceLabel';
import { openLabelSheet, productionStickerLabels } from 'src/components/_admin/labels/openLabelSheet';

export default function ProductionStickerSheet() {
  const { id } = useParams();
  const search = useSearchParams();
  const printed = useRef(false);
  const [building, setBuilding] = useState(false);
  const [failed, setFailed] = useState(null);

  const { data, isLoading, isError } = useQuery(
    ['production-batch-units', id],
    () => api.getProductionBatchUnits(id),
    { enabled: Boolean(id) },
  );

  const labels = productionStickerLabels(data?.data || []);

  const print = async () => {
    setBuilding(true);
    setFailed(null);
    try {
      await openLabelSheet(labels, { title: 'Production stickers', guides: true });
    } catch (error) {
      setFailed(error?.message || 'The sticker PDF could not be built.');
    } finally {
      setBuilding(false);
    }
  };

  useEffect(() => {
    if (printed.current || !labels.length || search.get('auto') !== '1') return;
    printed.current = true;
    print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.length, search]);

  return (
    <div style={{ padding: '6mm 4mm', background: '#fff' }}>
      <style dangerouslySetInnerHTML={{ __html: LABEL_SHEET_CSS }} />

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => window.history.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <FiArrowLeft /> Back
        </button>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {labels.length} sticker{labels.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={print}
          disabled={!labels.length || building}
          title="Opens a print-ready PDF in a new tab"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
            padding: '8px 14px', borderRadius: 8, background: '#0f172a', color: '#fff',
            fontSize: 13, fontWeight: 600, opacity: labels.length && !building ? 1 : 0.5,
          }}
        >
          <FiPrinter /> {building ? 'Building PDF…' : 'Print PDF'}
        </button>
      </div>

      {isLoading ? <p style={{ fontSize: 13 }}>Loading pieces…</p> : null}
      {isError ? <p style={{ fontSize: 13, color: '#b91c1c' }}>Could not load this batch.</p> : null}
      {failed ? <p style={{ fontSize: 13, color: '#b91c1c' }}>{failed}</p> : null}
      {!isLoading && !isError && !labels.length ? (
        <p className="no-print" style={{ fontSize: 13 }}>
          This batch has no printable pieces yet. Start the batch to generate its barcodes.
        </p>
      ) : null}

      <div className="sheet">
        {labels.map((label, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <PriceLabel key={`${label.barcode}-${index}`} item={label} />
        ))}
      </div>
    </div>
  );
}
