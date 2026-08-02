import * as React from 'react';
import Providers from 'src/providers';
import AppTitle from 'src/components/appTitle';
import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const FONT_OPTIONS = {
  play: { query: 'Play:wght@400;700', family: "'Play', sans-serif" },
  roboto: { query: 'Roboto:wght@400;500;700', family: "'Roboto', sans-serif" },
  inter: { query: 'Inter:wght@400;500;600;700', family: "'Inter', sans-serif" },
  poppins: { query: 'Poppins:wght@400;500;600;700', family: "'Poppins', sans-serif" },
  montserrat: { query: 'Montserrat:wght@400;500;600;700', family: "'Montserrat', sans-serif" },
  lato: { query: 'Lato:wght@400;700', family: "'Lato', sans-serif" },
  nunito: { query: 'Nunito:wght@400;500;600;700', family: "'Nunito', sans-serif" },
  'open-sans': { query: 'Open+Sans:wght@400;500;600;700', family: "'Open Sans', sans-serif" },
  'hind-siliguri': { query: 'Hind+Siliguri:wght@400;500;600;700', family: "'Hind Siliguri', sans-serif" }
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

async function fetchSiteSettings() {
  try {
    const res = await fetch(`${BASE_URL}/api/settings`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }) {
  const settings = await fetchSiteSettings();
  const font = FONT_OPTIONS[settings?.fontFamily] || FONT_OPTIONS.play;
  return (
    <html lang="en-US" data-theme="light">
      <head>
        <title>Management</title>
        <link rel="icon" href={settings?.favicon || '/favicon.png'} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${font.query}&display=swap`} />
        {/* Operational face for barcodes, serials and quantities. Separate from
            the configurable brand face on purpose: an operator matches codes
            against physical labels, so 0/O and 1/l/I must never be confusable. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap"
        />
      </head>
      <body style={{ fontFamily: font.family }}>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <AppTitle />
        <Providers>{children}</Providers>
        <ToastContainer />
      </body>
    </html>
  );
}
