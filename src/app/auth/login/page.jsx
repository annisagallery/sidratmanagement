import React from 'react';
// guard
import GuestGuard from 'src/guards/guest';
// components
import LoginMain from 'src/components/_main/auth/login';

// The card, heading and page chrome all live in the login form itself, which
// matches the marketing app's sign-in (the shared Sidrat design system).
export default async function Login() {
  return (
    <GuestGuard>
      <LoginMain />
    </GuestGuard>
  );
}
