import AuthProvider from '@/src/providers/auth';
import OrderDeskShell from 'src/layout/_desk';

/**
 * Order entry runs outside the admin layout on purpose: it is a focused,
 * all-day task, so the whole screen goes to the form — no sidebar, no page
 * tabs. Same idea as the production scan desk.
 */
export default function DeskLayout({ children }) {
  return (
    <AuthProvider>
      <OrderDeskShell>{children}</OrderDeskShell>
    </AuthProvider>
  );
}
