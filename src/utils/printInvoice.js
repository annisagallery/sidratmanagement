// utils/printInvoice.js
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import Invoice from './invoice';

export function printInvoices(orders, delay = 10) {
  const list = Array.isArray(orders) ? orders : [orders];

  // 1. Render invoices to a full HTML document
  const html = ReactDOMServer.renderToStaticMarkup(
    <html>
      <head>
        <title>Invoice</title>
        <style>
          {`
            body { margin: 0 ; font-family: Arial, sans-serif; }
            .invoice { page-break-after: always; }
            .invoice:last-child { page-break-after: auto; }
          `}
        </style>
      </head>
      <body>
        {list.map((order, i) => (
          <div key={i} className="invoice">
            <Invoice order={order} />
          </div>
        ))}
      </body>
    </html>
  );

  // 2. Open a new tab
  const printTab = window.open('', '_blank');

  // 3. Write our HTML into it
  printTab.document.open();
  printTab.document.write(html);
  printTab.document.close();

  // 4. When its content loads, wait then trigger print()
  printTab.onload = () => {
    printTab.focus();
    setTimeout(() => {
      printTab.print();
      // leave tab open for user to save/inspect
    }, delay);
  };
}
