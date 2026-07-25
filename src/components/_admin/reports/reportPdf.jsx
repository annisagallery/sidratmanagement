'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { fDate, fDateTime } from 'src/utils/formatTime';

/**
 * Generic tabular report PDF. Rendered on demand from ReportWorkspace and
 * opened in a new tab. Helvetica has no ৳ glyph, so currency uses "Tk".
 */

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: 'Helvetica', color: '#1e293b' },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 8, color: '#64748b', marginTop: 3 },
  filters: { fontSize: 8, color: '#475569', marginTop: 6 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 12 },
  summaryBox: {
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 90
  },
  summaryLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase' },
  summaryValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottom: '1px solid #cbd5e1',
    borderTop: '1px solid #cbd5e1'
  },
  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, paddingVertical: 5, paddingHorizontal: 4 },
  row: { flexDirection: 'row', borderBottom: '0.5px solid #e2e8f0' },
  rowAlt: { backgroundColor: '#f8fafc' },
  cell: { paddingVertical: 4, paddingHorizontal: 4 },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8'
  }
});

function fmtCell(col, value) {
  if (value == null || value === '') return '—';
  if (value === '—') return '—';
  if (col.type === 'date') return fDate(value);
  if (col.type === 'datetime') return fDateTime(value);
  if (col.type === 'currency') return `Tk ${Number(value).toLocaleString()}`;
  if (col.type === 'number') return Number(value).toLocaleString();
  if (col.type === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  return String(value);
}

function fmtSummary(item) {
  const n = Number(item.value ?? 0).toLocaleString();
  return item.format === 'currency' ? `Tk ${n}` : n;
}

function colFlex(col) {
  if (col.type === 'currency' || col.type === 'number' || col.type === 'boolean') return 0.7;
  if (col.type === 'date' || col.type === 'datetime' || col.type === 'status') return 0.9;
  return 1.3;
}

export default function ReportPdf({ title, columns, rows, summary = [], filterText, brandName = '' }) {
  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {brandName ? `${brandName} — ` : ''}Generated {fDateTime(new Date())} · {rows.length.toLocaleString()} rows
        </Text>
        {filterText ? <Text style={styles.filters}>Filters: {filterText}</Text> : null}

        {summary.length > 0 && (
          <View style={styles.summaryRow}>
            {summary.map((s) => (
              <View key={s.key} style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>{s.label}</Text>
                <Text style={styles.summaryValue}>{fmtSummary(s)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.headerRow} fixed>
          {columns.map((col) => (
            <Text
              key={col.key}
              style={[styles.headerCell, { flex: colFlex(col), textAlign: col.align === 'right' ? 'right' : 'left' }]}
            >
              {col.label.toUpperCase()}
            </Text>
          ))}
        </View>

        {rows.map((row, i) => (
          <View key={i} style={[styles.row, ...(i % 2 ? [styles.rowAlt] : [])]} wrap={false}>
            {columns.map((col) => (
              <Text
                key={col.key}
                style={[styles.cell, { flex: colFlex(col), textAlign: col.align === 'right' ? 'right' : 'left' }]}
              >
                {fmtCell(col, row[col.key])}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>{title}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
