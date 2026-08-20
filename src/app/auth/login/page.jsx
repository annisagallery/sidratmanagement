import React from 'react';
// guard
import GuestGuard from 'src/guards/guest';
// components
import LoginMain from 'src/components/_main/auth/login';

// The card, heading and page chrome all live in the login form itself so this
// screen stays byte-identical to the other staff apps' sign-in pages.
export default async function Login() {
  return (
    <GuestGuard>
      <LoginMain />
    </GuestGuard>
  );
}
