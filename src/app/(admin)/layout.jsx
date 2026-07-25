import AuthProvider from '@/src/providers/auth';
import React from 'react';

// guard

// layout
import DashboardLayout from 'src/layout/_admin';

export default function layout({ children }) {
  return (
    <AuthProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthProvider>
  );
}
