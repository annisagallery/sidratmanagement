'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FiFacebook, FiGlobe, FiMail, FiPhone } from 'react-icons/fi';
import Image from 'next/image';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

export const LETTERHEAD_HEADER_HEIGHT = 96;
export const LETTERHEAD_FOOTER_HEIGHT = 115;

const font      = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const brandFont = "'Playfair Display', Georgia, 'Times New Roman', serif";

// ── Pixel-mosaic (bottom-right corner decoration) ─────────────────────────
const PIXEL_GRID = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
const OPACS = [0.38, 0.55, 0.72, 0.9];

function PixelMosaic({ accent }) {
  const COLS = 15, ROWS = PIXEL_GRID.length;
  const CELL = 10, STEP = CELL + 2;
  return (
    <svg width={COLS * STEP} height={ROWS * STEP}
      viewBox={`0 0 ${COLS * STEP} ${ROWS * STEP}`}
      style={{ display: 'block' }}>
      {PIXEL_GRID.flatMap((row, r) =>
        row.map((on, c) => on ? (
          <rect key={`${r}-${c}`}
            x={c * STEP} y={r * STEP} width={CELL} height={CELL} rx={1}
            fill={accent} opacity={OPACS[(r + c) % OPACS.length]} />
        ) : null)
      )}
    </svg>
  );
}

// ── Side motif (cascading tiles on right margin) ──────────────────────────
const tiles = [
  [0, 2, 12], [1, 1, 10], [1, 3, 12], [2, 0, 8],  [2, 2, 12], [2, 4, 10],
  [3, 1, 11], [3, 3, 10], [3, 5, 7],  [4, 0, 8],  [4, 2, 10], [4, 4, 8],
  [5, 1, 9],  [5, 3, 8],  [6, 2, 7]
];

export function LetterheadSideMotif() {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', top: '128px', right: '25px',
      width: '82px', height: '310px', opacity: 0.9
    }}>
      {tiles.map(([row, col, size], i) => (
        <span key={`${row}-${col}`} style={{
          position: 'absolute',
          top: `${row * 22 + col * 9}px`,
          right: `${col * 11}px`,
          width: `${size}px`, height: `${size}px`,
          background: 'var(--letterhead-accent, #a6192e)',
          transform: 'rotate(8deg)',
          opacity: Math.max(0.28, 1 - i * 0.038)
        }} />
      ))}
    </div>
  );
}

// ── Watermark — logo clipped to a circle ─────────────────────────────────
export function LetterheadWatermark({ logo }) {
  if (!logo) return null;
  return (
    <div aria-hidden="true" style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '300px', height: '300px',
      borderRadius: '50%',
      overflow: 'hidden',
      opacity: 0.06,
      pointerEvents: 'none',
      zIndex: 0
    }}>
      <Image
        src={logo}
        alt=""
        fill
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
export function LetterheadHeader({ settings, logo, documentLabel }) {
  const accent = settings.primaryColor || '#a6192e';

  return (
    <div style={{ height: '100%', background: '#fff', fontFamily: font }}>

      <div style={{
        padding: '10px 46px 0',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/*
          inline-flex column → container width = max(circle diameter, text render width).
          Both children are centred in that width → they appear the "same width".
        */}
        <div style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}>
          {/* Circle logo */}
          <div style={{
            width: '52px', height: '52px',
            borderRadius: '50%', overflow: 'hidden',
            border: `2.5px solid ${accent}`,
            background: '#f5f5f5',
            flexShrink: 0
          }}>
            {logo && (
              <Image
                src={logo}
                alt={settings.siteName || ''}
                width={52}
                height={52}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>

          {/* Brand name — same column width as the circle, centred */}
          <span style={{
            fontFamily: brandFont,
            fontSize: '8.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: '#1a1a1a',
            whiteSpace: 'nowrap',
            lineHeight: 1
          }}>
            {settings.siteName || 'COMPANY NAME'}
          </span>
        </div>

        {documentLabel && (
          <p style={{
            margin: 0, color: '#999', fontSize: '8px',
            fontWeight: 700, letterSpacing: '0.22em', flexShrink: 0,
            fontFamily: brandFont
          }}>
            {documentLabel}
          </p>
        )}
      </div>

      {/* Gradient accent rule */}
      <div style={{
        margin: '8px 46px 0', height: '2px', borderRadius: '2px',
        background: `linear-gradient(to right, ${accent} 0%, ${accent}bb 45%, ${accent}33 75%, transparent 100%)`
      }} />
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────
export function LetterheadFooter({ settings, showQr = true }) {
  const accent = settings.primaryColor || '#a6192e';
  const [qr, setQr] = useState('');
  const branchesUrl = `${STOREFRONT_URL.replace(/\/$/, '')}/branches`;
  const website = STOREFRONT_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

  useEffect(() => {
    QRCode.toDataURL(branchesUrl, {
      width: 180, margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#171717', light: '#ffffff' }
    }).then(setQr).catch(() => setQr(''));
  }, [branchesUrl]);

  const contacts = [
    { Icon: FiPhone,    value: settings.phone    },
    { Icon: FiMail,     value: settings.email    },
    { Icon: FiFacebook, value: settings.facebook },
    { Icon: FiGlobe,    value: website           }
  ].filter((c) => c.value);

  return (
    <div style={{ height: '100%', background: '#fff', fontFamily: font, position: 'relative' }}>

      {/* Top separator */}
      <div style={{ margin: '0 44px', height: '1px', background: '#e3e3e3' }} />

      {/* Single row: [QR] | [address] | divider | [2×2 contact grid] */}
      <div style={{
        padding: '12px 44px 0',
        display: 'flex', alignItems: 'center',
        gap: '14px', position: 'relative', zIndex: 2
      }}>

        {/* QR box — no text label. Hidden when the document body carries its
            own showroom QR band (e.g. the invoice), to avoid printing twice. */}
        {showQr && (
          <div style={{
            width: '60px', height: '60px', flexShrink: 0,
            border: `1.5px solid ${accent}`,
            padding: '2px', boxSizing: 'border-box'
          }}>
            {qr
              ? <Image src={qr} alt="Scan for branch locations" width={57} height={57} style={{ width: '100%', height: '100%', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: '#f4f4f4' }} />
            }
          </div>
        )}

        {/* Branch / address text */}
        <div style={{ flexShrink: 0, maxWidth: '145px' }}>
          <p style={{
            margin: '0 0 4px',
            fontSize: '7px', fontWeight: 700,
            color: accent, textTransform: 'uppercase', letterSpacing: '0.14em',
            fontFamily: brandFont
          }}>
            Head Office
          </p>
          <p style={{ margin: 0, fontSize: '7.5px', color: '#4b4b4b', lineHeight: 1.55 }}>
            {settings.address || 'Scan QR for all branch locations'}
          </p>
        </div>

        {/* Vertical divider */}
        <div style={{ width: '1px', height: '52px', background: '#e5e5e5', flexShrink: 0 }} />

        {/* 2 × 2 contact grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '7px 18px',
          flex: 1, minWidth: 0
        }}>
          {contacts.map(({ Icon, value }) => (
            <div key={value} style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <span style={{
                width: '17px', height: '17px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', background: accent, color: '#fff'
              }}>
                <Icon size={8} strokeWidth={2.5} />
              </span>
              <span style={{
                color: '#4b4b4b', fontSize: '7.5px', lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom-right pixel-mosaic */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        opacity: 0.17, pointerEvents: 'none', zIndex: 1
      }}>
        <PixelMosaic accent={accent} />
      </div>
    </div>
  );
}
