import React from 'react';
// guard
import GuestGuard from 'src/guards/guest';
// components
import LoginMain from 'src/components/_main/auth/login';
export default async function Login() {
  return (
    <>
      <GuestGuard>
        <div className="max-w-md mx-auto my-12">
          <div className=" bg-white p-6 border">
            <div className="mb-5">
              <h1 className="text-4xl font-bold text-center mb-2">Management</h1>
              <p className="text-center text-gray-600">Sign in with your admin account</p>
            </div>

            <LoginMain />
          </div>
        </div>
      </GuestGuard>
    </>
  );
}
