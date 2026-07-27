'use client';
import React from 'react';
import PropTypes from 'prop-types';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { MdOutlineFileDownload } from 'react-icons/md';
import OrderPDF from 'src/components/_admin/orders/orderPdf';

OrderPdfDownload.propTypes = { data: PropTypes.object.isRequired };

function Spinner() {
  return <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-md animate-spin" />;
}

export default function OrderPdfDownload({ data }) {
  return (
    <PDFDownloadLink
      document={<OrderPDF data={data} />}
      fileName={`INVOICE-${data?.id}`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <button
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-md disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Spinner /> : <MdOutlineFileDownload size={16} />}
          Download
        </button>
      )}
    </PDFDownloadLink>
  );
}
