import * as React from 'react';
import { Inter } from 'next/font/google';
import Providers from 'src/providers';
import AppTitle from 'src/components/appTitle';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// After the toast stylesheet so the app's toast tokens win.
import './globals.css';

// One UI face, self-hosted through next/font, replacing a settings-driven
// picker that built a fonts.googleapis.com <link> at render time. Inter, shared
// with the other redesigned staff apps: its tabular numerals and weight range
// carry the hierarchy on tables, figures and forms.
//
// The JetBrains Mono <link> below is deliberately NOT folded in here: it is
// referenced by its literal family name from globals.css, labelSpec.js and the
// PDF renderer, and next/font would give it a hashed name those stacks could no
// longer match. It is also an operational face, not a brand choice — see the
// comment at its link tag.
const siteFont = Inter({ subsets: ['latin'], display: 'swap' });

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
  return (
    <html lang="en-US" data-theme="light" className={siteFont.className}>
      <head>
        <title>Management</title>
        <link rel="icon" href={settings?.favicon || '/favicon.png'} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Operational face for barcodes, serials and quantities. Separate from
            the brand face on purpose: an operator matches codes against physical
            labels, so 0/O and 1/l/I must never be confusable. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap"
        />
      </head>
      <body>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <AppTitle />
        <Providers>{children}</Providers>
        <ToastContainer position="bottom-right" autoClose={3000} newestOnTop closeOnClick={false} />
      </body>
    </html>
  );
}
