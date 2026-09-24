import AuthProvider from '@/src/providers/auth';
import ScanDeskShell from 'src/layout/_scan';

/**
 * Scan desk runs outside the admin layout on purpose. Like the POS terminal,
 * it is an all-day workstation: no sidebar, no page tabs, and no navigation
 * competing with the barcode input.
 */
export default function ScanLayout({ children }) {
  return (
    <AuthProvider>
      <ScanDeskShell>{children}</ScanDeskShell>
    </AuthProvider>
  );
}
